#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { formulaDifferences, ingredientsEqual } from "../lib/formula-comparison.mjs";
import { safetyReviewMatches } from "../lib/medical-safety.mjs";

const inputPath = process.argv[2] ?? "data/imported/liwengtang-shanghan.json";
const outputPath = process.argv[3] ?? "data/imported/formula-variants.json";
const data = JSON.parse(await readFile(resolve(inputPath), "utf8"));
const formulasByEdition = Map.groupBy(data.formulas, (formula) => formula.edition_id);
const song = formulasByEdition.get("shanghan_lun:song") ?? [];

const comparisons = [];
for (const targetEdition of ["shanghan_lun:guilin", "shanghan_lun:kangping"]) {
  const targetByName = Map.groupBy(formulasByEdition.get(targetEdition) ?? [], (formula) => formula.name);
  for (const source of song) {
    const targets = targetByName.get(source.name) ?? [];
    if (targets.length !== 1) continue;
    const [target] = targets;
    const sameIngredients = ingredientsEqual(source.ingredients, target.ingredients);
    const usageEqual = (source.preparation_and_use ?? "") === (target.preparation_and_use ?? "");
    const differenceTypes = formulaDifferences(source, target);
    comparisons.push({
      id: `formula-comparison:${source.id}:${target.id}`,
      name: source.name,
      source_formula_id: source.id,
      target_formula_id: target.id,
      target_edition_id: targetEdition,
      source_ingredients: source.ingredients,
      target_ingredients: target.ingredients,
      source_preparation_and_use: source.preparation_and_use,
      target_preparation_and_use: target.preparation_and_use,
      source_review_status: source.review_status,
      target_review_status: target.review_status,
      safety_review_terms: [...new Set([...safetyReviewMatches(source), ...safetyReviewMatches(target)])],
      safety_review_status: "machine_screened_pending_expert_review",
      ingredients_equal: sameIngredients,
      preparation_and_use_equal: usageEqual,
      difference_types: differenceTypes,
      substantive_difference: differenceTypes.some((type) => type !== "usage_punctuation"),
      has_difference: differenceTypes.length > 0,
      review_status: "machine_candidate"
    });
  }
}

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), `${JSON.stringify({ comparisons }, null, 2)}\n`);
console.log(`同名方对照: ${comparisons.length}`);
console.log(`存在组成或煎服差异: ${comparisons.filter((item) => item.has_difference).length}`);
console.log(`其中非句读差异: ${comparisons.filter((item) => item.substantive_difference).length}`);
