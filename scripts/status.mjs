#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const readJson = async (path) => JSON.parse(await readFile(resolve(path), "utf8"));
const imported = await readJson("data/imported/liwengtang-shanghan.json");
const quality = await readJson("dist/quality-report.json");
const formulas = await readJson("data/imported/formula-variants.json");
const source = await readJson("data/sources/jingui-sibu.json");

console.log("伤寒金匮集 · 项目状态");
console.log(`《伤寒论》版本: ${imported.editions.length}`);
console.log(`文本单元: ${imported.text_units.length}`);
console.log(`版本对照: ${imported.alignments.length}（待人工审核 ${quality.alignment_quality.imported_unreviewed}）`);
console.log(`低信度对照: ${quality.alignment_quality.confidence_below_0_4}`);
console.log(`版本方剂: ${imported.formulas.length}；条方关系: ${imported.text_formula_links.length}`);
console.log(`同名方比较: ${formulas.comparisons.length}；有差异候选: ${formulas.comparisons.filter((item) => item.has_difference).length}`);
console.log(`《金匮》影像: ${source.files.length} 册，${source.files.reduce((sum, file) => sum + file.pages, 0)} 页`);
console.log(`《金匮》OCR: ${source.quality.ocr_status}；人工复核: ${source.quality.human_review_status}`);
