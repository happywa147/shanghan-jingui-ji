import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

test("方剂安全数据包覆盖全部方剂并绑定输入修订", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "formula-safety-test-"));
  try {
    const input = resolve(dir, "input.json");
    const output = resolve(dir, "output.json");
    const revision = "a".repeat(64);
    await writeFile(input, JSON.stringify({
      manifest: { source_sha256: revision },
      formulas: [
        { id: "f1", work_id: "shanghan_lun", edition_id: "e1", ingredients: [{ substance: "巴豆" }] },
        { id: "f2", work_id: "shanghan_lun", edition_id: "e1", ingredients: [{ substance: "桂枝" }] }
      ]
    }));
    execFileSync("node", ["scripts/generate-formula-safety.mjs", input, output]);
    const result = JSON.parse(await readFile(output, "utf8"));
    assert.equal(result.manifest.input_revision, revision);
    assert.equal(result.records.length, 2);
    assert.deepEqual(result.records[0].safety_review_terms, ["巴豆"]);
    assert.deepEqual(result.records[1].safety_review_terms, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
