import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

test("重新生成候选不覆盖已有审核", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "golden-test-"));
  try {
    const importPath = resolve(dir, "import.json");
    const variantsPath = resolve(dir, "variants.json");
    const outputPath = resolve(dir, "golden.json");
    const alignment = { id: "a1", target_unit_ids: ["work:guilin:g1"], relation_type: "approximate", confidence: 1 };
    await writeFile(importPath, JSON.stringify({ manifest: { source_sha256: "rev1" }, alignments: [alignment] }));
    await writeFile(variantsPath, JSON.stringify({ variants: [{ alignment_id: "a1", difference_ratio: 0, source_text: "甲", target_text: "甲" }] }));
    await writeFile(outputPath, JSON.stringify({ input_revision: "rev1", candidates: [{
      alignment_id: "a1", review_state: "awaiting_second_review", first_review: { reviewer_id: "r1" },
      second_review: null, adjudication: null, golden_status: "candidate"
    }] }));
    execFileSync("node", ["scripts/generate-golden-candidates.mjs", importPath, variantsPath, outputPath]);
    const result = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(result.candidates[0].first_review.reviewer_id, "r1");
    assert.equal(result.candidates[0].review_state, "awaiting_second_review");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
