#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { tmpdir } from "node:os";

const sourcePath = process.argv[2];
const outputPath = process.argv[3];
const startPage = Number(process.argv[4] ?? 1);
const endPageArgument = process.argv[5] ? Number(process.argv[5]) : null;

if (!sourcePath || !outputPath) {
  console.error("用法: node scripts/ocr-djvu.mjs <输入.djvu> <输出.json> [起始页] [结束页]");
  process.exit(1);
}

const absoluteSource = resolve(sourcePath);
const sourceBuffer = await readFile(absoluteSource);
const sourceInfo = await stat(absoluteSource);
const sourceSha256 = createHash("sha256").update(sourceBuffer).digest("hex");
const firstVersionLine = (command) => {
  const result = spawnSync(command[0], command.slice(1), { encoding: "utf8" });
  if (result.error) throw result.error;
  const line = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().split(/\r?\n/u)[0];
  if (!line) throw new Error(`无法读取工具版本: ${command[0]}`);
  return line;
};
const engineVersion = firstVersionLine(["tesseract", "--version"]);
const rendererVersion = firstVersionLine(["ddjvu", "--help"]);
const pageCount = Number(execFileSync("djvused", [absoluteSource, "-e", "n"], { encoding: "utf8" }).trim());
const endPage = endPageArgument ?? pageCount;
if (startPage < 1 || endPage > pageCount || startPage > endPage) throw new Error("页码范围无效");

const workDir = resolve(tmpdir(), `shanghan-jingui-ji-ocr-${process.pid}`);
await mkdir(workDir, { recursive: true });
const pages = [];

try {
  for (let page = startPage; page <= endPage; page++) {
    const imagePath = resolve(workDir, `page-${page}.tif`);
    execFileSync("ddjvu", ["-format=tiff", `-page=${page}`, absoluteSource, imagePath], { stdio: "ignore" });
    const text = execFileSync("tesseract", [imagePath, "stdout", "-l", "chi_tra_vert", "--psm", "5"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    pages.push({
      source_file: basename(sourcePath),
      page,
      text,
      status: "machine_ocr",
      requires_human_review: true
    });
    await rm(imagePath, { force: true });
    console.log(`${basename(sourcePath)}: ${page}/${endPage}`);
  }
} finally {
  await rm(workDir, { recursive: true, force: true });
}

const absoluteOutput = resolve(outputPath);
await mkdir(resolve(absoluteOutput, ".."), { recursive: true });
const temporaryOutput = `${absoluteOutput}.${process.pid}.tmp`;
try {
  await writeFile(temporaryOutput, `${JSON.stringify({
  schema_version: 1,
  engine: "tesseract",
  engine_version: engineVersion,
  renderer: "ddjvu",
  renderer_version: rendererVersion,
  language: "chi_tra_vert",
  page_segmentation_mode: 5,
  source_file: basename(sourcePath),
  source_sha256: sourceSha256,
  source_bytes: sourceInfo.size,
  page_count: pageCount,
  processed_range: [startPage, endPage],
  generated_at: new Date().toISOString(),
  pages
  }, null, 2)}\n`, { flag: "wx" });
  await rename(temporaryOutput, absoluteOutput);
} finally {
  await rm(temporaryOutput, { force: true });
}
