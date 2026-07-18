#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { escapeHtml } from "../lib/html.mjs";
import { paginationHtml, writePaginatedFiles } from "../lib/static-pages.mjs";

const importPath = process.argv[2] ?? "data/imported/liwengtang-shanghan.json";
const variantsPath = process.argv[3] ?? "data/imported/liwengtang-variants.json";
const outputPath = resolve(process.argv[4] ?? "docs/site/report.html");
const goldenPath = process.argv[5] ?? "data/review/golden-candidates.json";
const pageSize = 50;
const data = JSON.parse(await readFile(resolve(importPath), "utf8"));
const variantData = JSON.parse(await readFile(resolve(variantsPath), "utf8"));
const goldenData = JSON.parse(await readFile(resolve(goldenPath), "utf8"));
const alignmentById = new Map(data.alignments.map((item) => [item.id, item]));
const goldenById = new Map(goldenData.candidates.map((item) => [item.alignment_id, item]));
const editionCounts = Object.groupBy(data.alignments, (item) => item.target_unit_ids[0]?.split(":")[1] ?? "unknown");

function gateStatus(candidate) {
  if (!candidate) return ["普通 AI 候选", "未进入黄金样本复审队列"];
  if (candidate.golden_status === "golden") return ["真人门禁已通过", "双审一致或独立裁决完成"];
  if (candidate.golden_status === "rejected") return ["真人门禁已驳回", "不作为黄金样本"];
  const state = {
    awaiting_first_review: "候选队列·待真人初审",
    awaiting_second_review: "候选队列·待独立复审",
    awaiting_adjudication: "争议状态·待第三人裁决",
  }[candidate.review_state] ?? "候选队列·状态未知";
  return [state, "未通过真人黄金样本门禁"];
}

function row(variant) {
  const alignment = alignmentById.get(variant.alignment_id);
  const sourceId = alignment.source_unit_ids.join(" + ");
  const targetId = alignment.target_unit_ids.join(" + ");
  const targetEdition = targetId.split(":")[1];
  const sourceHtml = variant.operations.filter((item) => item.type !== "insert").map((item) => item.type === "delete" ? `<del>${escapeHtml(item.text)}</del>` : escapeHtml(item.text)).join("");
  const targetHtml = variant.operations.filter((item) => item.type !== "delete").map((item) => item.type === "insert" ? `<ins>${escapeHtml(item.text)}</ins>` : escapeHtml(item.text)).join("");
  const confidence = typeof alignment.confidence === "number" && Number.isFinite(alignment.confidence) ? alignment.confidence : "未载";
  const [status, statusNote] = gateStatus(goldenById.get(variant.alignment_id));
  const citation = `《伤寒论》版本对读：${sourceId} ↔ ${targetId}，${status}，alignment ${variant.alignment_id}，数据修订 ${data.manifest.source_sha256}。`;
  return `<article id="${escapeHtml(variant.alignment_id)}" data-id="${escapeHtml(variant.alignment_id)}" data-edition="${escapeHtml(targetEdition)}" data-search="${escapeHtml(`${sourceId} ${targetId} ${variant.source_text} ${variant.target_text}`)}">
    <header><strong>${escapeHtml(sourceId)}</strong><span>↔</span><strong>${escapeHtml(targetId)}</strong><a class="permalink" href="#${escapeHtml(variant.alignment_id)}" aria-label="打开本条永久链接">本条链接</a><button type="button" class="copy-citation js-only" data-citation="${escapeHtml(citation)}">复制研究引用</button><small>机器匹配信度 ${escapeHtml(confidence)}（0–1，未审核） · 原始字符编辑占比 ${(variant.difference_ratio * 100).toFixed(1)}%</small></header>
    <p class="record-status"><strong>AI 处理状态：</strong>机器对应候选 · <strong>真人门禁状态：</strong>${escapeHtml(status)}<span>${escapeHtml(statusNote)}</span></p>
    <div class="texts"><section><h2>宋本</h2><p>${sourceHtml}</p></section><section><h2>${targetEdition === "guilin" ? "桂林古本" : "康平本"}</h2><p>${targetHtml}</p></section></div>
    <details class="evidence-chain"><summary>查看机器证据链</summary><dl><dt>对应记录</dt><dd>${escapeHtml(variant.alignment_id)}</dd><dt>文本单元</dt><dd>${escapeHtml(sourceId)} ↔ ${escapeHtml(targetId)}</dd><dt>导入修订</dt><dd>${escapeHtml(data.manifest.source_sha256)}</dd><dt>异文修订</dt><dd>${escapeHtml(variantData.manifest.variant_revision)}</dd><dt>差异算法</dt><dd>${escapeHtml(variantData.manifest.algorithm_version)}</dd></dl></details>
    <div class="review js-only"><label>本机审核草稿 <select class="status"><option value="unreviewed">未填写</option><option value="confirmed">草稿：建议确认对应</option><option value="rejected">草稿：建议否决对应</option><option value="needs_work">草稿：建议进一步校勘</option></select></label><label>校勘备注（最多4000字）<textarea class="review-note" maxlength="4000" rows="2" placeholder="说明拆合、异文或文献影响"></textarea></label><fieldset><legend>草稿证据引用（非“未填写”必填）</legend><label>来源ID<input class="evidence-source" maxlength="300" placeholder="如 scan:jingui-1"></label><label>页码或定位<input class="evidence-locator" maxlength="300" placeholder="如 p.12 / folio 6a"></label><label>证据网址（可选）<input class="evidence-url" type="url" maxlength="2000" placeholder="https://…"></label></fieldset></div>
  </article>`;
}

function documentHtml(rows, page, pages) {
  return `<!doctype html>
<html lang="zh-CN" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'">
<title>伤寒金匮集 · 三版对照 · 第${page}页</title><link rel="stylesheet" href="report.css"></head><body><a class="skip" href="#content">跳到主内容</a><main id="content" data-input-revision="${escapeHtml(data.manifest.source_sha256)}" data-page="${page}" data-pages="${pages}"><p><a href="index.html">返回首页</a></p><h1>伤寒金匮集 · 三版对照</h1><p class="note">本页展示第 ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, variantData.variants.length)} 条，共 ${variantData.variants.length} 条。红色为宋本删除候选，绿色为目标版本增文候选。</p>
<p class="warning">仅供历史文献研究，不构成医疗、诊断或用药建议。全部内容均为未经双人复核的机器候选，且未完成扫描影像逐字核对。</p>
<section class="version-matrix" aria-labelledby="matrix-title"><h2 id="matrix-title">当前版本对读矩阵</h2><table><thead><tr><th scope="col">来源版本</th><th scope="col">目标版本</th><th scope="col">机器对应数</th><th scope="col">真人黄金样本</th></tr></thead><tbody><tr><th scope="row">宋本</th><td>桂林古本</td><td>${editionCounts.guilin?.length ?? 0}</td><td>${goldenData.candidates.filter((item) => item.target_edition === "guilin" && item.golden_status === "golden").length}</td></tr><tr><th scope="row">宋本</th><td>康平本</td><td>${editionCounts.kangping?.length ?? 0}</td><td>${goldenData.candidates.filter((item) => item.target_edition === "kangping" && item.golden_status === "golden").length}</td></tr></tbody></table><p>矩阵只表示当前数据覆盖；“机器对应”不等于真人确认。</p></section>
<p class="privacy">审核草稿仅保存在当前浏览器90天，不代表身份验证或服务端批准。共享设备请在导出后清除。</p><noscript><p class="warning">JavaScript 已停用：正文与静态分页仍可阅读；筛选、草稿保存和导出不可用。</p></noscript>${paginationHtml(outputPath, page, pages)}
<nav class="tools js-only" aria-label="当前页校勘工具"><input id="reviewer" aria-label="审核者标识" maxlength="120" placeholder="审核者标识（导出必填）"><select id="role" aria-label="审核角色"><option value="first_review">初审</option><option value="second_review">复审</option><option value="adjudicator">裁决</option></select><input id="query" aria-label="检索当前页条文" placeholder="检索当前页编号或文本"><select id="edition" aria-label="目标版本"><option value="">全部版本</option><option value="guilin">桂林古本</option><option value="kangping">康平本</option></select><select id="review-filter" aria-label="审核状态"><option value="">全部审核状态</option><option value="unreviewed">未审核</option><option value="confirmed">确认对应</option><option value="rejected">否决对应</option><option value="needs_work">待进一步校勘</option></select><button type="button" id="next-unreviewed">下一条未审核</button><button type="button" id="export">导出审核</button><button type="button" id="clear">清除本地草稿</button></nav>
<div id="clear-confirm" class="confirm js-only" hidden><span id="clear-summary"></span><button type="button" id="clear-yes">确认清除</button><button type="button" id="clear-no">取消</button></div><div id="undo-bar" class="confirm js-only" hidden>草稿已清除。<button type="button" id="undo-clear">撤销</button></div><p id="save-status" class="js-only" role="status" aria-live="polite">尚无未保存更改</p><p id="count" class="js-only" aria-live="polite"></p>
${rows.join("\n")}${paginationHtml(outputPath, page, pages)}</main><script src="report.js" defer></script></body></html>`;
}

const pages = await writePaginatedFiles({
  items: variantData.variants,
  outputPath,
  pageSize,
  render: (items, page, totalPages) => documentHtml(items.map(row), page, totalPages),
});
console.log(`条文报告: ${pages} 页，每页最多 ${pageSize} 条`);
