#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
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

await mkdir(resolve(outputPath, ".."), { recursive: true });
await writeFile(resolve(outputPath), `${JSON.stringify({
  engine: "tesseract",
  language: "chi_tra_vert",
  page_segmentation_mode: 5,
  source_file: basename(sourcePath),
  page_count: pageCount,
  processed_range: [startPage, endPage],
  pages
}, null, 2)}\n`);
