#!/usr/bin/env node

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const text = async (path) => readFile(resolve(path), "utf8");
const json = async (path) => JSON.parse(await text(path));
const exists = async (path) => stat(resolve(path)).then(() => true, () => false);
const imported = await json("data/imported/liwengtang-shanghan.json");
const variants = await json("data/imported/liwengtang-variants.json");
const formulaSafety = await json("data/imported/formula-safety.json");
const workflow = await text(".github/workflows/verify-and-deploy.yml");
const reportJs = await text("docs/site/report.js");
const packageData = await json("package.json");
const unitEvidence = await json("dist/test-evidence/unit.json");
const e2eEvidence = await json("dist/test-evidence/playwright.json");
const unitPassed = unitEvidence.exit_code === 0 && unitEvidence.tests >= 44 && unitEvidence.passed === unitEvidence.tests && unitEvidence.failed === 0;
const e2eProjects = new Set(e2eEvidence.config?.projects?.map((project) => project.name));
const e2eText = JSON.stringify(e2eEvidence.suites ?? []);
const e2ePassed = e2eEvidence.stats?.unexpected === 0 && e2eEvidence.stats?.expected >= 13 && ["chromium", "firefox", "webkit", "mobile-chromium"].every((name) => e2eProjects.has(name));
const siteFiles = await readdir(resolve("docs/site"));
const htmlFiles = siteFiles.filter((file) => file.endsWith(".html"));
const htmlContents = await Promise.all(htmlFiles.map((file) => text(`docs/site/${file}`)));
const formulaPages = siteFiles.filter((file) => /^formulas(?:-\d+)?\.html$/.test(file));
const formulaHtml = await Promise.all(formulaPages.map((file) => text(`docs/site/${file}`)));
const reportPages = siteFiles.filter((file) => /^report(?:-\d+)?\.html$/.test(file));
const importReviews = await text("scripts/import-reviews.mjs");

const checks = [
  ["根Schema与严格数据契约", 6, unitPassed && await exists("schemas/import-package.schema.json") && await exists("schemas/variant-package.schema.json") && await exists("schemas/ocr-package.schema.json") && await exists("schemas/formula-safety-package.schema.json")],
  ["ID、计数与交叉引用完整性", 6, unitPassed && imported.manifest.counts.text_units === imported.text_units.length && imported.manifest.counts.formulas === imported.formulas.length],
  ["派生异文绑定输入修订与算法版本", 7, variants.manifest?.input_revision === imported.manifest.source_sha256 && Boolean(variants.manifest?.algorithm_version) && Boolean(variants.manifest?.normalization)],
  ["OCR绑定源哈希、工具版本及完整页集", 7, unitPassed && (await text("scripts/verify-ocr.mjs")).includes("source_sha256") && (await text("scripts/ocr-djvu.mjs")).includes("engine_version") && (await text("scripts/ocr-djvu.mjs")).includes("renderer_version")],
  ["525方全部安全扫描并逐条警示", 10, unitPassed && formulaSafety.manifest?.input_revision === imported.manifest.source_sha256 && formulaSafety.records?.length === 525 && new Set(formulaSafety.records.map((item) => item.formula_id)).size === 525 && formulaHtml.reduce((sum, html) => sum + (html.match(/class="item-warning"/g) ?? []).length, 0) === 525],
  ["机器权利清单与公开发布硬门禁", 8, unitPassed && await exists("rights-manifest.json") && workflow.includes("publication-rights") && workflow.includes("verify:release-rights")],
  ["发布时按当前注册表重验黄金样本", 7, unitPassed && packageData.scripts["check:engineering"]?.includes("verify:golden-release")],
  ["审核输入Schema、限额、证据与原子写", 7, unitPassed && importReviews.includes("MAX_REVIEW_BYTES") && importReviews.includes("rename") && importReviews.includes("evidence_refs")],
  ["严格CSP且无内联脚本样式", 6, htmlContents.every((html) => html.includes("default-src 'none'") && !/<style\b|<script(?![^>]*\bsrc=)/iu.test(html))],
  ["真实静态分片与页面预算", 8, reportPages.length === 16 && formulaPages.length === 11 && (await Promise.all([...reportPages, ...formulaPages].map((file) => stat(resolve("docs/site", file))))).every((item) => item.size <= 300_000)],
  ["草稿实时保存、TTL、确认清除与结构化证据", 6, e2ePassed && e2eText.includes("条文草稿实时保存、确认清除与撤销") && reportJs.includes("evidence_refs")],
  ["三浏览器、移动端与WCAG自动验收", 6, e2ePassed && e2eText.includes("无严重或高危无障碍问题") && e2eText.includes("移动端条文审核控件不溢出视口")],
  ["CI失败证据归档", 4, unitPassed && e2ePassed && workflow.includes("if: always()") && workflow.includes("release-gate-evidence")],
  ["多操作系统轻量兼容矩阵", 4, /matrix:[\s\S]*os:/u.test(workflow)],
  ["备份恢复演练与可复现证据", 4, await exists("docs/recovery-drill.md") && Boolean(packageData.scripts["verify:recovery"])],
  ["权威来源与派生输入修订贯通", 4, imported.manifest.source_sha256 === variants.manifest?.input_revision && imported.editions.every((edition) => edition.source_id === imported.manifest.source_id)]
].map(([name, weight, passed]) => ({ name, weight, passed: Boolean(passed), score: passed ? weight : 0 }));

const score = checks.reduce((sum, item) => sum + item.score, 0);
const workingTreeDirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
const report = {
  schema_version: 1,
  scope: "engineering_gate_evidence_excludes_human_legal_expert_approval_not_overall_project_score",
  commit_sha: process.env.GITHUB_SHA ?? (workingTreeDirty ? "working-tree-uncommitted" : execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()),
  input_revision: imported.manifest.source_sha256,
  evidence: {
    unit: { tests: unitEvidence.tests, passed: unitEvidence.passed, failed: unitEvidence.failed },
    e2e: { expected: e2eEvidence.stats.expected, skipped: e2eEvidence.stats.skipped, unexpected: e2eEvidence.stats.unexpected, projects: [...e2eProjects] }
  },
  score,
  target: 90,
  passed: score >= 90,
  checks,
  external_blockers: [
    "笠翁堂整理数据书面再分发授权或移除公开派生内容",
    "真实版本学与药学专家资格、利益冲突和双审签核",
    "《金匮要略》逐页人工核对与正式正文",
    "多人治理及连续运行证据"
  ]
};
const jsonPath = resolve(process.argv[2] ?? "dist/engineering-readiness.json");
const markdownPath = resolve(process.argv[3] ?? "docs/engineering-readiness.md");
await mkdir(dirname(jsonPath), { recursive: true });
await mkdir(dirname(markdownPath), { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
const rows = checks.map((item) => `| ${item.name} | ${item.weight} | ${item.passed ? "通过" : "未通过"} | ${item.score} |`).join("\n");
await writeFile(markdownPath, `# 工程门禁证据评分\n\n当前工程门禁证据评分：**${score}/100**；目标：${report.target}；结果：**${report.passed ? "通过" : "未通过"}**。\n\n这不是项目总评分。它只衡量可由本次机器证据验证的工程门禁，不把授权、真实专家签核或连续季度运营证据伪装成技术完成。证据绑定提交：\`${report.commit_sha}\`。\n\n- 单元测试：${unitEvidence.passed}/${unitEvidence.tests} 通过，失败 ${unitEvidence.failed}\n- E2E：${e2eEvidence.stats.expected} 通过，${e2eEvidence.stats.skipped} 按矩阵设计跳过，意外失败 ${e2eEvidence.stats.unexpected}\n- 浏览器项目：${[...e2eProjects].join("、")}\n\n| 检查 | 权重 | 状态 | 得分 |\n|---|---:|---|---:|\n${rows}\n\n## 外部硬阻断\n\n${report.external_blockers.map((item) => `- ${item}`).join("\n")}\n`);
console.log(`工程门禁证据评分：${score}/100（目标 ${report.target}）`);
if (!report.passed) process.exit(1);
