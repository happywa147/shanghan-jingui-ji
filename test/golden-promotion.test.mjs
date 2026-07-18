import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGoldenCandidate } from "../lib/golden-promotion.mjs";

const review = (reviewer_id, decision = "accept", proposed_relation_type = "approximate") => ({
  reviewer_id, decision, proposed_relation_type, evidence_refs: ["source:page-1"], reviewed_at: "2026-07-18T00:00:00Z"
});

test("双审一致后晋级黄金样本", () => {
  assert.deepEqual(evaluateGoldenCandidate({ first_review: review("a", "accept", "exact"), second_review: review("b", "accept", "exact") }), { state: "complete", status: "golden", reviewed_relation_type: "exact" });
});

test("启用身份注册表后拒绝伪造审核者和利益冲突", () => {
  const candidate = { alignment_id: "x1", first_review: review("a"), second_review: review("b") };
  assert.throws(() => evaluateGoldenCandidate(candidate, new Map()), /未通过/);
  const registry = new Map([
    ["a", { active: true, verified_at: "2026-07-17T00:00:00Z", roles: ["first_review"], conflict_alignment_ids: ["x1"] }],
    ["b", { active: true, verified_at: "2026-07-17T00:00:00Z", roles: ["second_review"], conflict_alignment_ids: [] }]
  ]);
  assert.throws(() => evaluateGoldenCandidate(candidate, registry), /利益冲突/);
});

test("同一人不得自审自复审", () => {
  assert.throws(() => evaluateGoldenCandidate({ first_review: review("a"), second_review: review("a") }), /同一人/);
});

test("双审分歧时必须独立裁决", () => {
  const candidate = { first_review: review("a"), second_review: review("b", "reject"), adjudication: review("c") };
  assert.deepEqual(evaluateGoldenCandidate(candidate), { state: "complete", status: "golden", reviewed_relation_type: "approximate" });
  assert.throws(() => evaluateGoldenCandidate({ ...candidate, adjudication: review("a") }), /裁决者/);
});

test("拒绝缺少证据或无效时间的审核", () => {
  assert.throws(() => evaluateGoldenCandidate({ first_review: { ...review("a"), evidence_refs: [] } }), /结构或证据/);
  assert.throws(() => evaluateGoldenCandidate({ first_review: { ...review("a"), reviewed_at: "invalid" } }), /结构或证据/);
});

test("裁决关系类型进入最终结果", () => {
  const candidate = { first_review: review("a", "accept", "exact"), second_review: review("b", "reject", "no_match"), adjudication: review("c", "accept", "related") };
  assert.equal(evaluateGoldenCandidate(candidate).reviewed_relation_type, "related");
});
