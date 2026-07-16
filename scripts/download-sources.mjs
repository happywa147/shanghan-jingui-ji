#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const manifestPath = process.argv[2] ?? "data/sources/jingui-sibu.json";
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));

async function sha256(path) {
  try {
    return createHash("sha256").update(await readFile(path)).digest("hex");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

for (const file of manifest.files) {
  const targetPath = resolve(file.local_path);
  if (await sha256(targetPath) === file.sha256) {
    console.log(`已存在且校验通过: ${file.local_path}`);
    continue;
  }

  if (!file.download_url) throw new Error(`缺少下载地址: ${file.local_path}`);
  const partialPath = `${targetPath}.part`;
  await mkdir(dirname(targetPath), { recursive: true });
  await rm(partialPath, { force: true });
  console.log(`下载: ${file.local_path}`);
  const response = await fetch(file.download_url, { redirect: "follow" });
  if (!response.ok) throw new Error(`下载失败 ${response.status}: ${file.download_url}`);
  await writeFile(partialPath, Buffer.from(await response.arrayBuffer()));
  if (await sha256(partialPath) !== file.sha256) {
    await rm(partialPath, { force: true });
    throw new Error(`下载后 SHA-256 不符: ${file.local_path}`);
  }
  await rename(partialPath, targetPath);
}

console.log(`来源准备完成: ${manifest.files.length} 册`);
