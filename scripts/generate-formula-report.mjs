#!/usr/bin/env node

import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { escapeHtml as escape } from "../lib/html.mjs";

const comparisonPath = process.argv[2] ?? "data/imported/formula-variants.json";
const outputPath = resolve(process.argv[3] ?? "docs/site/formulas.html");
const importPath = process.argv[4] ?? "data/imported/liwengtang-shanghan.json";
const comparisons = JSON.parse(await readFile(resolve(comparisonPath), "utf8")).comparisons;
const imported = JSON.parse(await readFile(resolve(importPath), "utf8"));
const safetyPath = process.argv[5] ?? "data/imported/formula-safety.json";
const safetyData = JSON.parse(await readFile(resolve(safetyPath), "utf8"));
if (safetyData.manifest?.input_revision !== imported.manifest.source_sha256) throw new Error("方剂安全扫描修订与导入数据不一致");
const safetyByFormula = new Map(safetyData.records.map((item) => [item.formula_id, item]));
if (safetyByFormula.size !== imported.formulas.length) throw new Error("方剂安全扫描未唯一覆盖全部方剂");
const pageSize = 50;
const outputDir = dirname(outputPath);
const stem = basename(outputPath, extname(outputPath));
const pageName = (page) => page === 1 ? `${stem}.html` : `${stem}-${page}.html`;
const comparisonsByFormula = new Map();
for (const comparison of comparisons) for (const id of [comparison.source_formula_id, comparison.target_formula_id]) {
  const list = comparisonsByFormula.get(id) ?? [];
  list.push(comparison);
  comparisonsByFormula.set(id, list);
}
const ingredients = (items) => items.map((item) => `<li>${escape(item.substance)} <span>${escape(item.dose_original ?? "未载")} ${escape(item.preparation ?? "")}</span></li>`).join("");

function row(formula) {
  const safety = safetyByFormula.get(formula.id);
  if (!safety) throw new Error(`方剂缺少安全扫描记录: ${formula.id}`);
  const matches = safety.safety_review_terms;
  const linked = comparisonsByFormula.get(formula.id) ?? [];
  const hasDifference = linked.some((item) => item.has_difference);
  const comparisonText = linked.length ? `参与 ${linked.length} 组机器同名方对照；${hasDifference ? "检出字段差异候选" : "本次机器比较未检出字段差异"}` : "未形成唯一同名方对照，已列入人工配对复核";
  return `<article id="${escape(formula.id)}" data-edition="${escape(formula.edition_id)}" data-different="${hasDifference}" data-paired="${linked.length > 0}" data-search="${escape(`${formula.name} ${formula.id}`)}"><header><h2>${escape(formula.name)}</h2><a class="permalink" href="#${escape(formula.id)}" aria-label="打开本方永久链接">本方链接</a><small>${escape(formula.edition_id)} · ${escape(comparisonText)}</small></header>
  <p class="item-warning">历史文献记录，不可据此配制或服用；未经专业药学复核。${matches.length ? `机器风险词命中：${matches.map(escape).join("、")}。命中不是毒性定论。` : "机器风险词未命中；未命中不代表安全。"}</p>
  <section><h3>原始字段</h3><ol>${ingredients(formula.ingredients)}</ol><h4>煎服法</h4><p>${escape(formula.preparation_and_use) || "未载"}</p></section><footer>数据状态：${escape(formula.review_status)}；安全扫描：${escape(safety.safety_review_status)}；规则版本：${escape(safetyData.manifest.rules_version)}</footer></article>`;
}

function pagination(page, pages) {
  return `<nav class="page-links" aria-label="静态分页">${page > 1 ? `<a href="${pageName(page - 1)}">上一页</a>` : "<span>上一页</span>"}<strong>第 ${page} / ${pages} 页</strong>${page < pages ? `<a href="${pageName(page + 1)}">下一页</a>` : "<span>下一页</span>"}</nav>`;
}

function html(rows, page, pages) {
  return `<!doctype html><html lang="zh-CN" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'"><title>伤寒金匮集 · 方剂记录 · 第${page}页</title><link rel="stylesheet" href="formulas.css"></head><body><a class="skip" href="#content">跳到主内容</a><main id="content"><p><a href="index.html">返回首页</a></p><h1>伤寒金匮集 · 方剂记录</h1><p class="warning">仅供历史文献研究，不提供诊断、处方或用药建议。古代药名、剂量、炮制及煎服法不可直接换算或照用。</p><p class="note">全库525条版本方剂均接受机器安全词召回并公开待审状态；是否形成同名对照不影响安全扫描。本页 ${rows.length} 条。</p><noscript><p class="warning">JavaScript 已停用：方剂记录和静态分页仍可阅读；当前页筛选不可用。</p></noscript>${pagination(page, pages)}<nav class="tools js-only" aria-label="当前页方剂筛选"><input id="q" aria-label="检索当前页方名" placeholder="检索当前页方名"><select id="edition" aria-label="版本"><option value="">全部版本</option><option value="shanghan_lun:song">宋本</option><option value="shanghan_lun:guilin">桂林古本</option><option value="shanghan_lun:kangping">康平本</option></select><select id="paired" aria-label="配对状态"><option value="">全部</option><option value="true">已形成同名对照</option><option value="false">待人工配对</option></select></nav><p id="count" class="js-only" aria-live="polite"></p>${rows.join("\n")}${pagination(page, pages)}</main><script src="formulas.js" defer></script></body></html>`;
}

await mkdir(outputDir, { recursive: true });
for (const file of await readdir(outputDir)) if (new RegExp(`^${stem}-\\d+\\.html$`).test(file)) await unlink(resolve(outputDir, file));
const pages = Math.ceil(imported.formulas.length / pageSize);
for (let page = 1; page <= pages; page++) {
  const rows = imported.formulas.slice((page - 1) * pageSize, page * pageSize).map(row);
  await writeFile(resolve(outputDir, pageName(page)), html(rows, page, pages));
}
console.log(`方剂报告: ${imported.formulas.length} 条，${pages} 页，每页最多 ${pageSize} 条`);
