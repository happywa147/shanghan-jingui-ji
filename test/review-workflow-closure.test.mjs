import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const validate = (dataPath, schemaPath) => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const check = ajv.compile(read(schemaPath));
  assert.equal(check(read(dataPath)), true, JSON.stringify(check.errors));
};

test("六版本矩阵诚实阻断未完成的影像定位", () => {
  execFileSync(process.execPath, ["scripts/generate-six-edition-matrix.mjs"], { cwd: root });
  validate("data/review/six-edition-matrix.json", "schemas/six-edition-matrix.schema.json");
  const matrix = read("data/review/six-edition-matrix.json");
  assert.equal(matrix.editions.length, 6);
  assert.equal(matrix.summary.image_verified_anchors, 0);
  assert.equal(matrix.summary.blocked_anchors, 100);
  assert.equal(matrix.summary.release_state, "blocked");
  assert.ok(matrix.editions.every((edition) => edition.gate_state === "blocked"));
});

test("AI审核导入演练不能冒充真人或晋级黄金", () => {
  const before = fs.readFileSync(path.join(root, "data/review/golden-candidates.json"), "utf8");
  execFileSync(process.execPath, ["scripts/verify-review-workflow-simulation.mjs"], { cwd: root });
  const after = fs.readFileSync(path.join(root, "data/review/golden-candidates.json"), "utf8");
  validate("data/review/review-workflow-evidence.json", "schemas/review-workflow-evidence.schema.json");
  const evidence = read("data/review/review-workflow-evidence.json");
  assert.equal(before, after);
  assert.equal(evidence.result, "PASS");
  assert.equal(evidence.simulation.identity_verified, false);
  assert.equal(evidence.simulation.promotion_blocked, true);
  assert.equal(evidence.invariants.simulated_human_fields_written, false);
  assert.equal(evidence.invariants.simulated_gold_records, 0);
});
