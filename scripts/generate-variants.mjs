#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { characterDiff } from "../lib/character-diff.mjs";

const importPath = process.argv[2] ?? "data/imported/liwengtang-shanghan.json";
const outputPath = process.argv[3] ?? "data/imported/liwengtang-variants.json";
const data = JSON.parse(await readFile(resolve(importPath), "utf8"));
const unitById = new Map(data.text_units.map((unit) => [unit.id, unit]));

const variants = data.alignments.map((alignment) => {
  const sourceText = alignment.source_unit_ids.map((id) => unitById.get(id).source_main_text ?? unitById.get(id).source_edited_text).join("\n");
  const targetText = alignment.target_unit_ids.map((id) => unitById.get(id).source_main_text ?? unitById.get(id).source_edited_text).join("\n");
  const operations = characterDiff(sourceText, targetText);
  const changed = operations
    .filter((operation) => operation.type !== "equal")
    .reduce((sum, operation) => sum + [...operation.text].length, 0);
  const total = [...sourceText].length + [...targetText].length;

  return {
    alignment_id: alignment.id,
    source_text: sourceText,
    target_text: targetText,
    operations,
    difference_ratio: total === 0 ? 0 : Number((changed / total).toFixed(6)),
    review_status: "machine_candidate"
  };
});

await writeFile(resolve(outputPath), `${JSON.stringify({ variants }, null, 2)}\n`);
console.log(`生成 ${variants.length} 条机器异文候选`);
console.log(`完全相同: ${variants.filter((variant) => variant.difference_ratio === 0).length}`);
console.log(`存在差异: ${variants.filter((variant) => variant.difference_ratio > 0).length}`);
