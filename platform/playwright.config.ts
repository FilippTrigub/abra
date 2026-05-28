import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "src/__e2e__",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? "list"
    : [["html", { outputFolder: "playwright-test-results" }]],
  use: {
    baseURL: "http://127.0.0.1:3978",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/dashboard-shell.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-github",
      testIgnore: ["**/sign-in.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm exec next dev --hostname 127.0.0.1 --port 3978",
    url: "http://127.0.0.1:3978",
    reuseExistingServer: false,
    cwd: __dirname,
  },
});
