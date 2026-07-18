#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { dataPackageRightsErrors, rightsReleaseErrors, uncoveredPublicArtifactErrors } from "../lib/release-gates.mjs";

const manifestPath = resolve(process.argv[2] ?? "rights-manifest.json");
const evidencePath = resolve(process.argv[3] ?? "dist/release-gates/rights.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const artifactRoot = resolve(manifest.public_artifact_root);
async function listFiles(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await listFiles(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}
const publicArtifactPaths = (await listFiles(artifactRoot))
  .map((path) => `${manifest.public_artifact_root}/${relative(artifactRoot, path)}`);
const evidenceHashes = new Map();
for (const evidence of manifest.sources.flatMap((source) => source.evidence_refs ?? [])) {
  if (!evidence?.path || evidenceHashes.has(evidence.path)) continue;
  try {
    evidenceHashes.set(evidence.path, createHash("sha256").update(await readFile(resolve(evidence.path))).digest("hex"));
  } catch {
    evidenceHashes.set(evidence.path, null);
  }
}
const packages = new Map();
for (const file of await readdir(resolve("data/imported"))) {
  if (!file.endsWith(".json")) continue;
  const path = `data/imported/${file}`;
  try {
    const data = JSON.parse(await readFile(resolve(path), "utf8"));
    if (data.manifest?.source_id && data.manifest?.source_sha256) packages.set(path, { source_id: data.manifest.source_id, source_sha256: data.manifest.source_sha256 });
  } catch {}
}
const errors = [
  ...rightsReleaseErrors(manifest, manifest.public_artifact_root, evidenceHashes),
  ...dataPackageRightsErrors(manifest, packages),
  ...uncoveredPublicArtifactErrors(manifest, publicArtifactPaths)
];
const evidence = {
  gate: "release-rights",
  passed: errors.length === 0,
  manifest: relative(process.cwd(), manifestPath),
  checked_sources: manifest.sources?.length ?? 0,
  checked_public_artifacts: publicArtifactPaths.length,
  errors
};
await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`公开发布权利门禁通过：${evidence.checked_sources} 个来源`);
