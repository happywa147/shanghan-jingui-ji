import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "dist/test-evidence/playwright.json" }],
    ...(process.env.CI ? [["html", { open: "never" }]] : [])
  ],
  use: { baseURL: "http://127.0.0.1:43917", trace: "retain-on-failure" },
  webServer: {
    command: "npx http-server docs/site -a 127.0.0.1 -p 43917 -c-1",
    url: "http://127.0.0.1:43917",
    reuseExistingServer: false
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } }
  ]
});
