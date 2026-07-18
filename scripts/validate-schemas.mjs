#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const data = JSON.parse(await readFile(resolve(process.argv[2] ?? "data/imported/liwengtang-shanghan.json"), "utf8"));
const variants = JSON.parse(await readFile(resolve(process.argv[3] ?? "data/imported/liwengtang-variants.json"), "utf8"));
const goldenCandidates = JSON.parse(await readFile(resolve(process.argv[4] ?? "data/review/golden-candidates.json"), "utf8"));
const formulaSafety = JSON.parse(await readFile(resolve(process.argv[5] ?? "data/imported/formula-safety.json"), "utf8"));
const collationPreflight = JSON.parse(await readFile(resolve(process.argv[6] ?? "data/review/collation-preflight.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

for (const schemaPath of ["schemas/text-unit.schema.json", "schemas/alignment.schema.json", "schemas/formula.schema.json"]) {
  ajv.addSchema(JSON.parse(await readFile(resolve(schemaPath), "utf8")));
}
ajv.addSchema(JSON.parse(await readFile(resolve("schemas/variant.schema.json"), "utf8")));
ajv.addSchema(JSON.parse(await readFile(resolve("schemas/golden-candidate.schema.json"), "utf8")));
const variantPackageSchema = JSON.parse(await readFile(resolve("schemas/variant-package.schema.json"), "utf8"));
const validateVariantPackage = ajv.compile(variantPackageSchema);
if (!validateVariantPackage(variants)) {
  console.error("异文派生数据包根结构校验失败");
  console.error(ajv.errorsText(validateVariantPackage.errors, { separator: "\n" }));
  process.exit(1);
}
const formulaSafetySchema = JSON.parse(await readFile(resolve("schemas/formula-safety-package.schema.json"), "utf8"));
const validateFormulaSafety = ajv.compile(formulaSafetySchema);
if (!validateFormulaSafety(formulaSafety)) {
  console.error("方剂安全数据包根结构校验失败");
  console.error(ajv.errorsText(validateFormulaSafety.errors, { separator: "\n" }));
  process.exit(1);
}
const goldenPackageSchema = JSON.parse(await readFile(resolve("schemas/golden-package.schema.json"), "utf8"));
const validateGoldenPackage = ajv.compile(goldenPackageSchema);
if (!validateGoldenPackage(goldenCandidates)) {
  console.error("黄金样本候选包根结构校验失败");
  console.error(ajv.errorsText(validateGoldenPackage.errors, { separator: "\n" }));
  process.exit(1);
}
const collationPreflightSchema = JSON.parse(await readFile(resolve("schemas/collation-preflight.schema.json"), "utf8"));
const validateCollationPreflight = ajv.compile(collationPreflightSchema);
if (!validateCollationPreflight(collationPreflight)) {
  console.error("六主本对校预审包根结构校验失败");
  console.error(ajv.errorsText(validateCollationPreflight.errors, { separator: "\n" }));
  process.exit(1);
}
const packageSchema = JSON.parse(await readFile(resolve("schemas/import-package.schema.json"), "utf8"));
const validatePackage = ajv.compile(packageSchema);
if (!validatePackage(data)) {
  console.error("导入数据包根结构校验失败");
  console.error(ajv.errorsText(validatePackage.errors, { separator: "\n" }));
  process.exit(1);
}

const checks = [
  ["schemas/text-unit.schema.json", data.text_units],
  ["schemas/alignment.schema.json", data.alignments],
  ["schemas/formula.schema.json", data.formulas],
  ["schemas/variant.schema.json", variants.variants],
  ["schemas/golden-candidate.schema.json", goldenCandidates.candidates]
];
let failures = 0;
for (const [schemaPath, records] of checks) {
  const schema = JSON.parse(await readFile(resolve(schemaPath), "utf8"));
  const validate = ajv.getSchema(schema.$id) ?? ajv.compile(schema);
  for (const record of records ?? []) {
    if (validate(record)) continue;
    failures++;
    console.error(`${schemaPath}: ${record.id ?? record.alignment_id ?? "unknown"}`);
    console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
  }
}
if (failures) process.exit(1);
console.log(`Schema 校验通过：${checks.reduce((sum, [, records]) => sum + records.length, 0)} 条记录`);
