import test from "node:test";
import assert from "node:assert/strict";
import { formulaDifferences, ingredientsEqual, normalizedIngredient } from "../lib/formula-comparison.mjs";

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

test("煎服法只有标点差异时单独分类", () => {
  const source = { ingredients: [], preparation_and_use: "水七升，煮取三升。" };
  const target = { ingredients: [], preparation_and_use: "水七升。煮取三升" };
  assert.deepEqual(formulaDifferences(source, target), ["usage_punctuation"]);
});

test("方剂差异按药味、剂量和炮制分类", () => {
  const source = { ingredients: [{ substance: "桂枝", dose_original: "三两", preparation: "去皮" }] };
  const target = { ingredients: [{ substance: "肉桂", dose_original: "二两", preparation: null }] };
  assert.deepEqual(formulaDifferences(source, target), ["substance_or_order", "dose", "preparation"]);
});
