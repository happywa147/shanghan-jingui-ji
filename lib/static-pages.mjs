import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

export function pageName(outputPath, page) {
  const stem = basename(outputPath, extname(outputPath));
  return page === 1 ? `${stem}.html` : `${stem}-${page}.html`;
}

export function paginationHtml(outputPath, page, pages) {
  const previous = page > 1 ? `<a href="${pageName(outputPath, page - 1)}">上一页</a>` : "<span>上一页</span>";
  const next = page < pages ? `<a href="${pageName(outputPath, page + 1)}">下一页</a>` : "<span>下一页</span>";
  return `<nav class="page-links" aria-label="静态分页">${previous}<strong>第 ${page} / ${pages} 页</strong>${next}</nav>`;
}

export async function writePaginatedFiles({ items, outputPath, pageSize, render }) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("分页大小必须为正整数");
  const absoluteOutput = resolve(outputPath);
  const outputDir = dirname(absoluteOutput);
  const stem = basename(absoluteOutput, extname(absoluteOutput));
  await mkdir(outputDir, { recursive: true });
  for (const file of await readdir(outputDir)) {
    if (new RegExp(`^${stem}-\\d+\\.html$`).test(file)) await unlink(resolve(outputDir, file));
  }
  const pages = Math.ceil(items.length / pageSize);
  for (let page = 1; page <= pages; page++) {
    const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
    await writeFile(resolve(outputDir, pageName(absoluteOutput, page)), render(pageItems, page, pages));
  }
  return pages;
}
