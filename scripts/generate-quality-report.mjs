#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputPath = process.argv[2] ?? "data/imported/liwengtang-shanghan.json";
const outputPath = process.argv[3] ?? "dist/quality-report.json";
const data = JSON.parse(await readFile(resolve(inputPath), "utf8"));

const byEdition = Object.fromEntries(data.editions.map((edition) => {
  const units = data.text_units.filter((unit) => unit.edition_id === edition.id);
  const formulas = data.formulas.filter((formula) => formula.edition_id === edition.id);
  return [edition.id, {
    text_units: units.length,
    empty_chapter: units.filter((unit) => !unit.chapter).length,
    missing_received_number: units.filter((unit) => unit.received_number === null).length,
    formulas: formulas.length,
    formulas_without_ingredients: formulas.filter((formula) => formula.ingredients.length === 0).length
  }];
}));

const report = {
  generated_from_source: data.manifest.source_id,
  totals: {
    editions: data.editions.length,
    text_units: data.text_units.length,
    alignments: data.alignments.length,
    formulas: data.formulas.length,
    text_formula_links: data.text_formula_links.length
  },
  alignment_quality: {
    confidence_below_0_4: data.alignments.filter((item) => item.confidence !== null && item.confidence < 0.4).length,
    confidence_missing: data.alignments.filter((item) => item.confidence === null).length,
    imported_unreviewed: data.alignments.filter((item) => item.review_status === "imported").length
  },
  by_edition: byEdition
};

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`);
console.log(`质量报告: ${resolve(outputPath)}`);
console.log(JSON.stringify(report.totals));
