import { relative, resolve, sep } from "node:path";
import { evaluateGoldenCandidate } from "./golden-promotion.mjs";

const allowedRightsStatuses = new Set(["cleared", "excluded", "NOASSERTION"]);

export function rightsReleaseErrors(manifest, artifactRoot = "docs/site", evidenceHashes = new Map()) {
  const errors = [];
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.sources)) {
    return ["权利清单格式不受支持"];
  }
  const absoluteRoot = resolve(artifactRoot);
  for (const source of manifest.sources) {
    if (!source?.id || !allowedRightsStatuses.has(source.rights_status) || !Array.isArray(source.public_artifact_paths)) {
      errors.push(`权利条目格式无效: ${source?.id ?? "unknown"}`);
      continue;
    }
    for (const path of source.public_artifact_paths) {
      const rel = relative(absoluteRoot, resolve(path));
      if (!rel || rel === ".." || rel.startsWith(`..${sep}`)) errors.push(`${source.id} 的公开产物路径不在 ${artifactRoot} 内: ${path}`);
    }
    if (source.rights_status === "NOASSERTION" && source.public_artifact_paths.length > 0) {
      errors.push(`${source.id} 权利状态为 NOASSERTION，不得进入公开产物`);
    }
    if (source.rights_status === "excluded" && source.public_artifact_paths.length > 0) {
      errors.push(`${source.id} 标记 excluded 但仍登记公开产物`);
    }
    if (source.rights_status === "cleared") {
      if (!Array.isArray(source.evidence_refs) || source.evidence_refs.length === 0) errors.push(`${source.id} 标记 cleared 但缺少权利证据`);
      for (const evidence of source.evidence_refs ?? []) {
        if (!evidence?.path || !/^[a-f0-9]{64}$/u.test(evidence.sha256 ?? "") || evidence.approval_status !== "approved") {
          errors.push(`${source.id} 的权利证据格式或批准状态无效`);
        } else if (evidenceHashes.get(evidence.path) !== evidence.sha256) {
          errors.push(`${source.id} 的权利证据不存在或哈希不一致: ${evidence.path}`);
        }
      }
    }
  }
  return errors;
}

export function uncoveredPublicArtifactErrors(manifest, publicArtifactPaths) {
  const covered = new Set((manifest?.sources ?? []).filter((source) => source.rights_status !== "excluded").flatMap((source) => source.public_artifact_paths ?? []));
  return publicArtifactPaths
    .filter((path) => !covered.has(path))
    .map((path) => `公开产物未登记权利来源: ${path}`);
}

export function dataPackageRightsErrors(manifest, packages) {
  const errors = [];
  const sources = new Map((manifest?.sources ?? []).map((source) => [source.id, source]));
  for (const declared of manifest?.data_packages ?? []) {
    const source = sources.get(declared.source_entry_id);
    const actual = packages.get(declared.path);
    if (!source) errors.push(`数据包 ${declared.path} 引用了不存在的权利来源: ${declared.source_entry_id}`);
    if (!actual) errors.push(`权利清单中的数据包不存在或无法解析: ${declared.path}`);
    else if (actual.source_id !== declared.source_id || actual.source_sha256 !== declared.source_sha256) errors.push(`数据包 ${declared.path} 的来源ID或SHA与权利清单不一致`);
  }
  for (const [path] of packages) if (!(manifest?.data_packages ?? []).some((item) => item.path === path)) errors.push(`发布数据包未绑定权利来源: ${path}`);
  return errors;
}

export function goldenReleaseErrors(goldenData, registryData) {
  const errors = [];
  if (!Array.isArray(goldenData?.candidates) || !Array.isArray(registryData?.reviewers)) {
    return ["黄金样本或审核者注册表格式无效"];
  }
  const registry = new Map();
  for (const reviewer of registryData.reviewers) {
    if (!reviewer?.id || registry.has(reviewer.id)) errors.push(`审核者注册表存在无效或重复 ID: ${reviewer?.id ?? "unknown"}`);
    else registry.set(reviewer.id, reviewer);
  }
  for (const candidate of goldenData.candidates.filter((item) => item.golden_status === "golden")) {
    try {
      const current = evaluateGoldenCandidate(candidate, registry);
      if (current.state !== "complete" || current.status !== "golden") {
        errors.push(`${candidate.alignment_id} 按当前审核注册表已不满足黄金样本条件`);
      }
    } catch (error) {
      errors.push(`${candidate.alignment_id}: ${error.message}`);
    }
  }
  return errors;
}
