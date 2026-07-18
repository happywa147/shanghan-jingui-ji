import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";

async function pages(prefix) {
  return (await readdir("docs/site")).filter((file) => new RegExp(`^${prefix}(-\\d+)?\\.html$`).test(file));
}

test("条文与方剂报告真实分片且单页不超过50条", async () => {
  for (const [prefix, expected] of [["report", 779], ["formulas", 525]]) {
    let total = 0;
    for (const file of await pages(prefix)) {
      const html = await readFile(`docs/site/${file}`, "utf8");
      const count = (html.match(/<article\b/g) || []).length;
      assert.ok(count <= 50, `${file} 含 ${count} 条`);
      assert.ok((await stat(`docs/site/${file}`)).size <= 300_000, `${file} 超过300KB预算`);
      total += count;
    }
    assert.equal(total, expected);
  }
});

test("全部方剂均有就地安全警示和稳定ID", async () => {
  let warnings = 0;
  let ids = 0;
  for (const file of await pages("formulas")) {
    const html = await readFile(`docs/site/${file}`, "utf8");
    warnings += (html.match(/class="item-warning"/g) || []).length;
    ids += (html.match(/<article id="formula:/g) || []).length;
  }
  assert.equal(warnings, 525);
  assert.equal(ids, 525);
});
