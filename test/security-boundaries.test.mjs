import test from "node:test";
import assert from "node:assert/strict";
import { resolveInside } from "../lib/safe-path.mjs";
import { escapeHtml } from "../lib/html.mjs";

test("拒绝来源路径逃逸与绝对路径", () => {
  assert.throws(() => resolveInside("data/raw", "../../outside"));
  assert.throws(() => resolveInside("data/raw", "/tmp/outside"));
});
test("允许data/raw内合法路径", () => assert.match(resolveInside("data/raw", "data/raw/book.djvu"), /data\/raw\/book\.djvu$/));
test("HTML属性载荷被转义", () => assert.equal(escapeHtml(`x\" onmouseover=\"alert(1)<svg>`), "x&quot; onmouseover=&quot;alert(1)&lt;svg&gt;"));
