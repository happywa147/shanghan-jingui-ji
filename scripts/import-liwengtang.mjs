#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const sourcePath = process.argv[2];
const outputPath = process.argv[3] ?? "data/imported/liwengtang-shanghan.json";

if (!sourcePath) {
  console.error("用法: node scripts/import-liwengtang.mjs <shanghan_all.json> [输出文件]");
  process.exit(1);
}

const sourceBuffer = await readFile(resolve(sourcePath));
const source = JSON.parse(sourceBuffer.toString("utf8"));

if (!Array.isArray(source.versions)) {
  throw new Error("来源文件缺少 versions 数组");
}

const sourceId = `liwengtang:${createHash("sha256").update(sourceBuffer).digest("hex")}`;

const editions = source.versions.map((version) => ({
  id: `shanghan_lun:${version.id}`,
  work_id: "shanghan_lun",
  source_id: sourceId,
  source_version_id: version.id,
  name: version.name,
  description: version.sub ?? null,
  numbering_scheme: version.scheme
}));

const textUnits = source.versions.flatMap((version) =>
  (version["条文"] ?? []).map((unit) => ({
    id: `shanghan_lun:${version.id}:${unit.id}`,
    work_id: "shanghan_lun",
    edition_id: `shanghan_lun:${version.id}`,
    source_id: sourceId,
    volume: unit["卷"] ?? null,
    chapter: unit["篇"] ?? null,
    source_record_locator: unit.id,
    locators: [{
      kind: "source_record",
      source_record_id: unit.id,
      scan_file: null,
      scan_page: null,
      folio: null,
      line: null,
      region: null
    }],
    received_number: unit["通用条号"] ?? null,
    structure_level: unit["缩进"] ?? null,
    source_edited_text: unit["原文"],
    source_traditional_text: unit["原文繁"] ?? null,
    source_main_text: unit["主文"] ?? null,
    diplomatic_transcription: null,
    source_collation: unit["校勘"] ?? [],
    editorial_notes: ["字段名为来源整理文本；未经扫描影像逐字核对，不作底本原貌声明。"],
    review_status: "imported"
  }))
);

const formulas = source.versions.flatMap((version) =>
  (version["方剂"] ?? []).map((formula) => ({
    id: `formula:shanghan_lun:${version.id}:${formula.id}`,
    work_id: "shanghan_lun",
    edition_id: `shanghan_lun:${version.id}`,
    source_id: sourceId,
    original_locator: formula.id,
    name: formula["方名"],
    category: formula["类"] ?? null,
    first_chapter: formula["首见篇"] ?? null,
    preparation_and_use: formula["煎服法"] ?? null,
    postscript: formula["方后"] ?? null,
    ingredients: (formula["组成"] ?? []).map((ingredient, index) => ({
      sequence: index + 1,
      substance: ingredient["药"],
      dose_original: ingredient["剂量"] ?? null,
      preparation: ingredient["炮制"] ?? null
    })),
    review_status: "imported"
  }))
);

const formulaIdByEditionAndName = new Map(formulas.map((formula) => [
  `${formula.edition_id}:${formula.name}`,
  formula.id
]));
const textFormulaLinks = source.versions.flatMap((version) =>
  (version["条文"] ?? []).flatMap((unit) =>
    (unit["关联方"] ?? []).map((formulaName) => ({
      text_unit_id: `shanghan_lun:${version.id}:${unit.id}`,
      formula_id: formulaIdByEditionAndName.get(`shanghan_lun:${version.id}:${formulaName}`) ?? null,
      formula_name_raw: formulaName,
      provenance: "imported"
    }))
  )
);

const editionBySourceName = {
  "桂林": "guilin",
  "康平": "kangping"
};
const alignmentCandidates = [];
for (const unit of source.versions.find((version) => version.id === "song")?.["条文"] ?? []) {
  for (const [sourceName, targetEdition] of Object.entries(editionBySourceName)) {
    const comparison = unit["对照"]?.[sourceName];
    if (!comparison) continue;
    alignmentCandidates.push({ unit, comparison, targetEdition });
  }
}

const alignmentGroups = Map.groupBy(
  alignmentCandidates,
  ({ targetEdition, comparison }) => `${targetEdition}:${comparison.id}`
);
const alignments = [...alignmentGroups.entries()].map(([targetKey, candidates]) => {
  const [targetEdition, targetId] = targetKey.split(":");
  const sourceUnitIds = candidates.map(({ unit }) => `shanghan_lun:song:${unit.id}`);
  return {
    id: `alignment:shanghan_lun:song:${sourceUnitIds.map((id) => id.split(":").at(-1)).join("+")}:${targetEdition}:${targetId}`,
    work_id: "shanghan_lun",
    source_unit_ids: sourceUnitIds,
    target_unit_ids: [`shanghan_lun:${targetEdition}:${targetId}`],
    relation_type: sourceUnitIds.length > 1 ? "merge" : "approximate",
    confidence: Math.min(...candidates.map(({ comparison }) => comparison["信度"] ?? 0)),
    provenance: "imported",
    algorithm: { name: "liwengtang-source-map", version: "1" },
    review_status: "imported"
  };
});

const result = {
  manifest: {
    schema_version: 1,
    importer: "scripts/import-liwengtang.mjs",
    source_file: basename(sourcePath),
    source_id: sourceId,
    source_sha256: sourceId.split(":")[1],
    counts: {
      editions: editions.length,
      text_units: textUnits.length,
      alignments: alignments.length,
      formulas: formulas.length,
      text_formula_links: textFormulaLinks.length
    }
  },
  editions,
  text_units: textUnits,
  alignments,
  formulas,
  text_formula_links: textFormulaLinks
};

await mkdir(resolve(outputPath, ".."), { recursive: true });
await writeFile(resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);

console.log(`版本: ${editions.length}`);
for (const edition of editions) {
  const count = textUnits.filter((unit) => unit.edition_id === edition.id).length;
  console.log(`${edition.name}: ${count} 条记录`);
}
console.log(`合计: ${textUnits.length} 条记录`);
console.log(`对照: ${alignments.length} 条关系`);
console.log(`方剂: ${formulas.length} 首，条方关联: ${textFormulaLinks.length} 条`);
console.log(`来源: ${sourceId}`);
