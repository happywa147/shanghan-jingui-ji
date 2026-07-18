import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

test("异文派生包记录输入修订、算法版本和归一化策略", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "variant-test-"));
  try {
    const input = resolve(dir, "input.json");
    const output = resolve(dir, "output.json");
    const revision = "c".repeat(64);
    await writeFile(input, JSON.stringify({
      manifest: { source_sha256: revision },
      text_units: [
        { id: "s", source_main_text: null, source_edited_text: "桂枝" },
        { id: "t", source_main_text: null, source_edited_text: "桂枝汤" }
      ],
      alignments: [{ id: "a", source_unit_ids: ["s"], target_unit_ids: ["t"] }]
    }));
    execFileSync("node", ["scripts/generate-variants.mjs", input, output]);
    const result = JSON.parse(await readFile(output, "utf8"));
    assert.equal(result.manifest.input_revision, revision);
    assert.equal(result.manifest.generator, "scripts/generate-variants.mjs");
    assert.equal(result.manifest.algorithm_version, "lcs-code-point-v1");
    assert.equal(result.manifest.normalization, "none-code-point-preserving");
    assert.match(result.manifest.variant_revision, /^[a-f0-9]{64}$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
