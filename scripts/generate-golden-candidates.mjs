#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const importPath = process.argv[2] ?? "data/imported/liwengtang-shanghan.json";
const variantsPath = process.argv[3] ?? "data/imported/liwengtang-variants.json";
const outputPath = process.argv[4] ?? "data/review/golden-candidates.json";
const imported = JSON.parse(await readFile(resolve(importPath), "utf8"));
const variantData = JSON.parse(await readFile(resolve(variantsPath), "utf8"));
if (variantData.manifest?.input_revision !== imported.manifest.source_sha256) {
  throw new Error("异文派生数据与导入数据修订不一致");
}
const variantById = new Map(variantData.variants.map((item) => [item.alignment_id, item]));
let existing = null;
try { existing = JSON.parse(await readFile(resolve(outputPath), "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (existing && (existing.input_revision !== imported.manifest.source_sha256 || existing.variant_revision !== variantData.manifest.variant_revision) &&
    existing.candidates.some((item) => item.first_review || item.second_review || item.adjudication)) {
  throw new Error("旧数据或异文算法修订已含人工审核，禁止静默覆盖");
}
const preserveExisting = existing?.input_revision === imported.manifest.source_sha256 && existing?.variant_revision === variantData.manifest.variant_revision;
const existingById = new Map((preserveExisting ? existing.candidates : []).map((item) => [item.alignment_id, item]));

const ranked = imported.alignments.map((alignment) => {
  const variant = variantById.get(alignment.id);
  const edition = alignment.target_unit_ids[0]?.split(":")[1] ?? "unknown";
  const reasons = [];
  if (alignment.relation_type === "merge") reasons.push("merge");
  if (alignment.confidence !== null && alignment.confidence < 0.4) reasons.push("low_confidence");
  if (variant?.difference_ratio === 0) reasons.push("no_character_difference");
  if ((variant?.difference_ratio ?? 0) >= 0.35) reasons.push("high_character_difference");
  return { alignment, variant, edition, reasons };
});

const selected = [];
const selectedIds = new Set();
function take(items, count, reason) {
  for (const item of items) {
    if (selected.length >= 50 || count <= 0 || selectedIds.has(item.alignment.id)) continue;
    selected.push({ ...item, selection_reason: reason });
    selectedIds.add(item.alignment.id);
    count--;
  }
}

take(ranked.filter((item) => item.reasons.includes("merge")), 10, "merge");
take(ranked.filter((item) => item.reasons.includes("low_confidence")).sort((a, b) => a.alignment.confidence - b.alignment.confidence), 10, "low_confidence");
take(ranked.filter((item) => item.reasons.includes("high_character_difference")).sort((a, b) => b.variant.difference_ratio - a.variant.difference_ratio), 10, "high_character_difference");
take(ranked.filter((item) => item.reasons.includes("no_character_difference")), 10, "no_character_difference");
for (const edition of ["guilin", "kangping"]) {
  take(ranked.filter((item) => item.edition === edition), 5, `edition_${edition}`);
}
take(ranked, 50 - selected.length, "deterministic_fill");

const candidates = selected.map(({ alignment, variant, edition, selection_reason }) => ({
  alignment_id: alignment.id,
  target_edition: edition,
  relation_type: alignment.relation_type,
  machine_confidence: alignment.confidence,
  difference_ratio: variant.difference_ratio,
  source_text: variant.source_text,
  target_text: variant.target_text,
  selection_reason,
  review_state: existingById.get(alignment.id)?.review_state ?? "awaiting_first_review",
  first_review: existingById.get(alignment.id)?.first_review ?? null,
  second_review: existingById.get(alignment.id)?.second_review ?? null,
  adjudication: existingById.get(alignment.id)?.adjudication ?? null,
  reviewed_relation_type: existingById.get(alignment.id)?.reviewed_relation_type ?? null,
  golden_status: existingById.get(alignment.id)?.golden_status ?? "candidate"
}));

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), `${JSON.stringify({
  schema_version: 1,
  input_revision: imported.manifest.source_sha256,
  variant_revision: variantData.manifest.variant_revision,
  generator: "scripts/generate-golden-candidates.mjs",
  algorithm_version: "2",
  promotion_rule: "双审一致，或双审不一致后完成裁决，才可改为 golden",
  candidates
}, null, 2)}\n`);
console.log(`黄金样本候选队列: ${candidates.length} 条`);
