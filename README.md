# 伤寒金匮集

以《伤寒论》《金匮要略》为根基的公开只读文献校勘候选站。

## 产品边界

- 独立于笠翁堂建设，拥有独立的代码、数据、账户与发布流程。
- 笠翁堂只作为经审核的数据来源之一；原始出处与导入批次必须可追溯。
- 系统首先服务文献对读与专业研究，不向公众自动诊断或自动开方。
- 当前导入内容为“来源整理文本”，不得称为底本原貌；待扫描页逐字核对后才可形成影像对照转写。
- 机器输出必须区分来源文本、校注、人工判断和模型推断，并标明不确定性。

## 第一阶段

1. 建立可容纳两书多个版本的数据规范。
2. 导入并校验现有《伤寒论》宋本、桂林古本、康平本。
3. 实现条文对应、异文、拆合、次序和方药差异的表达。
4. 选择《金匮要略》底本，按同一规范开始录入。
5. 制作三版对读的最小可用界面。

## 首期验收标准

- 每条文本都有书、版本、篇章、原始编号和来源记录。
- 任意两个版本可建立一对一、一对多、多对一或无对应关系。
- 文字差异与医理影响分开记录。
- 自动导入不覆盖人工校订。
- 所有 AI 结论均附证据引用和不确定性说明。

## 目录

```text
data/       原始数据说明与后续导入产物
docs/       产品与数据设计文档
schemas/    机器可校验的数据规范
```

《金匮要略》首批底本候选及风险见 `docs/jingui-sources.md`。

## 当前状态

已完成笠翁堂《伤寒论》宋本、桂林古本、康平本的只读导入、Schema 校验、拆合对应、字符差异候选和方剂字段对照。所有对照仍属待审候选。

当前版本：`0.4.0`。执行 `npm run check` 可完成测试、导入、来源验证、条文异文、黄金样本候选队列、方剂差异分类、质量报告和两套浏览报告的端到端验收。

## 本地导入

```bash
node scripts/import-liwengtang.mjs \
  ../liwengtang/shanghan_data/shanghan_all.json
```

导入产物写入 `data/imported/`；发布分支保留用于 CI 的已校验快照。来源文件的 SHA-256 会写入清单，确保批次可追溯。

```bash
npm run verify:import
```

校验会检查文本单元与对照 ID 重复、空原文、悬空引用和非法信度。

运行 `npm run setup:sources` 可按来源清单下载《金匮要略》影像；已有文件哈希正确时不会重复下载。随后执行 `npm run verify:sources` 校验。校验命令需要 `djvulibre`（macOS 可用 `brew install djvulibre`），核对文件尺寸、SHA-256 和 DjVu 页数。

可选 OCR 流水线 `scripts/ocr-djvu.mjs` 需要 `tesseract` 与 `chi_tra_vert` 语言模型。OCR 结果始终标记为 `machine_ocr`；未通过人工逐页核对前，不得导入为校定原文。

运行 `npm run generate:variants && npm run generate:report` 后打开 `docs/site/report.html`。校勘状态与备注保存在浏览器本地，导出时必须填写审核者标识与角色；导出结构由 `schemas/review-export.schema.json` 约束。

方剂对照执行 `npm run generate:formula-variants && npm run generate:formula-report`，打开 `docs/site/formulas.html`。方剂页仅供文献研究，不可用于自行用药。维护者可用 `npm run status` 查看当前数据规模和审核缺口。

`npm run generate:golden-candidates` 会按合并关系、低信度、高字符差异、无字符差异和版本覆盖生成 50 条复核队列。它们只是候选；初审与复审必须由不同人完成，分歧须由第三人裁决。填入审核后执行 `npm run review:promote-golden`，只有在 `data/review/reviewer-registry.json` 中具有有效身份、对应角色且无该记录利益冲突的审核者才能使记录标记为 `golden`。当前注册表为空，因此 AI 或虚构身份无法晋级任何黄金样本。

CI 使用固定 Node.js 22.18.0 执行 `npm ci && npm run check:release`，随后独立执行供应链漏洞审计和真实浏览器验收；只有同一工作流的全部门禁通过才部署。完整本地验收另执行 `npm run check`，其中包含未入 Git 的金匮 DjVu 影像哈希与页数校验。

《金匮要略》目前仅完成两卷共264页影像的来源、文件哈希和页数校验，OCR 与逐页人工核对仍为 pending；网站不得据此宣称两书全文已完成。笠翁堂整理数据的再分发授权状态见 `THIRD_PARTY_NOTICES.md`，不得把公开可访问误解为开放许可。
