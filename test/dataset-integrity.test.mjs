import test from "node:test";
import assert from "node:assert/strict";
import { datasetIntegrityErrors } from "../lib/dataset-integrity.mjs";

function validDataset() {
  return {
    manifest: { counts: { editions: 1, text_units: 1, alignments: 1, formulas: 1, text_formula_links: 1 } },
    editions: [{ id: "edition:1", work_id: "shanghan_lun", source_id: "source:1" }],
    text_units: [{ id: "unit:1", edition_id: "edition:1", work_id: "shanghan_lun", source_id: "source:1" }],
    alignments: [{ id: "alignment:1", work_id: "shanghan_lun", source_unit_ids: ["unit:1"], target_unit_ids: [] }],
    formulas: [{ id: "formula:1", edition_id: "edition:1", work_id: "shanghan_lun", source_id: "source:1", ingredients: [{ sequence: 1 }] }],
    text_formula_links: [{ text_unit_id: "unit:1", formula_id: "formula:1" }]
  };
}

test("完整数据集通过关系校验", () => {
  assert.deepEqual(datasetIntegrityErrors(validDataset()), []);
});

test("拒绝悬空引用、重复 ID 和伪造计数", () => {
  const data = validDataset();
  data.text_units.push({ ...data.text_units[0] });
  data.alignments[0].source_unit_ids = ["missing"];
  data.text_formula_links[0].formula_id = "missing";
  const errors = datasetIntegrityErrors(data);
  assert.ok(errors.some((error) => error.includes("重复")));
  assert.ok(errors.some((error) => error.includes("不存在的文本单元")));
  assert.ok(errors.some((error) => error.includes("不存在的方剂")));
  assert.ok(errors.some((error) => error.includes("实际数量不一致")));
});
