import { test, expect } from "@playwright/test";

const repoUrl = "https://github.com/FilippTrigub/abra";

test.describe("Sign-in page", () => {
  test("should render the landing page controls on /", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/(?:\/en)?\/$/);
    await expect(
      page.getByRole("heading", { name: "Turn real conversations into posts, on your own stack or ours." }),
    ).toBeVisible();

    const repoCta = page.getByRole("link", { name: "View the repo" }).first();
    await expect(repoCta).toBeVisible();
    await expect(repoCta).toHaveAttribute("href", repoUrl);

    const managedCta = page.getByRole("link", { name: "Try managed hosting" }).first();
    await expect(managedCta).toBeVisible();
    await expect(managedCta).toHaveAttribute("href", "/sign-in");

    const repoNavLink = page.getByRole("link", { name: "Repo", exact: true });
    await expect(repoNavLink).toBeVisible();
    await expect(repoNavLink).toHaveAttribute("href", repoUrl);

    const selfHostNavLink = page.getByRole("link", { name: "Self-host", exact: true });
    await expect(selfHostNavLink).toBeVisible();
    await expect(selfHostNavLink).toHaveAttribute("href", "#self-host");

    const pricingNavLink = page.getByRole("link", { name: "Pricing", exact: true });
    await expect(pricingNavLink).toBeVisible();
    await expect(pricingNavLink).toHaveAttribute("href", "#pricing");

    const signInNavLink = page.getByRole("link", { name: "Sign in", exact: true });
    await expect(signInNavLink).toBeVisible();
    await expect(signInNavLink).toHaveAttribute("href", "/sign-in");

    await managedCta.click();

    await expect(page).toHaveURL(/(?:\/en)?\/sign-in$/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
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
