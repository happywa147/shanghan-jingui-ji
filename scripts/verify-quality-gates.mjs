#!/usr/bin/env node

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const imported = JSON.parse(await readFile(resolve("data/imported/liwengtang-shanghan.json"), "utf8"));
const formulas = JSON.parse(await readFile(resolve("data/imported/formula-variants.json"), "utf8"));
const golden = JSON.parse(await readFile(resolve("data/review/golden-candidates.json"), "utf8"));
const errors = [];

if (golden.candidates.length !== 50) errors.push(`黄金样本候选应为50条，实际${golden.candidates.length}`);
if (golden.input_revision !== imported.manifest.source_sha256) errors.push("黄金样本修订与导入数据不一致");
if (formulas.comparisons.some((item) => !Array.isArray(item.safety_review_terms) || item.safety_review_status !== "machine_screened_pending_expert_review")) {
  errors.push("方剂安全扫描字段不完整");
}
for (const path of ["docs/site/index.html", "docs/site/report.html", "docs/site/formulas.html"]) {
  const html = await readFile(resolve(path), "utf8");
  if (/<script(?![^>]*\bsrc=)[^>]*>/iu.test(html)) errors.push(`${path} 存在内联脚本`);
  if (/<style\b/iu.test(html) || /unsafe-inline/iu.test(html)) errors.push(`${path} CSP或样式仍允许内联内容`);
}
const reportBytes = (await stat(resolve("docs/site/report.html"))).size;
if (reportBytes > 1_500_000) errors.push(`条文报告超过1.5MB硬上限: ${reportBytes}`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`质量门禁通过：${imported.text_units.length}条文本，${formulas.comparisons.length}组方剂对照，${golden.candidates.length}条黄金候选`);
