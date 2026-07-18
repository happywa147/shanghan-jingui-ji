#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { goldenReleaseErrors } from "../lib/release-gates.mjs";

const goldenPath = resolve(process.argv[2] ?? "data/review/golden-candidates.json");
const registryPath = resolve(process.argv[3] ?? "data/review/reviewer-registry.json");
const evidencePath = resolve(process.argv[4] ?? "dist/release-gates/golden.json");
const golden = JSON.parse(await readFile(goldenPath, "utf8"));
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const errors = goldenReleaseErrors(golden, registry);
const goldenCount = golden.candidates?.filter((item) => item.golden_status === "golden").length ?? 0;
const evidence = {
  gate: "golden-release",
  passed: errors.length === 0,
  golden_count: goldenCount,
  active_reviewers: registry.reviewers?.filter((reviewer) => reviewer.active).length ?? 0,
  errors
};
await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`黄金样本发布重验通过：${goldenCount} 条`);
