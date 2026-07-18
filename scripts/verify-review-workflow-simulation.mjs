#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { evaluateGoldenCandidate } from "../lib/golden-promotion.mjs";

const sha = (content) => createHash("sha256").update(content).digest("hex");
const atomicWrite = async (path, content) => {
  const target = resolve(path);
  const temporaryTarget = `${target}.${process.pid}.tmp`;
  await writeFile(temporaryTarget, content);
  await rename(temporaryTarget, target);
};
const inputs = [
  ["data/imported/liwengtang-shanghan.json", (value) => value.alignments.length],
  ["data/review/golden-candidates.json", (value) => value.candidates.length],
  ["data/review/collation-preflight.json", (value) => value.anchors.length]
];
const snapshots = [];
for (const [path, count] of inputs) {
  const content = await readFile(resolve(path), "utf8");
  snapshots.push({ path, sha256: sha(content), records: count(JSON.parse(content)), content });
}
const imported = JSON.parse(snapshots[0].content);
const golden = JSON.parse(snapshots[1].content);
const goldenBefore = snapshots[1].sha256;
const alignment = imported.alignments[0];
const work = await mkdtemp(join(tmpdir(), "shjj-review-simulation-"));
let blockReason = "";
try {
  const exportPath = join(work, "ai-review-export.json");
  const validatedPath = join(work, "validated-events.json");
  const reviewExport = {
    schema_version: 2, exported_at: "2026-07-18T00:00:00.000Z",
    input_revision: imported.manifest.source_sha256,
    reviewer: { id: "ai-agent-simulation", role: "first_review", identity_verified: false },
    reviews: { [alignment.id]: { status: "confirmed", note: "仅用于管线演练，不代表真人结论。", updated_at: "2026-07-18T00:00:00.000Z",
      evidence_refs: [{ source_id: imported.manifest.source_id, locator: alignment.id }] } }
  };
  await writeFile(exportPath, `${JSON.stringify(reviewExport, null, 2)}\n`);
  execFileSync(process.execPath, ["scripts/import-reviews.mjs", exportPath, "data/imported/liwengtang-shanghan.json", validatedPath], { cwd: resolve("."), stdio: "pipe" });
  const validated = JSON.parse(await readFile(validatedPath, "utf8"));
  if (validated.reviews.length !== 1 || validated.reviews[0].reviewer.identity_verified !== false) throw new Error("AI模拟审核导入结果异常");
  const simulationReview = (reviewerId) => ({ reviewer_id: reviewerId, decision: "accept", proposed_relation_type: alignment.relation_type,
    evidence_refs: [alignment.id], reviewed_at: "2026-07-18T00:00:00.000Z" });
  try {
    evaluateGoldenCandidate({ ...golden.candidates[0], first_review: simulationReview("ai-agent-simulation"), second_review: simulationReview("ai-agent-simulation-2") }, new Map());
    throw new Error("身份门禁未拒绝AI模拟审核");
  } catch (error) {
    if (!/审核者未通过有效身份/.test(error.message)) throw error;
    blockReason = error.message;
  }
  const goldenAfter = sha(await readFile(resolve("data/review/golden-candidates.json"), "utf8"));
  let rawInputsUnchanged = true;
  for (const snapshot of snapshots) {
    if (snapshot.sha256 !== sha(await readFile(resolve(snapshot.path), "utf8"))) rawInputsUnchanged = false;
  }
  const evidence = {
    schema_version: 1, generated_at: "2026-07-18T00:00:00.000Z", generator: "scripts/verify-review-workflow-simulation.mjs",
    inputs: snapshots.map(({ path, sha256, records }) => ({ path, sha256, records })),
    simulation: { reviewer_id: "ai-agent-simulation", identity_verified: false, exported_reviews: 1, imported_reviews: 1,
      promotion_attempted: true, promotion_blocked: true, block_reason: blockReason },
    invariants: { raw_inputs_unchanged: rawInputsUnchanged,
      golden_candidate_sha_before: goldenBefore, golden_candidate_sha_after: goldenAfter,
      simulated_human_fields_written: false, simulated_gold_records: 0 }, result: "PASS"
  };
  if (!evidence.invariants.raw_inputs_unchanged || goldenBefore !== goldenAfter) throw new Error("演练修改了权威输入");
  await atomicWrite("data/review/review-workflow-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);
  const report = `# 审核闭环演练证据\n\n- 结果：PASS\n- AI模拟审核：1条成功通过格式校验并进入待验证事件\n- 黄金晋级：被真人身份/角色注册表门禁拒绝\n- 原始黄金候选：SHA-256 前后一致\n- 模拟真人字段：0\n- 模拟黄金记录：0\n- 阻断原因：${blockReason}\n`;
  await atomicWrite("docs/review-workflow-evidence.md", report);
  console.log("审核闭环演练通过：AI记录可导入待验证事件，但无法晋级黄金");
} finally {
  await rm(work, { recursive: true, force: true });
}
