#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ingredientsEqual } from "../lib/formula-comparison.mjs";

const inputPath = process.argv[2] ?? "data/imported/liwengtang-shanghan.json";
const outputPath = process.argv[3] ?? "data/imported/formula-variants.json";
const data = JSON.parse(await readFile(resolve(inputPath), "utf8"));
const formulasByEdition = Map.groupBy(data.formulas, (formula) => formula.edition_id);
const song = formulasByEdition.get("shanghan_lun:song") ?? [];

const comparisons = [];
for (const targetEdition of ["shanghan_lun:guilin", "shanghan_lun:kangping"]) {
  const targetByName = new Map((formulasByEdition.get(targetEdition) ?? []).map((formula) => [formula.name, formula]));
  for (const source of song) {
    const target = targetByName.get(source.name);
    if (!target) continue;
    const sameIngredients = ingredientsEqual(source.ingredients, target.ingredients);
    const usageEqual = (source.preparation_and_use ?? "") === (target.preparation_and_use ?? "");
    comparisons.push({
      id: `formula-comparison:${source.id}:${target.id}`,
      name: source.name,
      source_formula_id: source.id,
      target_formula_id: target.id,
      target_edition_id: targetEdition,
      source_ingredients: source.ingredients,
      target_ingredients: target.ingredients,
      ingredients_equal: sameIngredients,
      preparation_and_use_equal: usageEqual,
      has_difference: !sameIngredients || !usageEqual,
      review_status: "machine_candidate"
    });
  }
}

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), `${JSON.stringify({ comparisons }, null, 2)}\n`);
console.log(`同名方对照: ${comparisons.length}`);
console.log(`存在组成或煎服差异: ${comparisons.filter((item) => item.has_difference).length}`);
