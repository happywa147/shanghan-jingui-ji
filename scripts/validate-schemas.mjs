#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const data = JSON.parse(await readFile(resolve(process.argv[2] ?? "data/imported/liwengtang-shanghan.json"), "utf8"));
const variants = JSON.parse(await readFile(resolve(process.argv[3] ?? "data/imported/liwengtang-variants.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const checks = [
  ["schemas/text-unit.schema.json", data.text_units],
  ["schemas/alignment.schema.json", data.alignments],
  ["schemas/formula.schema.json", data.formulas],
  ["schemas/variant.schema.json", variants.variants]
];
let failures = 0;
for (const [schemaPath, records] of checks) {
  const schema = JSON.parse(await readFile(resolve(schemaPath), "utf8"));
  const validate = ajv.compile(schema);
  for (const record of records ?? []) {
    if (validate(record)) continue;
    failures++;
    console.error(`${schemaPath}: ${record.id ?? record.alignment_id ?? "unknown"}`);
    console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
  }
}
if (failures) process.exit(1);
console.log(`Schema 校验通过：${checks.reduce((sum, [, records]) => sum + records.length, 0)} 条记录`);
