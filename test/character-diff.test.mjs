import test from "node:test";
import assert from "node:assert/strict";
import { characterDiff } from "../lib/character-diff.mjs";

test("相同文本只产生 equal", () => {
  assert.deepEqual(characterDiff("桂枝湯", "桂枝湯"), [{ type: "equal", text: "桂枝湯" }]);
});

test("识别中间增文", () => {
  assert.deepEqual(characterDiff("太陽病", "太陽之病"), [
    { type: "equal", text: "太陽" },
    { type: "insert", text: "之" },
    { type: "equal", text: "病" }
  ]);
});

test("识别替换为删除加插入", () => {
  assert.deepEqual(characterDiff("脈浮", "脈緩"), [
    { type: "equal", text: "脈" },
    { type: "delete", text: "浮" },
    { type: "insert", text: "緩" }
  ]);
});

test("按 Unicode 字符处理扩展汉字", () => {
  assert.deepEqual(characterDiff("𥆧動", "瞤動"), [
    { type: "delete", text: "𥆧" },
    { type: "insert", text: "瞤" },
    { type: "equal", text: "動" }
  ]);
});
