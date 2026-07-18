import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const revision = "a".repeat(64);
const evidenceRefs = [{ source_id: "scan:1", locator: "p.1", url: "https://example.test/scan/1" }];

test("审核导入拒绝未知对照 ID", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "review-test-"));
  try {
    const reviewPath = resolve(dir, "review.json");
    const importPath = resolve(dir, "import.json");
    await writeFile(reviewPath, JSON.stringify({
      schema_version: 2,
      exported_at: "2026-07-16T00:00:00.000Z",
      reviewer: { id: "reviewer-1", role: "first_review", identity_verified: false },
      input_revision: revision,
      reviews: { unknown: { status: "confirmed", note: "", updated_at: "2026-07-16T00:00:00.000Z", evidence_refs: evidenceRefs } }
    }));
    await writeFile(importPath, JSON.stringify({ manifest: { source_sha256: revision }, alignments: [] }));
    assert.throws(() => execFileSync("node", ["scripts/import-reviews.mjs", reviewPath, importPath, resolve(dir, "out.json")], { stdio: "pipe" }));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("审核导入接受已知对照并生成规范数组", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "review-test-"));
  try {
    const reviewPath = resolve(dir, "review.json");
    const importPath = resolve(dir, "import.json");
    const outputPath = resolve(dir, "out.json");
    await writeFile(reviewPath, JSON.stringify({
      schema_version: 2,
      exported_at: "2026-07-16T00:00:00.000Z",
      reviewer: { id: "reviewer-1", role: "first_review", identity_verified: false },
      input_revision: revision,
      reviews: { a1: { status: "confirmed", note: "已核", updated_at: "2026-07-16T00:00:00.000Z", evidence_refs: evidenceRefs } }
    }));
    await writeFile(importPath, JSON.stringify({ manifest: { source_sha256: revision }, alignments: [{ id: "a1" }] }));
    execFileSync("node", ["scripts/import-reviews.mjs", reviewPath, importPath, outputPath]);
    const output = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(output.reviews[0].alignment_id, "a1");
    assert.equal(output.reviews[0].status, "confirmed");
    assert.equal(output.reviews[0].reviewer.id, "reviewer-1");
    assert.equal(output.reviews[0].evidence_refs[0].locator, "p.1");
    assert.equal(output.review_events.length, 1);
    execFileSync("node", ["scripts/import-reviews.mjs", reviewPath, importPath, outputPath]);
    const repeated = JSON.parse(await readFile(outputPath, "utf8"));
    assert.equal(repeated.review_events.length, 1, "重复导入不得制造重复事件");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("审核导入拒绝旧数据修订", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "review-test-"));
  try {
    const reviewPath = resolve(dir, "review.json");
    const importPath = resolve(dir, "import.json");
    await writeFile(reviewPath, JSON.stringify({
      schema_version: 2,
      exported_at: "2026-07-16T00:00:00.000Z",
      reviewer: { id: "reviewer-1", role: "first_review", identity_verified: false },
      input_revision: "b".repeat(64),
      reviews: {}
    }));
    await writeFile(importPath, JSON.stringify({ manifest: { source_sha256: revision }, alignments: [] }));
    assert.throws(() => execFileSync("node", ["scripts/import-reviews.mjs", reviewPath, importPath, resolve(dir, "out.json")], { stdio: "pipe" }), /审核修订/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("审核导入拒绝未知字段、超长备注和缺失证据", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "review-test-"));
  try {
    const importPath = resolve(dir, "import.json");
    await writeFile(importPath, JSON.stringify({ manifest: { source_sha256: revision }, alignments: [{ id: "a1" }] }));
    for (const review of [
      { status: "confirmed", note: "", updated_at: "2026-07-16T00:00:00.000Z", evidence_refs: [], extra: true },
      { status: "confirmed", note: "x".repeat(4001), updated_at: "2026-07-16T00:00:00.000Z", evidence_refs: evidenceRefs },
      { status: "confirmed", note: "", updated_at: "2026-07-16T00:00:00.000Z", evidence_refs: [] }
    ]) {
      const reviewPath = resolve(dir, `review-${Math.random()}.json`);
      await writeFile(reviewPath, JSON.stringify({
        schema_version: 2,
        exported_at: "2026-07-16T00:00:00.000Z",
        reviewer: { id: "reviewer-1", role: "first_review", identity_verified: false },
        input_revision: revision,
        reviews: { a1: review }
      }));
      assert.throws(() => execFileSync("node", ["scripts/import-reviews.mjs", reviewPath, importPath, resolve(dir, "out.json")], { stdio: "pipe" }), /Schema/);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("审核导入在解析前拒绝超过5MB的文件", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "review-test-"));
  try {
    const reviewPath = resolve(dir, "oversized.json");
    const importPath = resolve(dir, "import.json");
    await writeFile(reviewPath, "x".repeat(5 * 1024 * 1024 + 1));
    await writeFile(importPath, JSON.stringify({ manifest: { source_sha256: revision }, alignments: [] }));
    assert.throws(
      () => execFileSync("node", ["scripts/import-reviews.mjs", reviewPath, importPath, resolve(dir, "out.json")], { stdio: "pipe" }),
      /5MB/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
