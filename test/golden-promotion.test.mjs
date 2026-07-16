import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGoldenCandidate } from "../lib/golden-promotion.mjs";

const review = (reviewer_id, decision = "accept", proposed_relation_type = "approximate") => ({ reviewer_id, decision, proposed_relation_type });

test("双审一致后晋级黄金样本", () => {
  assert.deepEqual(evaluateGoldenCandidate({ first_review: review("a"), second_review: review("b") }), { state: "complete", status: "golden" });
});

test("同一人不得自审自复审", () => {
  assert.throws(() => evaluateGoldenCandidate({ first_review: review("a"), second_review: review("a") }), /同一人/);
});

test("双审分歧时必须独立裁决", () => {
  const candidate = { first_review: review("a"), second_review: review("b", "reject"), adjudication: review("c") };
  assert.deepEqual(evaluateGoldenCandidate(candidate), { state: "complete", status: "golden" });
  assert.throws(() => evaluateGoldenCandidate({ ...candidate, adjudication: review("a") }), /裁决者/);
});
