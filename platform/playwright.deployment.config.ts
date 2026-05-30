import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for AKS deployment E2E tests.
 *
 * These tests target the live production URL because the AKS cluster is only
 * reachable from Vercel's production environment. They have long timeouts
 * (up to 15 minutes) to accommodate AKS pod scheduling and readiness.
 *
 * Run with:
 *   pnpm playwright test --config=playwright.deployment.config.ts
 *
 * Required env vars (read from .env.local if not set in shell):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *
 * Optional:
 *   E2E_BASE_URL  — override the target URL (default: https://abra-platform.vercel.app)
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "https://abra-platform.vercel.app";

export default defineConfig({
  testDir: "src/__e2e__",
  testMatch: ["**/aks-deployment.spec.ts"],
  // Each test can run up to 15 minutes (AKS scheduling + readiness)
  timeout: 15 * 60 * 1000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? "list"
    : [["html", { outputFolder: "playwright-test-results/deployment" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No webServer — we target the live production deployment
});
