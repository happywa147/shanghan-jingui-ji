# 六主本 OCR 预检记录

## 结果

五个物理文件的实物哈希、字节数和页数均已验证。批次共登记1115个物理页；扣除赵开美合集前259页非本轮目标内容，本轮应处理856页：四部丛刊264页、赵开美《注解伤寒论》与《金匱要略方論》358页、吴迁本84页、康平本150页。

本次实际OCR输出为 **0页**。运行环境原先没有 `tesseract` 和 `chi_tra_vert`；安装过程受慢速依赖下载阻断。因此没有生成或提交伪全文，也没有把维基转录倒填成OCR。

## 已完成的可执行准备

- `data/sources/selected-ocr-batch.json` 固定五个文件的SHA-256、页数和目标页段。
- `scripts/ocr-djvu.mjs` 现同时支持PDF与DjVu，统一300 DPI渲染。
- OCR通过Tesseract TSV计算逐页平均置信度；低于65标记为低置信度，所有页面仍强制真人复核。
- `scripts/verify-ocr.mjs --allow-partial` 可验收不冒充全量的代表性样本；不带该参数时仍强制全页覆盖。

## 工具版本与后续命令

- Node.js：v25.8.2
- Poppler：26.05.0
- DjVuLibre：3.5.29
- Tesseract：未就绪

依赖就绪后先运行代表页，不直接启动856页全量：

```text
node scripts/ocr-djvu.mjs data/raw/zhaokaimei-zhongjing-quanshu.pdf dist/ocr-samples/zhao-shanghan-276.json 276 276
node scripts/ocr-djvu.mjs data/raw/zhaokaimei-zhongjing-quanshu.pdf dist/ocr-samples/zhao-jingui-498.json 498 498
node scripts/ocr-djvu.mjs data/raw/kangping-shanghan.pdf dist/ocr-samples/kangping-20.json 20 20
node scripts/ocr-djvu.mjs data/raw/wuqian-jingui.pdf dist/ocr-samples/wuqian-10.json 10 10
node scripts/ocr-djvu.mjs data/raw/jingui-sibu-1.djvu dist/ocr-samples/sibu-20.json 20 20
```

代表页需要逐页对照影像，确认竖排阅读顺序、图片字、经注层级及平均置信度后，才能按批次清单扩展全量。
