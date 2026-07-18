import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderedHtmlToText } from "../scripts/import-wikisource-jingui.mjs";

test("维基文库渲染文本去除样式并保留图片字", () => {
  const html = '<style>.x{color:red}</style><div class="prp-pages-output"><p>正文<img alt="缺字" src="x"></p></div>';
  assert.equal(renderedHtmlToText(html), "正文[图字:缺字]");
});

test("《金匱要略》固定修订导入覆盖序、目录和三卷", async () => {
  const data = JSON.parse(await readFile(new URL("../data/imported/jingui-wikisource.json", import.meta.url), "utf8"));
  assert.deepEqual(data.parts.map((part) => part.revision_id), [2675184, 2675185, 2675186, 2675187, 2675188]);
  assert.equal(data.quality.status, "unreviewed_transcription");
  assert.equal(data.parts.length, 5);
  assert.ok(data.parts.reduce((sum, part) => sum + part.text.length, 0) > 50000);
  assert.ok(data.parts.flatMap((part) => part.chapter_markers).length >= 25);
  assert.ok(data.parts.some((part) => part.image_glyph_refs.length > 0));
});
