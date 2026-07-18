#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { datasetIntegrityErrors } from "../lib/dataset-integrity.mjs";

const path = resolve(process.argv[2] ?? "data/imported/liwengtang-shanghan.json");
const data = JSON.parse(await readFile(path, "utf8"));
const errors = datasetIntegrityErrors(data);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`数据关系校验通过：${data.editions.length}版本，${data.text_units.length}文本，${data.alignments.length}对应关系，${data.formulas.length}方剂，${data.text_formula_links.length}链接`);
