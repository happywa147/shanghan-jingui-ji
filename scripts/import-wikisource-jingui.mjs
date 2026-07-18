import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sourcePath = resolve(process.argv[2] ?? "data/sources/jingui-wikisource.json");
const outputPath = resolve(process.argv[3] ?? "data/imported/jingui-wikisource.json");

export function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/giu, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/gu, (_, number) => String.fromCodePoint(Number.parseInt(number, 10)))
    .replaceAll("&nbsp;", " ").replaceAll("&amp;", "&").replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">").replaceAll("&quot;", "\"").replaceAll("&#039;", "'");
}

export function renderedHtmlToText(html) {
  const start = html.indexOf('<div class="prp-pages-output"');
  const body = (start >= 0 ? html.slice(start) : html)
    .replace(/<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)>/giu, "");
  return decodeHtml(body
    .replace(/<span[^>]*class="[^"]*pagenum-inner[^"]*"[^>]*>[\s\S]*?<\/span>/giu, "")
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/giu, (_, alt) => alt ? `[图字:${alt}]` : "[图字]")
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/giu, "\n")
    .replace(/<[^>]+>/gu, "")
    .replace(/[ \t]+\n/gu, "\n").replace(/\n{3,}/gu, "\n\n").trim());
}

function chapterMarkers(text) {
  return text.split("\n").map((line) => line.trim())
    .filter((line) => /第[一二三四五六七八九十廿]+/u.test(line) && line.length <= 45);
}

async function fetchRevision(page) {
  const url = new URL("https://zh.wikisource.org/w/api.php");
  url.search = new URLSearchParams({
    action: "parse", oldid: String(page.revision_id), prop: "text|revid", format: "json", formatversion: "2", disableeditsection: "1"
  });
  let response;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(url, { headers: { "user-agent": "shanghan-jingui-ji/0.5 (source import; GitHub happywa147/shanghan-jingui-ji)" } });
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((done) => setTimeout(done, attempt * 500));
    }
  }
  if (!response) throw new Error(`${page.part} 获取失败: ${lastError?.message ?? "网络错误"}`);
  if (!response.ok) throw new Error(`${page.part} 获取失败: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error || payload.parse?.revid !== page.revision_id || payload.parse?.title !== page.title) {
    throw new Error(`${page.part} 修订或标题不匹配`);
  }
  const html = payload.parse.text;
  const text = renderedHtmlToText(html);
  if (text.length < (page.part.startsWith("卷") ? 5000 : 100)) throw new Error(`${page.part} 正文长度异常`);
  return {
    part: page.part,
    source_title: page.title,
    revision_id: page.revision_id,
    permanent_url: `https://zh.wikisource.org/w/index.php?title=${encodeURIComponent(page.title)}&oldid=${page.revision_id}`,
    rendered_sha256: createHash("sha256").update(html).digest("hex"),
    chapter_markers: chapterMarkers(text),
    image_glyph_refs: [...new Set([...html.matchAll(/<img\b[^>]*\balt="([^"]+)"[^>]*>/giu)].map((match) => decodeHtml(match[1])))],
    text
  };
}

async function main() {
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const parts = [];
  for (const page of source.pages) parts.push(await fetchRevision(page));
  const output = {
    schema_version: 1,
    source_id: source.source_id,
    work_id: source.work_id,
    edition_id: source.edition_id,
    title: source.title,
    edition_description: source.edition_description,
    license: source.license,
    quality: source.quality,
    retrieved_at: source.retrieved_at,
    importer: "scripts/import-wikisource-jingui.mjs",
    parts
  };
  const temporary = `${outputPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`);
  await rename(temporary, outputPath);
  console.log(`《金匱要略》维基文库转录导入完成：${parts.length} 部分，${parts.reduce((sum, part) => sum + part.text.length, 0)} 字符`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
