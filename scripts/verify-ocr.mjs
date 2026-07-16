#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const paths = process.argv.slice(2);
if (!paths.length) {
  console.error("用法: node scripts/verify-ocr.mjs <OCR.json> [...]");
  process.exit(1);
}

let totalPages = 0;
let emptyPages = 0;
let hanCharacters = 0;
for (const path of paths) {
  const data = JSON.parse(await readFile(resolve(path), "utf8"));
  const seen = new Set();
  for (const page of data.pages) {
    if (seen.has(page.page)) throw new Error(`${path} 页码重复: ${page.page}`);
    seen.add(page.page);
    totalPages++;
    if (!page.text.trim()) emptyPages++;
    hanCharacters += (page.text.match(/\p{Script=Han}/gu) ?? []).length;
  }
}

const emptyRatio = totalPages ? emptyPages / totalPages : 1;
console.log(`OCR 页数: ${totalPages}`);
console.log(`空白页: ${emptyPages} (${(emptyRatio * 100).toFixed(1)}%)`);
console.log(`汉字候选: ${hanCharacters}`);
if (emptyRatio > 0.35) throw new Error("OCR 空白页比例超过 35% 质量门槛");
if (hanCharacters < totalPages * 20) throw new Error("平均每页汉字不足 20，未通过质量门槛");
