import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const githubStorageState = path.resolve(__dirname, "../playwright/.auth/github.json");

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
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-github",
      testIgnore: ["**/sign-in.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: githubStorageState,
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
  },
});
