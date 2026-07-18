#!/usr/bin/env node

import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const MAX_REVIEW_BYTES = 5 * 1024 * 1024;
const MAX_EXISTING_OUTPUT_BYTES = 25 * 1024 * 1024;

const reviewPath = process.argv[2];
const importPath = process.argv[3] ?? "data/imported/liwengtang-shanghan.json";
const outputPath = process.argv[4] ?? "data/imported/alignment-reviews-validated.json";
if (!reviewPath) {
  console.error("用法: node scripts/import-reviews.mjs <审核导出.json> [导入数据.json] [输出.json]");
  process.exit(1);
}

const absoluteReviewPath = resolve(reviewPath);
if ((await stat(absoluteReviewPath)).size > MAX_REVIEW_BYTES) throw new Error("审核导出文件超过5MB上限");
const reviewExport = JSON.parse(await readFile(absoluteReviewPath, "utf8"));
const imported = JSON.parse(await readFile(resolve(importPath), "utf8"));
const schema = JSON.parse(await readFile(resolve("schemas/review-export.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(reviewExport)) throw new Error(`审核导出Schema校验失败: ${ajv.errorsText(validate.errors, { separator: "; " })}`);
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
    evidence_refs: review.evidence_refs,
    updated_at: review.updated_at,
    imported_at: new Date().toISOString()
  });
}

validated.sort((a, b) => a.alignment_id.localeCompare(b.alignment_id));
let previous = { reviews: [], review_events: [] };
try {
  if ((await stat(resolve(outputPath))).size > MAX_EXISTING_OUTPUT_BYTES) throw new Error("既有审核事件文件超过25MB上限");
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
    evidence_refs: review.evidence_refs,
    updated_at: review.updated_at
  });
  return { event_id: createHash("sha256").update(canonical).digest("hex"), ...review };
}).filter((event) => !eventIds.has(event.event_id));
const reviewEvents = [...priorEvents, ...newEvents];
const absoluteOutputPath = resolve(outputPath);
const temporaryOutputPath = resolve(dirname(absoluteOutputPath), `.${randomUUID()}.tmp`);
const output = `${JSON.stringify({
  schema_version: 3,
  source_exported_at: reviewExport.exported_at,
  reviews: validated,
  review_events: reviewEvents
}, null, 2)}\n`;
try {
  await writeFile(temporaryOutputPath, output, { flag: "wx" });
  await rename(temporaryOutputPath, absoluteOutputPath);
} finally {
  await rm(temporaryOutputPath, { force: true });
}
console.log(`审核导入通过: ${validated.length} 条；新增事件: ${newEvents.length} 条；累计事件: ${reviewEvents.length} 条`);
