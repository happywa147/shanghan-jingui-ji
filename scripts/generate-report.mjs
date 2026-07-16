#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const importPath = process.argv[2] ?? "data/imported/liwengtang-shanghan.json";
const variantsPath = process.argv[3] ?? "data/imported/liwengtang-variants.json";
const outputPath = process.argv[4] ?? "dist/report.html";
const data = JSON.parse(await readFile(resolve(importPath), "utf8"));
const variantData = JSON.parse(await readFile(resolve(variantsPath), "utf8"));
const alignmentById = new Map(data.alignments.map((item) => [item.id, item]));

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

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

  return `<article data-id="${escapeHtml(variant.alignment_id)}" data-edition="${targetEdition}" data-search="${escapeHtml(`${sourceId} ${targetId} ${variant.source_text} ${variant.target_text}`)}">
    <header><strong>${escapeHtml(sourceId)}</strong><span>↔</span><strong>${escapeHtml(targetId)}</strong><small>信度 ${alignment.confidence ?? "未载"} · 差异率 ${(variant.difference_ratio * 100).toFixed(1)}%</small></header>
    <div class="texts"><section><h2>宋本</h2><p>${sourceHtml}</p></section><section><h2>${targetEdition === "guilin" ? "桂林古本" : "康平本"}</h2><p>${targetHtml}</p></section></div>
    <div class="review"><label>审核状态 <select class="status"><option value="unreviewed">未审核</option><option value="confirmed">确认对应</option><option value="rejected">否决对应</option><option value="needs_work">待进一步校勘</option></select></label><label>校勘备注 <textarea class="review-note" rows="2" placeholder="说明拆合、异文或医理影响"></textarea></label></div>
  </article>`;
}).join("\n");

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<title>伤寒金匮集 · 三版对照</title>
<style>
body{margin:0;background:#f5f1e8;color:#29251f;font-family:serif}main{max-width:1180px;margin:auto;padding:32px 20px}h1{margin-bottom:6px}.note{color:#716858}nav{position:sticky;top:0;background:#f5f1e8;padding:12px 0;display:flex;gap:10px;z-index:2}input,select,textarea,button{padding:9px;border:1px solid #b9ae9b;background:#fffdf8}input{flex:1}button{cursor:pointer}article{background:#fffdf8;border:1px solid #d8cebd;margin:16px 0;padding:18px}article[data-review="confirmed"]{border-left:5px solid #438650}article[data-review="rejected"]{border-left:5px solid #a8463b}header{display:flex;gap:12px;align-items:center;flex-wrap:wrap}small{margin-left:auto;color:#716858}.texts{display:grid;grid-template-columns:1fr 1fr;gap:18px}.texts section+section{border-left:1px solid #ddd2c1;padding-left:18px}h2{font-size:15px;color:#75664e}p{font-size:18px;line-height:1.9;white-space:pre-wrap}del{background:#f5caca;color:#812323}ins{background:#cfe8cf;color:#175b29;text-decoration:none}.review{border-top:1px solid #ddd2c1;padding-top:12px;display:grid;grid-template-columns:220px 1fr;gap:12px}.review label{display:flex;flex-direction:column;gap:5px}.review textarea{resize:vertical}@media(max-width:700px){.texts,.review{grid-template-columns:1fr}.texts section+section{border-left:0;border-top:1px solid #ddd2c1;padding:10px 0 0}small{margin-left:0}}
</style></head><body><main><h1>伤寒金匮集 · 三版对照</h1><p class="note">红色为宋本删除候选，绿色为目标版本增文候选。机器生成，未经人工校勘。</p>
<nav aria-label="校勘筛选"><input id="query" aria-label="检索条文编号或原文" placeholder="检索条文编号或原文"><select id="edition" aria-label="目标版本"><option value="">全部版本</option><option value="guilin">桂林古本</option><option value="kangping">康平本</option></select><select id="review-filter" aria-label="审核状态"><option value="">全部审核状态</option><option value="unreviewed">未审核</option><option value="confirmed">确认对应</option><option value="rejected">否决对应</option><option value="needs_work">待进一步校勘</option></select><button type="button" id="next-unreviewed">下一条未审核</button><button type="button" id="export">导出审核</button></nav>
<div id="count" aria-live="polite"></div>${rows}</main><script>
const key='shanghan-jingui-ji:alignment-reviews:v1',articles=[...document.querySelectorAll('article')],query=document.querySelector('#query'),edition=document.querySelector('#edition'),reviewFilter=document.querySelector('#review-filter'),count=document.querySelector('#count');let reviews={};try{reviews=JSON.parse(localStorage.getItem(key)||'{}')}catch{localStorage.removeItem(key)}
function save(){localStorage.setItem(key,JSON.stringify(reviews))}function apply(item){const review=reviews[item.dataset.id]||{status:'unreviewed',note:''};item.querySelector('.status').value=review.status;item.querySelector('.review-note').value=review.note;item.dataset.review=review.status}
for(const item of articles){apply(item);item.querySelector('.status').addEventListener('change',event=>{const current=reviews[item.dataset.id]||{};reviews[item.dataset.id]={status:event.target.value,note:current.note||'',updated_at:new Date().toISOString()};save();apply(item);filter()});item.querySelector('.review-note').addEventListener('change',event=>{const current=reviews[item.dataset.id]||{};reviews[item.dataset.id]={status:current.status||'unreviewed',note:event.target.value,updated_at:new Date().toISOString()};save()})}
function filter(){const q=query.value.trim().toLowerCase(),e=edition.value,r=reviewFilter.value;let shown=0;const stats={unreviewed:0,confirmed:0,rejected:0,needs_work:0};for(const item of articles){stats[item.dataset.review]++;const visible=(!e||item.dataset.edition===e)&&(!r||item.dataset.review===r)&&(!q||item.dataset.search.toLowerCase().includes(q));item.hidden=!visible;if(visible)shown++}count.textContent='显示 '+shown+' / '+articles.length+'；已确认 '+stats.confirmed+'，已否决 '+stats.rejected+'，待校 '+stats.needs_work+'，未审核 '+stats.unreviewed}
document.querySelector('#export').addEventListener('click',()=>{const payload={schema_version:1,exported_at:new Date().toISOString(),reviews};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='伤寒金匮集-对照审核.json';link.click();URL.revokeObjectURL(link.href)});
document.querySelector('#next-unreviewed').addEventListener('click',()=>{const current=articles.findIndex(item=>item.contains(document.activeElement)||item.getBoundingClientRect().top>=0);const ordered=[...articles.slice(current+1),...articles.slice(0,current+1)];const next=ordered.find(item=>item.dataset.review==='unreviewed');if(next){next.hidden=false;next.scrollIntoView({behavior:'smooth',block:'start'});next.querySelector('.status').focus()}});
query.addEventListener('input',filter);edition.addEventListener('change',filter);reviewFilter.addEventListener('change',filter);filter();
</script></body></html>`;

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), html);
console.log(`已生成: ${resolve(outputPath)}`);
