#!/usr/bin/env node

import { basename, resolve } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const args = process.argv.slice(2);
const manifestFlag = args.indexOf("--manifest");
const manifestPath = manifestFlag === -1 ? "data/sources/jingui-sibu.json" : args[manifestFlag + 1];
if (manifestFlag !== -1) args.splice(manifestFlag, 2);
if (!args.length) {
  console.error("用法: node scripts/verify-ocr.mjs <OCR.json> [...] [--manifest <来源清单.json>]");
  process.exit(1);
}

const sourceManifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const expectedByName = new Map();
for (const file of sourceManifest.files) {
  const name = basename(file.local_path);
  if (expectedByName.has(name)) throw new Error(`来源清单存在重复文件名，OCR无法唯一绑定: ${name}`);
  expectedByName.set(name, file);
}
const schema = JSON.parse(await readFile(resolve("schemas/ocr-package.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const coverageBySource = new Map();
let totalPages = 0;
let emptyPages = 0;
let hanCharacters = 0;
let locallyVerifiedSources = 0;
let unavailableSources = 0;

for (const expected of expectedByName.values()) {
  try {
    const sourcePath = resolve(expected.local_path);
    const sourceStat = await stat(sourcePath);
    const sourceHash = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
    if (sourceStat.size !== expected.bytes || sourceHash !== expected.sha256) throw new Error(`当前本地来源文件与清单不一致: ${expected.local_path}`);
    locallyVerifiedSources++;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    unavailableSources++;
  }
}

for (const path of args) {
  const data = JSON.parse(await readFile(resolve(path), "utf8"));
  if (!validate(data)) throw new Error(`${path} OCR Schema校验失败: ${ajv.errorsText(validate.errors, { separator: "; " })}`);
  const expected = expectedByName.get(data.source_file);
  if (!expected) throw new Error(`${path} 引用了未登记的来源文件: ${data.source_file}`);
  if (data.source_sha256 !== expected.sha256) throw new Error(`${path} 来源SHA-256与清单不一致`);
  if (data.source_bytes !== expected.bytes) throw new Error(`${path} 来源文件尺寸与清单不一致`);
  if (data.page_count !== expected.pages) throw new Error(`${path} 来源总页数与清单不一致`);
  const [start, end] = data.processed_range;
  if (start > end || end > data.page_count) throw new Error(`${path} processed_range越界`);
  if (data.pages.length !== end - start + 1) throw new Error(`${path} processed_range与页数不一致`);
  const coverage = coverageBySource.get(data.source_file) ?? new Set();
  for (const page of data.pages) {
    if (page.source_file !== data.source_file) throw new Error(`${path} OCR页引用错册: ${page.page}`);
    if (page.page < start || page.page > end || page.page > data.page_count) throw new Error(`${path} OCR页码越界: ${page.page}`);
    if (coverage.has(page.page)) throw new Error(`${data.source_file} OCR页码重复: ${page.page}`);
    coverage.add(page.page);
    totalPages++;
    if (!page.text.trim()) emptyPages++;
    hanCharacters += (page.text.match(/\p{Script=Han}/gu) ?? []).length;
  }
  coverageBySource.set(data.source_file, coverage);
}

for (const [sourceFile, pages] of coverageBySource) {
  const expectedPages = expectedByName.get(sourceFile).pages;
  if (pages.size !== expectedPages) throw new Error(`${sourceFile} OCR覆盖不完整: ${pages.size}/${expectedPages}`);
  for (let page = 1; page <= expectedPages; page++) {
    if (!pages.has(page)) throw new Error(`${sourceFile} OCR缺页: ${page}`);
  }
}

const emptyRatio = totalPages ? emptyPages / totalPages : 1;
console.log(`OCR页数: ${totalPages}`);
console.log(`空白页: ${emptyPages} (${(emptyRatio * 100).toFixed(1)}%)`);
console.log(`汉字候选: ${hanCharacters}`);
console.log(`本地来源实物复核: ${locallyVerifiedSources}；仅清单绑定: ${unavailableSources}`);
if (emptyRatio > 0.35) throw new Error("OCR 空白页比例超过 35% 质量门槛");
if (hanCharacters < totalPages * 20) throw new Error("平均每页汉字不足 20，未通过质量门槛");
