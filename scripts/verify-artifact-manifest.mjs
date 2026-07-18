#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const manifest = JSON.parse(await readFile(resolve("artifact-manifest.json"), "utf8"));
const errors = [];
const owners = new Map();
const requiredClasses = ["maintained_source", "reproducible_output", "release_evidence"];

for (const name of requiredClasses) {
  const group = manifest.classes?.[name];
  if (!group?.description || !Array.isArray(group.paths) || group.paths.length === 0) errors.push(`${name} 分类不完整`);
  for (const path of group?.paths ?? []) {
    if (owners.has(path)) errors.push(`${path} 同时属于 ${owners.get(path)} 和 ${name}`);
    owners.set(path, name);
  }
  for (const generator of group?.generators ?? []) {
    try { if (!(await stat(resolve(generator))).isFile()) errors.push(`${generator} 不是文件`); }
    catch { errors.push(`生成器不存在: ${generator}`); }
  }
}

const requiredOutputs = [
  "data/imported/formula-safety.json",
  "data/imported/jingui-wikisource.json",
  "data/review/golden-candidates.json",
  "data/review/collation-preflight.json",
  "docs/site/report*.html",
  "docs/site/formulas*.html",
  "docs/site/editions.html",
];
const outputs = new Set(manifest.classes?.reproducible_output?.paths ?? []);
for (const path of requiredOutputs) if (!outputs.has(path)) errors.push(`可重建产物未分类: ${path}`);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`生成物分类通过：${owners.size} 条规则，${requiredClasses.length} 类`);
}
