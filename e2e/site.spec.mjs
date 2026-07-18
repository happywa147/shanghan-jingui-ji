import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const path of ["/", "/report.html", "/formulas.html", "/editions.html"]) {
  test(`${path} 无严重或高危无障碍问题`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "无障碍规则集中在 Chromium 执行，避免重复 DOM 扫描");
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact))).toEqual([]);
  });
}

test("条文草稿实时保存、确认清除与撤销", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "移动端由响应式专项覆盖");
  await page.goto("/report.html");
  const first = page.locator("article").first();
  await first.locator(".status").selectOption("confirmed");
  await first.locator(".review-note").fill("实时保存测试");
  await first.locator(".evidence-source").fill("scan:test-1");
  await first.locator(".evidence-locator").fill("p.1");
  await expect(page.getByRole("status")).toContainText("已保存");
  await page.reload();
  await expect(page.locator('article[data-review="confirmed"]')).not.toHaveCount(0);
  await expect(page.locator(".review-note").first()).toHaveValue("实时保存测试");
  await page.getByLabel("审核者标识").fill("e2e-reviewer");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出审核" }).click();
  const exported = JSON.parse(await (await import("node:fs/promises")).readFile(await (await downloadPromise).path(), "utf8"));
  expect(exported.reviews[Object.keys(exported.reviews)[0]].evidence_refs).toEqual([{ source_id: "scan:test-1", locator: "p.1" }]);
  await page.getByRole("button", { name: "清除本地草稿" }).click();
  await expect(page.getByText(/将清除 1 条本地草稿/)).toBeVisible();
  await page.getByRole("button", { name: "确认清除" }).click();
  await expect(page.locator('article[data-review="confirmed"]')).toHaveCount(0);
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.locator('article[data-review="confirmed"]')).not.toHaveCount(0);
});

test("条文静态分页与深链", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "移动端由响应式专项覆盖");
  await page.goto("/report.html");
  await expect(page.locator("article")).toHaveCount(50);
  const id = await page.locator("article").first().getAttribute("id");
  await page.goto(`/report.html#${encodeURIComponent(id)}`);
  await expect(page.locator(":target")).toHaveAttribute("id", id);
  await page.getByRole("link", { name: "下一页" }).first().click();
  await expect(page).toHaveURL(/report-2\.html$/);
  await expect(page.locator("article")).toHaveCount(50);
});

test("525方覆盖中的未配对方与逐条安全警示", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "移动端由响应式专项覆盖");
  await page.goto("/formulas-2.html");
  await page.getByLabel("配对状态").selectOption("false");
  await expect(page.locator('article[data-paired="false"]:not([hidden])')).not.toHaveCount(0);
  await page.getByLabel("检索当前页方名").fill("三物白散");
  const item = page.locator('article:not([hidden])');
  await expect(item).not.toHaveCount(0);
  await expect(item.locator(".item-warning")).toContainText("巴豆");
  await expect(item.locator(".item-warning")).toContainText("不可据此配制或服用");
});

test("移动端条文审核控件不溢出视口", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "仅在移动设备配置执行");
  await page.goto("/report.html");
  const viewport = page.viewportSize();
  for (const control of [page.getByLabel("检索当前页条文"), page.locator(".status").first(), page.locator(".review-note").first()]) {
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
});
