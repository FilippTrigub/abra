import { test, expect } from "@playwright/test";

test.describe("Sign-in page", () => {
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

    await expect(page).toHaveURL(/.*\/sign-in.*/);
  });
});
