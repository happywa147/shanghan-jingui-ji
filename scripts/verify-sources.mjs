#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { resolveInside } from "../lib/safe-path.mjs";

const manifestPath = process.argv[2] ?? "data/sources/jingui-sibu.json";
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const errors = [];
const requiredManifestFields = ["source_id", "work_id", "edition_id", "title", "license", "retrieved_at", "files"];
for (const field of requiredManifestFields) {
  if (!manifest[field] || (Array.isArray(manifest[field]) && manifest[field].length === 0)) {
    errors.push(`来源清单缺少字段: ${field}`);
  }
}
if (manifest.retrieved_at && Number.isNaN(Date.parse(manifest.retrieved_at))) errors.push("获取日期无效");

const localPaths = new Set();

for (const file of manifest.files ?? []) {
  if (localPaths.has(file.local_path)) errors.push(`来源文件路径重复: ${file.local_path}`);
  localPaths.add(file.local_path);
  if (!file.source_url?.startsWith("https://")) errors.push(`来源页面不是 HTTPS: ${file.local_path}`);
  if (!file.download_url?.startsWith("https://")) errors.push(`下载地址不是 HTTPS: ${file.local_path}`);
  if (!Number.isInteger(file.pages) || file.pages < 1) errors.push(`页数登记无效: ${file.local_path}`);
  if (!Number.isInteger(file.bytes) || file.bytes < 1) errors.push(`文件尺寸登记无效: ${file.local_path}`);
  if (!/^[a-f0-9]{64}$/.test(file.sha256 ?? "")) errors.push(`SHA-256 格式无效: ${file.local_path}`);
  let path;
  try { path = resolveInside("data/raw", file.local_path); }
  catch (error) { errors.push(error.message); continue; }
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
