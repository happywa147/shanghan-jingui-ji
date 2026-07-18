#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const enforce = process.argv.includes("--enforce");
const option = (name, fallback) => process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
const outputPath = option("--output", "data/review/prepublication-readiness.json");
const reportPath = option("--report", "docs/prepublication-readiness.md");
const atomicWrite = async (path, content) => {
  const target = resolve(path);
  const temporaryTarget = `${target}.${process.pid}.tmp`;
  await writeFile(temporaryTarget, content);
  await rename(temporaryTarget, target);
};
const inputPaths = [
  "data/sources/selected-editions.json", "data/sources/selected-ocr-batch.json",
  "data/review/collation-preflight.json", "data/review/six-edition-matrix.json",
  "data/review/expert-pool-plan.json", "data/review/reviewer-registry.json",
  "data/review/golden-candidates.json", "data/review/review-workflow-evidence.json",
  "data/sources/edition-catalog.json"
];
const values = new Map();
const inputs = [];
for (const path of inputPaths) {
  const content = await readFile(resolve(path), "utf8");
  values.set(path, JSON.parse(content));
  inputs.push({ path, sha256: createHash("sha256").update(content).digest("hex") });
}
const selected = values.get("data/sources/selected-editions.json");
const batch = values.get("data/sources/selected-ocr-batch.json");
const preflight = values.get("data/review/collation-preflight.json");
const matrix = values.get("data/review/six-edition-matrix.json");
const expertPlan = values.get("data/review/expert-pool-plan.json");
const registry = values.get("data/review/reviewer-registry.json");
const golden = values.get("data/review/golden-candidates.json");
const workflow = values.get("data/review/review-workflow-evidence.json");
const catalog = values.get("data/sources/edition-catalog.json");

const imageEditions = selected.editions.filter((edition) => edition.status === "local_verified" && edition.files?.length > 0);
const targetPagesBySha = new Map();
for (const file of batch.files) {
  const pages = targetPagesBySha.get(file.sha256) ?? new Set();
  for (const [start, end] of file.ocr_ranges) for (let page = start; page <= end; page++) pages.add(page);
  targetPagesBySha.set(file.sha256, pages);
}
const targetPages = [...targetPagesBySha.values()].reduce((sum, pages) => sum + pages.size, 0);
const completedBySha = new Map();
for (const name of (await readdir(resolve("data/imported"))).filter((name) => /-ocr\.json$/u.test(name))) {
  let ocr;
  try { ocr = JSON.parse(await readFile(resolve("data/imported", name), "utf8")); } catch { continue; }
  if (!targetPagesBySha.has(ocr.source_sha256)) continue;
  const completed = completedBySha.get(ocr.source_sha256) ?? new Set();
  for (const page of ocr.pages ?? []) if (page.status === "machine_ocr" && targetPagesBySha.get(ocr.source_sha256).has(page.page)) completed.add(page.page);
  completedBySha.set(ocr.source_sha256, completed);
}
const completedPages = [...completedBySha.values()].reduce((sum, pages) => sum + pages.size, 0);
const verifiedExperts = registry.reviewers.filter((reviewer) => reviewer.active === true && !Number.isNaN(Date.parse(reviewer.verified_at)) && reviewer.roles?.length).length;
const filledExpertSlots = expertPlan.slots.filter((slot) => slot.status !== "vacant").length;
if (filledExpertSlots > verifiedExperts) throw new Error("专家计划已填席位超过注册表中已核验真人数");
const goldenRecords = golden.candidates.filter((candidate) => candidate.golden_status === "golden" && candidate.first_review && candidate.second_review).length;
const anchorsVerified = preflight.anchors.filter((anchor) => anchor.image_locator.status === "verified" && anchor.image_locator.verified_by_human === true).length;
const websiteFiles = ["docs/site/index.html", "docs/site/report.html", "docs/site/formulas.html", "docs/site/editions.html", "docs/site/site.css", "docs/site/report.js", "docs/site/formulas.js"];
let websitePresent = 0;
for (const path of websiteFiles) { try { if ((await stat(resolve(path))).isFile()) websitePresent++; } catch {} }
const selectedInCatalog = catalog.works.flatMap((work) => work.editions).filter((edition) => edition.selected).length;
const metrics = {
  catalog_selected_editions: selectedInCatalog, selected_image_editions: imageEditions.length,
  ocr_target_pages: targetPages, ocr_completed_pages: completedPages,
  anchors_total: preflight.anchors.length, anchors_human_verified: anchorsVerified,
  verified_human_experts: verifiedExperts, human_golden_records: goldenRecords,
  matrix_state: matrix.summary.release_state, review_workflow_evidence: workflow.result,
  website_required_files: websiteFiles.length, website_present_files: websitePresent
};
const check = (id, required, actual, pass) => ({ id, required, actual, pass });
const technicalChecks = [
  check("six_catalog_editions", 6, selectedInCatalog, selectedInCatalog === 6),
  check("five_usable_image_editions", 5, imageEditions.length, imageEditions.length >= 5),
  check("anchor_candidates_present", 100, preflight.anchors.length, preflight.anchors.length === 100),
  check("review_workflow_simulation", "PASS", workflow.result, workflow.result === "PASS"),
  check("website_artifacts_present", websiteFiles.length, websitePresent, websitePresent === websiteFiles.length)
];
const publicChecks = [
  ...technicalChecks,
  check("ocr_target_pages_complete", targetPages, completedPages, targetPages > 0 && completedPages === targetPages),
  check("anchors_human_verified", 100, anchorsVerified, anchorsVerified === 100),
  check("verified_human_experts", 5, verifiedExperts, verifiedExperts >= 5),
  check("human_golden_records", 20, goldenRecords, goldenRecords >= 20),
  check("six_edition_matrix", "ready", matrix.summary.release_state, matrix.summary.release_state === "ready")
];
const gate = (checks) => ({ ready: checks.every((item) => item.pass), checks, blockers: checks.filter((item) => !item.pass).map((item) => item.id) });
const output = {
  schema_version: 1, generated_at: `${catalog.retrieved_at}T00:00:00.000Z`, generator: "scripts/generate-prepublication-readiness.mjs",
  inputs, metrics, technical_preview: gate(technicalChecks), public_prepublication: gate(publicChecks),
  external_gates: { copyright: "npm run verify:release-rights", website_release: "npm run test:e2e && npm run verify:artifacts" }
};
await atomicWrite(outputPath, `${JSON.stringify(output, null, 2)}\n`);
const lines = [
  "# 预发布验收状态", "", `- 技术预览：${output.technical_preview.ready ? "READY" : "BLOCKED"}`,
  `- 公开预发布：${output.public_prepublication.ready ? "READY" : "BLOCKED"}`,
  `- 可用影像版本：${imageEditions.length}/5`, `- OCR目标页：${completedPages}/${targetPages}`,
  `- 真人核验锚点：${anchorsVerified}/100`, `- 已核验真人专家：${verifiedExperts}/5`,
  `- 真人黄金样本：${goldenRecords}/20`, `- 六版本矩阵：${matrix.summary.release_state}`, "",
  "## 公开预发布阻断项", "", ...(output.public_prepublication.blockers.length ? output.public_prepublication.blockers.map((item) => `- ${item}`) : ["- 无"]), "",
  "版权与网站正式发布分别继续执行 `npm run verify:release-rights` 和 E2E/生成物门禁。", ""
];
await atomicWrite(reportPath, lines.join("\n"));
console.log(`技术预览 ${output.technical_preview.ready ? "READY" : "BLOCKED"}；公开预发布 ${output.public_prepublication.ready ? "READY" : "BLOCKED"}`);
if (enforce && !output.public_prepublication.ready) process.exitCode = 1;
