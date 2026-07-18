import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (...args) => spawnSync(process.execPath, ["scripts/generate-prepublication-readiness.mjs", ...args], { cwd: root, encoding: "utf8" });
const output = (name) => path.join(os.tmpdir(), `shjj-${process.pid}-${name}.json`);
const report = (name) => path.join(os.tmpdir(), `shjj-${process.pid}-${name}.md`);

test("默认生成技术预览证据且不把未完成项报为公开预发布完成", () => {
  const outputPath = output("default");
  const result = run(`--output=${outputPath}`, `--report=${report("default")}`);
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/prepublication-readiness.schema.json"), "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(data), true, JSON.stringify(validate.errors));
  assert.equal(data.technical_preview.ready, true);
  assert.equal(data.public_prepublication.ready, false);
  assert.equal(data.metrics.selected_image_editions, 5);
  assert.equal(data.metrics.anchors_total, 100);
  assert.equal(data.metrics.anchors_human_verified, 0);
  assert.equal(data.metrics.verified_human_experts, 0);
  assert.equal(data.metrics.human_golden_records, 0);
  assert.ok(data.public_prepublication.blockers.includes("ocr_target_pages_complete"));
});

test("--enforce 在公开预发布硬指标未满足时失败但仍写出证据", () => {
  const outputPath = output("enforce");
  const result = run("--enforce", `--output=${outputPath}`, `--report=${report("enforce")}`);
  assert.notEqual(result.status, 0);
  const data = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(data.public_prepublication.ready, false);
});
