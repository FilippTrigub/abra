import { test, expect } from "@playwright/test";

test.describe("Sign-in page", () => {
  test("should render the landing page controls on /", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/(?:\/en)?\/$/);
    await expect(
      page.getByRole("heading", { name: "Turn real conversations into posts that still sound like you." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Start with one note" })).toBeVisible();
  });

  test("should show Google and GitHub provider buttons", async ({ page }) => {
    await page.goto("/sign-in");

    const googleButton = page.getByRole("button", { name: "Continue with Google" });
    await expect(googleButton).toBeVisible();

    const githubButton = page.getByRole("button", { name: "Continue with GitHub" });
    await expect(githubButton).toBeVisible();
  });

  test("should redirect unauthenticated users from /dashboard to /sign-in", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/(?:\/en)?\/sign-in\?from=%2Fdashboard/);
    await expect(
      page.getByRole("heading", { name: "Sign In" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
  });
});
