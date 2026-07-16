#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const manifestPath = process.argv[2] ?? "data/sources/jingui-sibu.json";
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const errors = [];

for (const file of manifest.files) {
  const path = resolve(file.local_path);
  const info = await stat(path);
  const buffer = await readFile(path);
  const hash = createHash("sha256").update(buffer).digest("hex");
  let pages = null;
  try {
    pages = Number(execFileSync("djvused", [path, "-e", "n"], { encoding: "utf8" }).trim());
  } catch {
    errors.push(`无法读取 DjVu 页数: ${file.local_path}`);
  }
  if (info.size !== file.bytes) errors.push(`文件尺寸不符: ${file.local_path}`);
  if (hash !== file.sha256) errors.push(`SHA-256 不符: ${file.local_path}`);
  if (pages !== file.pages) errors.push(`页数不符: ${file.local_path}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`来源校验通过: ${manifest.files.length} 册，共 ${manifest.files.reduce((sum, file) => sum + file.pages, 0)} 页`);
