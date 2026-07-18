# 生成物分类与维护规则

项目产物以根目录 `artifact-manifest.json` 为唯一机器可读清单，分为三类：

1. `maintained_source`：人工维护的来源、授权、审核与配置数据。修改时必须审查内容本身，不可被生成脚本静默覆盖。
2. `reproducible_output`：由脚本确定性生成并随仓库保存的公开数据或页面。修改输入或生成器后运行 `npm run generate`，提交前检查 Git 漂移。
3. `release_evidence`：测试、门禁和发布过程产生的证据，主要由 CI 归档；`docs/engineering-readiness.md` 作为可读快照随仓库保存，其余本地证据目录保持忽略，不作为产品源数据提交。

新增生成器时必须同步更新清单。`npm run verify:artifacts` 会检查分类结构、关键产物覆盖和生成器是否存在。

原始古籍影像位于 `data/raw/`，属于可追溯研究资产：保留在本地、由来源清单记录哈希，但默认不进入 Git，也不应当作临时缓存清理。
