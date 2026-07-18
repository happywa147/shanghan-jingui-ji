import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const path of ["/", "/report.html", "/formulas.html"]) {
  test(`${path} 无严重或高危无障碍问题`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "无障碍规则集中在 Chromium 执行，避免重复 DOM 扫描");
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact))).toEqual([]);
  });
}

test("条文筛选、草稿保存与清除", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "移动端由响应式专项覆盖");
  await page.goto("/report.html");
  await page.getByLabel("目标版本").selectOption("guilin");
  await expect(page.locator("article:not([hidden])")).not.toHaveCount(0);
  const visible = page.locator("article:not([hidden])");
  await visible.first().locator(".status").selectOption("confirmed");
  await page.reload();
  await expect(page.locator('article[data-review="confirmed"]')).not.toHaveCount(0);
  await page.getByRole("button", { name: "清除本地草稿" }).click();
  await expect(page.locator('article[data-review="confirmed"]')).toHaveCount(0);
});

test("方剂筛选及就地安全警示", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "移动端由响应式专项覆盖");
  await page.goto("/formulas.html");
  await page.getByLabel("检索方名").fill("四逆汤");
  await expect(page.locator("article:not([hidden])")).not.toHaveCount(0);
  await expect(page.locator("article:not([hidden]) .item-warning")).not.toHaveCount(0);
});

test("移动端可检索且控制项不溢出视口", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "仅在移动设备配置执行");
  await page.goto("/formulas.html");
  await page.getByLabel("检索方名").fill("四逆汤");
  await expect(page.locator("article:not([hidden])")).not.toHaveCount(0);
  const viewport = page.viewportSize();
  const box = await page.getByLabel("检索方名").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
});
