import test from "node:test";
import assert from "node:assert/strict";
import { safetyReviewMatches } from "../lib/medical-safety.mjs";

test("风险词扫描只生成人工复核候选", () => {
  assert.deepEqual(safetyReviewMatches({ ingredients: [{ substance: "生附子" }, { substance: "芫花" }, { substance: "甘草" }] }), ["附子", "芫花"]);
  assert.deepEqual(safetyReviewMatches({ ingredients: [{ substance: "桂枝" }] }), []);
  assert.deepEqual(safetyReviewMatches({ ingredients: [{ substance: "芜花" }] }), [], "不得把形近字当成芫花");
});
