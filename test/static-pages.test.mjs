import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pageName, paginationHtml, writePaginatedFiles } from "../lib/static-pages.mjs";

test("静态分页生成稳定页名和无障碍导航", () => {
  assert.equal(pageName("docs/site/report.html", 1), "report.html");
  assert.equal(pageName("docs/site/report.html", 3), "report-3.html");
  assert.match(paginationHtml("report.html", 2, 3), /report\.html.*第 2 \/ 3 页.*report-3\.html/);
});

test("静态分页写入分片并清理旧页", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "shjj-pages-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = join(directory, "report.html");
  await writeFile(join(directory, "report-9.html"), "旧页");
  const pages = await writePaginatedFiles({
    items: [1, 2, 3], outputPath, pageSize: 2,
    render: (items, page, total) => `${page}/${total}:${items.join(",")}`,
  });
  assert.equal(pages, 2);
  assert.deepEqual((await readdir(directory)).sort(), ["report-2.html", "report.html"]);
  assert.equal(await readFile(join(directory, "report-2.html"), "utf8"), "2/2:3");
});

test("静态分页拒绝无效大小且空集合不制造页面", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "shjj-pages-empty-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(() => writePaginatedFiles({ items: [], outputPath: join(directory, "x.html"), pageSize: 0, render: () => "" }), /正整数/);
  assert.equal(await writePaginatedFiles({ items: [], outputPath: join(directory, "x.html"), pageSize: 10, render: () => "" }), 0);
  assert.deepEqual(await readdir(directory), []);
});
