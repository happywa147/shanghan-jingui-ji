#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const catalog = JSON.parse(await readFile(resolve("data/sources/edition-catalog.json"), "utf8"));
const esc = (value) => String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const works = catalog.works.map((work) => `<section><h2>${esc(work.title)}</h2><table><thead><tr><th>级别</th><th>版本</th><th>层级</th><th>完整度</th><th>影像</th><th>文本状态</th><th>风险</th></tr></thead><tbody>${work.editions.map((edition) => `<tr${edition.selected ? ' class="selected"' : ""}><td>${esc(edition.selected ? `首批${edition.selection_rank}` : "参校")}</td><td>${esc(edition.label)}</td><td>${esc(edition.layer)}</td><td>${esc(edition.completeness)}</td><td>${esc(edition.image_quality)}</td><td>${esc(edition.text_status)}</td><td>${esc(edition.risk)}</td></tr>`).join("\n")}</tbody></table></section>`).join("\n");
const count = catalog.works.reduce((sum, work) => sum + work.editions.length, 0);
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'"><title>伤寒金匮集 · 版本总目录</title><link rel="stylesheet" href="site.css"></head><body><main><p><a href="index.html">返回首页</a></p><h1>两书版本总目录</h1><p class="warning">“首批”表示进入对校框架，不等于已经校定。影像或来源门禁未通过的版本不能晋升黄金文本。</p><p>当前登记 ${count} 个版本组；同版分册和重复扫描不重复计数。</p>${works}</main></body></html>`;
await writeFile(resolve("docs/site/editions.html"), html);
console.log(`版本总目录网站页已生成：${count}个版本组`);
