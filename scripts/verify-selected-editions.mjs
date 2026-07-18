#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const manifest = JSON.parse(await readFile(resolve("data/sources/selected-editions.json"), "utf8"));
const errors = [];
const ids = new Set();

for (const edition of manifest.editions ?? []) {
  if (ids.has(edition.edition_id)) errors.push(`版本ID重复: ${edition.edition_id}`);
  ids.add(edition.edition_id);
  if (!edition.status || !edition.license || !edition.source_page && !edition.source_manifest) errors.push(`${edition.edition_id} 来源字段不完整`);
  if (edition.status === "provenance_blocked" && edition.files.length) errors.push(`${edition.edition_id} 阻断状态不应绑定影像`);
  for (const file of edition.files ?? []) {
    try {
      const info = await stat(resolve(file.local_path));
      if (info.size !== file.bytes) errors.push(`${file.local_path} 字节数不符`);
      const hash = createHash("sha256").update(await readFile(resolve(file.local_path))).digest("hex");
      if (hash !== file.sha256) errors.push(`${file.local_path} SHA-256不符`);
    } catch (error) {
      if (error.code === "ENOENT") errors.push(`${file.local_path} 本地影像不存在`);
      else throw error;
    }
  }
}

if (ids.size !== 6) errors.push(`首批主本应为6个，实际${ids.size}个`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`六主本来源清单通过：${ids.size}个版本；5个影像已核验，1个来源阻断`);
