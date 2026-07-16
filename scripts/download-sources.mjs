#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { resolveInside } from "../lib/safe-path.mjs";

const manifestPath = process.argv[2] ?? "data/sources/jingui-sibu.json";
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const allowedDownloadHosts = new Set(["upload.wikimedia.org"]);

function validatedUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !allowedDownloadHosts.has(url.hostname)) {
    throw new Error(`下载地址不在允许列表: ${url.origin}`);
  }
  return url;
}

async function sha256(path) {
  try {
    return createHash("sha256").update(await readFile(path)).digest("hex");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

for (const file of manifest.files) {
  const targetPath = resolveInside("data/raw", file.local_path);
  if (await sha256(targetPath) === file.sha256) {
    console.log(`已存在且校验通过: ${file.local_path}`);
    continue;
  }

  if (!file.download_url) throw new Error(`缺少下载地址: ${file.local_path}`);
  const partialPath = `${targetPath}.part`;
  await mkdir(dirname(targetPath), { recursive: true });
  await rm(partialPath, { force: true });
  console.log(`下载: ${file.local_path}`);
  const downloadUrl = validatedUrl(file.download_url);
  const response = await fetch(downloadUrl, { redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`下载失败 ${response.status}: ${file.download_url}`);
  if (!response.body) throw new Error(`下载响应无内容: ${file.local_path}`);
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > file.bytes) throw new Error(`下载响应超过登记尺寸: ${file.local_path}`);
  let received = 0;
  const limiter = new Transform({
    transform(chunk, encoding, callback) {
      received += chunk.length;
      callback(received > file.bytes ? new Error(`下载内容超过登记尺寸: ${file.local_path}`) : null, chunk);
    }
  });
  try {
    await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(partialPath, { flags: "wx" }));
  } catch (error) {
    await rm(partialPath, { force: true });
    throw error;
  }
  if (await sha256(partialPath) !== file.sha256) {
    await rm(partialPath, { force: true });
    throw new Error(`下载后 SHA-256 不符: ${file.local_path}`);
  }
  await rename(partialPath, targetPath);
}

console.log(`来源准备完成: ${manifest.files.length} 册`);
