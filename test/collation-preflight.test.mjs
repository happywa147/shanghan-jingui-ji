import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("六主本预审包严格区分AI候选与真人审核", () => {
  execFileSync(process.execPath, ["scripts/generate-collation-preflight.mjs"], { cwd: root });
  const data = JSON.parse(fs.readFileSync(path.join(root, "data/review/collation-preflight.json"), "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/collation-preflight.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  assert.equal(ajv.compile(schema)(data), true, JSON.stringify(ajv.errors));
  assert.equal(data.editions.length, 6);
  assert.equal(data.anchors.filter((item) => item.work_id === "shanghan_lun").length, 50);
  assert.equal(data.anchors.filter((item) => item.work_id === "jingui_yaolue").length, 50);
  assert.ok(data.anchors.every((item) => item.requires_human_review && item.state === "blocked_missing_scan_locator"));
  assert.equal(data.golden_remediation.length, 50);
  assert.equal(data.golden_remediation.filter((item) => item.risk_flags.includes("exact_label_risk")).length, 10);
  assert.ok(data.golden_remediation.every((item) => item.ai_precheck_only && item.must_not_promote_before_human_review));
  assert.ok(data.golden_remediation.every((item) => !("first_review" in item) && !("second_review" in item) && !("adjudication" in item)));
});
