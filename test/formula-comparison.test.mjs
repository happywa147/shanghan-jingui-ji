import test from "node:test";
import assert from "node:assert/strict";
import { ingredientsEqual, normalizedIngredient } from "../lib/formula-comparison.mjs";

const ingredient = (substance, dose = null, preparation = null) => ({ substance, dose_original: dose, preparation });

test("方剂药味字段规范化保留原始剂量与炮制", () => {
  assert.equal(normalizedIngredient(ingredient("桂枝", "三兩", "去皮")), "桂枝|三兩|去皮");
});

test("相同药味顺序和字段判定相同", () => {
  assert.equal(ingredientsEqual([ingredient("桂枝", "三兩")], [ingredient("桂枝", "三兩")]), true);
});

test("剂量差异判定不同", () => {
  assert.equal(ingredientsEqual([ingredient("桂枝", "三兩")], [ingredient("桂枝", "二兩")]), false);
});

test("药味顺序差异判定不同", () => {
  assert.equal(ingredientsEqual([ingredient("桂枝"), ingredient("芍藥")], [ingredient("芍藥"), ingredient("桂枝")]), false);
});
