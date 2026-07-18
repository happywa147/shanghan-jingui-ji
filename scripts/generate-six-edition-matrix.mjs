#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = async (file) => JSON.parse(await readFile(resolve(file), "utf8"));
const catalog = await read("data/sources/edition-catalog.json");
const preflight = await read("data/review/collation-preflight.json");
const selected = catalog.works.flatMap((work) => work.editions.filter((edition) => edition.selected)
  .map((edition) => ({ ...edition, work_id: work.work_id })));
if (selected.length !== 6) throw new Error(`必须恰好选择六个主本，实际${selected.length}`);
const preflightByEdition = new Map(preflight.editions.map((edition) => [edition.edition_id, edition]));
const anchorsByWork = Object.groupBy(preflight.anchors, (anchor) => anchor.work_id);
const editions = selected.map((edition) => {
  const workflow = preflightByEdition.get(edition.edition_id);
  if (!workflow) throw new Error(`对校预审缺少版本: ${edition.edition_id}`);
  const anchors = anchorsByWork[edition.work_id] ?? [];
  const ownAnchors = anchors.filter((anchor) => anchor.edition_id === edition.edition_id || (
    edition.edition_id === "shanghan:zhaokaimei-1599" && anchor.edition_id === "shanghan_lun:song"));
  const verified = ownAnchors.filter((anchor) => anchor.image_locator.status === "verified").length;
  const blockingReasons = [...workflow.blocking_reasons];
  if (ownAnchors.length === 0) blockingReasons.push("尚未为该主本生成跨版本锚点候选");
  if (verified !== ownAnchors.length || ownAnchors.length === 0) blockingReasons.push("影像定位尚未逐条完成人工核验");
  return {
    edition_id: edition.edition_id, work_id: edition.work_id, selection_rank: edition.selection_rank,
    source: edition.source, license: edition.license, completeness: edition.completeness,
    image_quality: edition.image_quality, text_status: edition.text_status,
    ocr_state: workflow.ocr_layer.state, anchor_count: ownAnchors.length,
    image_verified_anchor_count: verified, gate_state: blockingReasons.length ? "blocked" : "ready",
    blocking_reasons: [...new Set(blockingReasons)]
  };
});
const verified = preflight.anchors.filter((anchor) => anchor.image_locator.status === "verified").length;
const basis = JSON.stringify({ catalog, preflight });
const output = {
  schema_version: 1, input_revision: createHash("sha256").update(basis).digest("hex"),
  generated_at: `${catalog.retrieved_at}T00:00:00.000Z`, generator: "scripts/generate-six-edition-matrix.mjs",
  summary: { selected_editions: 6, anchors: preflight.anchors.length, image_verified_anchors: verified,
    blocked_anchors: preflight.anchors.length - verified, release_state: editions.every((item) => item.gate_state === "ready") ? "ready" : "blocked" },
  editions
};
const target = resolve("data/review/six-edition-matrix.json");
const temporaryTarget = `${target}.${process.pid}.tmp`;
await writeFile(temporaryTarget, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporaryTarget, target);
console.log(`六版本矩阵：${verified}/${preflight.anchors.length}条影像定位已核验；发布状态 ${output.summary.release_state}`);
