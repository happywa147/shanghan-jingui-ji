import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const hash = "d".repeat(64);
const text = "桂枝汤麻黄汤太阳病脉浮紧发热恶寒身疼痛".repeat(2);
const manifest = { files: [{ local_path: "data/raw/book.djvu", sha256: hash, bytes: 123, pages: 2 }] };
const page = (number, sourceFile = "book.djvu") => ({ source_file: sourceFile, page: number, text, status: "machine_ocr", requires_human_review: true });
const pack = (pages, range = [1, 2], overrides = {}) => ({
  schema_version: 1,
  source_file: "book.djvu",
  source_sha256: hash,
  source_bytes: 123,
  page_count: 2,
  processed_range: range,
  engine: "tesseract",
  engine_version: "tesseract 5",
  renderer: "ddjvu",
  renderer_version: "ddjvu 3",
  language: "chi_tra_vert",
  page_segmentation_mode: 5,
  generated_at: "2026-07-18T00:00:00.000Z",
  pages,
  ...overrides
});

async function fixture() {
  const dir = await mkdtemp(resolve(tmpdir(), "ocr-test-"));
  const manifestPath = resolve(dir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { dir, manifestPath };
}

test("OCR校验接受完整且与来源哈希绑定的页集", async () => {
  const { dir, manifestPath } = await fixture();
  try {
    const input = resolve(dir, "ocr.json");
    await writeFile(input, JSON.stringify(pack([page(1), page(2)])));
    assert.doesNotThrow(() => execFileSync("node", ["scripts/verify-ocr.mjs", input, "--manifest", manifestPath]));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("OCR校验拒绝漏页、错册、重复、越界和错哈希", async () => {
  const { dir, manifestPath } = await fixture();
  try {
    const cases = [
      pack([page(1)], [1, 1]),
      pack([page(1, "other.djvu"), page(2)]),
      pack([page(1), page(1)]),
      pack([page(1), page(3)], [1, 2]),
      pack([page(1), page(2)], [1, 2], { source_sha256: "e".repeat(64) })
    ];
    for (const [index, value] of cases.entries()) {
      const input = resolve(dir, `ocr-${index}.json`);
      await writeFile(input, JSON.stringify(value));
      assert.throws(() => execFileSync("node", ["scripts/verify-ocr.mjs", input, "--manifest", manifestPath], { stdio: "pipe" }));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("OCR校验在本地来源存在时重新计算实物哈希", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "ocr-source-test-"));
  try {
    const sourcePath = resolve(dir, "book.djvu");
    const source = Buffer.from("source-bytes");
    const sourceHash = createHash("sha256").update(source).digest("hex");
    const manifestPath = resolve(dir, "manifest.json");
    const input = resolve(dir, "ocr.json");
    await writeFile(sourcePath, source);
    await writeFile(manifestPath, JSON.stringify({ files: [{ local_path: sourcePath, sha256: sourceHash, bytes: source.length, pages: 2 }] }));
    await writeFile(input, JSON.stringify(pack([page(1), page(2)], [1, 2], { source_sha256: sourceHash, source_bytes: source.length })));
    assert.doesNotThrow(() => execFileSync("node", ["scripts/verify-ocr.mjs", input, "--manifest", manifestPath]));
    await writeFile(sourcePath, "tampered");
    assert.throws(() => execFileSync("node", ["scripts/verify-ocr.mjs", input, "--manifest", manifestPath], { stdio: "pipe" }), /本地来源文件/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("OCR校验拒绝来源清单同名歧义", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "ocr-source-test-"));
  try {
    const manifestPath = resolve(dir, "manifest.json");
    const input = resolve(dir, "ocr.json");
    await writeFile(manifestPath, JSON.stringify({ files: [manifest.files[0], { ...manifest.files[0], local_path: "other/book.djvu" }] }));
    await writeFile(input, JSON.stringify(pack([page(1), page(2)])));
    assert.throws(() => execFileSync("node", ["scripts/verify-ocr.mjs", input, "--manifest", manifestPath], { stdio: "pipe" }), /重复文件名/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
