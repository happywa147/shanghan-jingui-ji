#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const importPath = process.argv[2] ?? "data/imported/liwengtang-shanghan.json";
const data = JSON.parse(await readFile(resolve(importPath), "utf8"));
const errors = [];

const unitIds = new Set();
for (const unit of data.text_units ?? []) {
  if (unitIds.has(unit.id)) errors.push(`文本单元 ID 重复: ${unit.id}`);
  unitIds.add(unit.id);
  if (!unit.source_edited_text) errors.push(`来源整理文本为空: ${unit.id}`);
}

const alignmentIds = new Set();
for (const alignment of data.alignments ?? []) {
  if (alignmentIds.has(alignment.id)) errors.push(`对照 ID 重复: ${alignment.id}`);
  alignmentIds.add(alignment.id);

  for (const id of [...alignment.source_unit_ids, ...alignment.target_unit_ids]) {
    if (!unitIds.has(id)) errors.push(`对照引用不存在的文本单元: ${alignment.id} -> ${id}`);
  }
  if (alignment.confidence !== null &&
      (alignment.confidence < 0 || alignment.confidence > 1)) {
    errors.push(`信度超出 0–1: ${alignment.id}`);
  }
}

const formulaIds = new Set();
for (const formula of data.formulas ?? []) {
  if (formulaIds.has(formula.id)) errors.push(`方剂 ID 重复: ${formula.id}`);
  formulaIds.add(formula.id);
  if (!formula.name) errors.push(`方名为空: ${formula.id}`);
  const sequences = formula.ingredients.map((ingredient) => ingredient.sequence);
  if (new Set(sequences).size !== sequences.length) errors.push(`药味次序重复: ${formula.id}`);
}

for (const link of data.text_formula_links ?? []) {
  if (!unitIds.has(link.text_unit_id)) errors.push(`条方关联引用不存在的条文: ${link.text_unit_id}`);
  if (!link.formula_id) errors.push(`条方关联未解析方名: ${link.text_unit_id} -> ${link.formula_name_raw}`);
  else if (!formulaIds.has(link.formula_id)) errors.push(`条方关联引用不存在的方剂: ${link.formula_id}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const countByTargetEdition = new Map();
for (const alignment of data.alignments ?? []) {
  const edition = alignment.target_unit_ids[0]?.split(":")[1] ?? "unmatched";
  countByTargetEdition.set(edition, (countByTargetEdition.get(edition) ?? 0) + 1);
}

console.log(`校验通过: ${unitIds.size} 个文本单元，${alignmentIds.size} 条对照关系`);
console.log(`方剂: ${formulaIds.size} 首，条方关联: ${(data.text_formula_links ?? []).length} 条`);
for (const [edition, count] of [...countByTargetEdition].sort()) {
  console.log(`${edition}: ${count}`);
}
