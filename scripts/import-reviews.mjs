#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const reviewPath = process.argv[2];
const importPath = process.argv[3] ?? "data/imported/liwengtang-shanghan.json";
const outputPath = process.argv[4] ?? "data/imported/alignment-reviews-validated.json";
if (!reviewPath) {
  console.error("用法: node scripts/import-reviews.mjs <审核导出.json> [导入数据.json] [输出.json]");
  process.exit(1);
}

const reviewExport = JSON.parse(await readFile(resolve(reviewPath), "utf8"));
const imported = JSON.parse(await readFile(resolve(importPath), "utf8"));
if (reviewExport.schema_version !== 2 || typeof reviewExport.reviews !== "object" ||
    !reviewExport.reviewer?.id || !["first_review", "second_review", "adjudicator"].includes(reviewExport.reviewer.role) ||
    typeof reviewExport.input_revision !== "string") {
  throw new Error("审核导出格式不受支持");
}
if (reviewExport.input_revision !== imported.manifest?.source_sha256) {
  throw new Error(`审核修订与当前数据不一致: ${reviewExport.input_revision}`);
}

const validAlignmentIds = new Set(imported.alignments.map((alignment) => alignment.id));
const allowedStatuses = new Set(["unreviewed", "confirmed", "rejected", "needs_work"]);
const validated = [];
for (const [alignmentId, review] of Object.entries(reviewExport.reviews)) {
  if (!validAlignmentIds.has(alignmentId)) throw new Error(`审核引用未知对照: ${alignmentId}`);
  if (!allowedStatuses.has(review.status)) throw new Error(`审核状态无效: ${alignmentId}`);
  if (typeof review.note !== "string") throw new Error(`审核备注不是字符串: ${alignmentId}`);
  if (Number.isNaN(Date.parse(review.updated_at))) throw new Error(`审核时间无效: ${alignmentId}`);
  validated.push({
    alignment_id: alignmentId,
    reviewer: reviewExport.reviewer,
    input_revision: reviewExport.input_revision,
    status: review.status,
    note: review.note,
    updated_at: review.updated_at,
    imported_at: new Date().toISOString()
  });
}

validated.sort((a, b) => a.alignment_id.localeCompare(b.alignment_id));
let previous = { reviews: [], review_events: [] };
try {
  previous = JSON.parse(await readFile(resolve(outputPath), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const priorEvents = previous.review_events ?? previous.reviews ?? [];
const eventIds = new Set(priorEvents.map((event) => event.event_id).filter(Boolean));
const newEvents = validated.map((review) => {
  const canonical = JSON.stringify({
    alignment_id: review.alignment_id,
    reviewer_id: review.reviewer.id,
    reviewer_role: review.reviewer.role,
    input_revision: review.input_revision,
    status: review.status,
    note: review.note,
    updated_at: review.updated_at
  });
  return { event_id: createHash("sha256").update(canonical).digest("hex"), ...review };
}).filter((event) => !eventIds.has(event.event_id));
const reviewEvents = [...priorEvents, ...newEvents];
await writeFile(resolve(outputPath), `${JSON.stringify({
  schema_version: 3,
  source_exported_at: reviewExport.exported_at,
  reviews: validated,
  review_events: reviewEvents
}, null, 2)}\n`);
console.log(`审核导入通过: ${validated.length} 条；新增事件: ${newEvents.length} 条；累计事件: ${reviewEvents.length} 条`);
