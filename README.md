# 伤寒金匮集

以《伤寒论》《金匮要略》为根基的多版本对读、方证研究与辨证辅助系统。

## 产品边界

- 独立于笠翁堂建设，拥有独立的代码、数据、账户与发布流程。
- 笠翁堂只作为经审核的数据来源之一；原始出处与导入批次必须可追溯。
- 系统首先服务文献对读与专业研究，不向公众自动诊断或自动开方。
- AI 输出必须区分原文、校注、人工判断和模型推断，并能回到具体版本与原文。

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

项目骨架已建立；下一步是编写笠翁堂《伤寒论》三版本的只读导入器和数据校验。

当前版本：`0.2.0`。执行 `npm run check` 可完成测试、导入、来源验证、条文异文、方剂异文、质量报告和两套浏览报告的端到端验收。

## 本地导入

```bash
node scripts/import-liwengtang.mjs \
  ../liwengtang/shanghan_data/shanghan_all.json
```

导入产物写入 `data/imported/`，默认不提交到 Git；来源文件的 SHA-256 会写入清单，确保批次可追溯。

```bash
npm run verify:import
```

校验会检查文本单元与对照 ID 重复、空原文、悬空引用和非法信度。

运行 `npm run setup:sources` 可按来源清单下载《金匮要略》影像；已有文件哈希正确时不会重复下载。随后执行 `npm run verify:sources` 校验。校验命令需要 `djvulibre`（macOS 可用 `brew install djvulibre`），核对文件尺寸、SHA-256 和 DjVu 页数。

可选 OCR 流水线 `scripts/ocr-djvu.mjs` 需要 `tesseract` 与 `chi_tra_vert` 语言模型。OCR 结果始终标记为 `machine_ocr`；未通过人工逐页核对前，不得导入为校定原文。

运行 `npm run generate:variants && npm run generate:report` 后打开 `dist/report.html`。校勘状态与备注保存在浏览器本地，可导出为 JSON；导出结构由 `schemas/review-export.schema.json` 约束。

方剂对照执行 `npm run generate:formula-variants && npm run generate:formula-report`，打开 `dist/formulas.html`。维护者可用 `npm run status` 查看当前数据规模和审核缺口。
