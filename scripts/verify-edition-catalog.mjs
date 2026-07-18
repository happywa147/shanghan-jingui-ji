#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const catalog = JSON.parse(await readFile(resolve(process.argv[2] ?? "data/sources/edition-catalog.json"), "utf8"));
const errors = [];
const ids = new Set();
for (const work of catalog.works ?? []) {
  const selected = work.editions.filter((edition) => edition.selected);
  if (selected.length !== 3) errors.push(`${work.work_id} 首批主本不是3个`);
  if (new Set(selected.map((edition) => edition.selection_rank)).size !== 3) errors.push(`${work.work_id} 选择排序重复`);
  for (const edition of work.editions) {
    if (ids.has(edition.edition_id)) errors.push(`版本ID重复: ${edition.edition_id}`);
    ids.add(edition.edition_id);
    for (const field of ["label", "layer", "completeness", "license", "image_quality", "text_status", "source", "risk"]) {
      if (!edition[field]) errors.push(`${edition.edition_id} 缺少 ${field}`);
    }
    if (edition.selected && edition.license === "per_file") errors.push(`${edition.edition_id} 未完成许可核验却被选中`);
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`版本总目录校验通过：${catalog.works.length}部书，${ids.size}个版本组，首批主本6个`);
