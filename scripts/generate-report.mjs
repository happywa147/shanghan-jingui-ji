#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { escapeHtml } from "../lib/html.mjs";

const importPath = process.argv[2] ?? "data/imported/liwengtang-shanghan.json";
const variantsPath = process.argv[3] ?? "data/imported/liwengtang-variants.json";
const outputPath = process.argv[4] ?? "docs/site/report.html";
const data = JSON.parse(await readFile(resolve(importPath), "utf8"));
const variantData = JSON.parse(await readFile(resolve(variantsPath), "utf8"));
const alignmentById = new Map(data.alignments.map((item) => [item.id, item]));

const rows = variantData.variants.map((variant) => {
  const alignment = alignmentById.get(variant.alignment_id);
  const sourceId = alignment.source_unit_ids.join(" + ");
  const targetId = alignment.target_unit_ids.join(" + ");
  const targetEdition = targetId.split(":")[1];
  const sourceHtml = variant.operations
    .filter((operation) => operation.type !== "insert")
    .map((operation) => operation.type === "delete"
      ? `<del>${escapeHtml(operation.text)}</del>`
      : escapeHtml(operation.text))
    .join("");
  const targetHtml = variant.operations
    .filter((operation) => operation.type !== "delete")
    .map((operation) => operation.type === "insert"
      ? `<ins>${escapeHtml(operation.text)}</ins>`
      : escapeHtml(operation.text))
    .join("");

  const confidence = typeof alignment.confidence === "number" && Number.isFinite(alignment.confidence) ? alignment.confidence : "未载";
  return `<article data-id="${escapeHtml(variant.alignment_id)}" data-edition="${escapeHtml(targetEdition)}" data-search="${escapeHtml(`${sourceId} ${targetId} ${variant.source_text} ${variant.target_text}`)}">
    <header><strong>${escapeHtml(sourceId)}</strong><span>↔</span><strong>${escapeHtml(targetId)}</strong><small>机器匹配信度 ${escapeHtml(confidence)}（0–1，未审核） · 原始字符编辑占比 ${(variant.difference_ratio * 100).toFixed(1)}%</small></header>
    <div class="texts"><section><h2>宋本</h2><p>${sourceHtml}</p></section><section><h2>${targetEdition === "guilin" ? "桂林古本" : "康平本"}</h2><p>${targetHtml}</p></section></div>
    <div class="review"><label>审核状态 <select class="status"><option value="unreviewed">未审核</option><option value="confirmed">确认对应</option><option value="rejected">否决对应</option><option value="needs_work">待进一步校勘</option></select></label><label>校勘备注 <textarea class="review-note" rows="2" placeholder="说明拆合、异文或医理影响"></textarea></label></div>
  </article>`;
}).join("\n");

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'">
<title>伤寒金匮集 · 三版对照</title><link rel="stylesheet" href="report.css"></head><body><a class="skip" href="#content">跳到主内容</a><main id="content" data-input-revision="${escapeHtml(data.manifest.source_sha256)}"><h1>伤寒金匮集 · 三版对照</h1><p class="note">红色为宋本删除候选，绿色为目标版本增文候选。机器生成，未经人工校勘。</p>
<p class="warning">公开页面仅展示历史文献的机器校勘候选，不构成医疗、诊断或用药建议。“来源整理文本”未经扫描影像逐字核对，不得称为底本原貌。</p>
<p class="privacy">审核草稿仅保存在当前浏览器，不代表已验证身份或服务端批准。共享设备请在导出后清除草稿。</p><nav aria-label="校勘筛选"><input id="reviewer" aria-label="审核者标识" placeholder="审核者标识（导出必填）"><select id="role" aria-label="审核角色"><option value="first_review">初审</option><option value="second_review">复审</option><option value="adjudicator">裁决</option></select><input id="query" aria-label="检索条文编号或来源整理文本" placeholder="检索编号或来源整理文本"><select id="edition" aria-label="目标版本"><option value="">全部版本</option><option value="guilin">桂林古本</option><option value="kangping">康平本</option></select><select id="review-filter" aria-label="审核状态"><option value="">全部审核状态</option><option value="unreviewed">未审核</option><option value="confirmed">确认对应</option><option value="rejected">否决对应</option><option value="needs_work">待进一步校勘</option></select><button type="button" id="next-unreviewed">下一条未审核</button><button type="button" id="export">导出审核</button><button type="button" id="clear">清除本地草稿</button></nav>
<div id="count" aria-live="polite"></div><div class="pagination" aria-label="分页"><button type="button" id="prev-page">上一页</button><span id="page-status" aria-live="polite"></span><button type="button" id="next-page">下一页</button></div>${rows}</main><script src="report.js" defer></script></body></html>`;

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), html);
console.log(`已生成: ${resolve(outputPath)}`);
