#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { safetyReviewMatches, safetyReviewTermsVersion } from "../lib/medical-safety.mjs";

const inputPath = resolve(process.argv[2] ?? "data/imported/liwengtang-shanghan.json");
const outputPath = resolve(process.argv[3] ?? "data/imported/formula-safety.json");
const data = JSON.parse(await readFile(inputPath, "utf8"));
const records = data.formulas.map((formula) => ({
  formula_id: formula.id,
  work_id: formula.work_id,
  edition_id: formula.edition_id,
  safety_review_terms: safetyReviewMatches(formula),
  safety_review_status: "machine_screened_pending_expert_review"
}));
const output = {
  manifest: {
    schema_version: 1,
    input_revision: data.manifest.source_sha256,
    generator: "scripts/generate-formula-safety.mjs",
    rules_version: safetyReviewTermsVersion,
    disclaimer: "机器召回只用于安排人工药学审核；未命中不代表安全，命中不是毒性结论。"
  },
  records
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`方剂安全扫描：${records.length} 条；风险词命中 ${records.filter((item) => item.safety_review_terms.length).length} 条`);
