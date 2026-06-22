import fs from "node:fs";
import path from "node:path";

import * as admin from "firebase-admin";
import { expect, test } from "@playwright/test";

const TEST_USER_ID = "e2e-dashboard-shell-user";
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
let sessionCookieValue = "";

function readFirebaseEnv(
  name:
    | "FIREBASE_PROJECT_ID"
    | "FIREBASE_CLIENT_EMAIL"
    | "FIREBASE_PRIVATE_KEY"
    | "NEXT_PUBLIC_FIREBASE_API_KEY",
): string {
  const direct = process.env[name];
  if (direct) {
    return direct;
  }

  for (const filename of ["../../.env.local", "../../.env"] as const) {
    const filePath = path.resolve(__dirname, filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const match = fs
      .readFileSync(filePath, "utf-8")
      .match(new RegExp(`^${name}=(.*)$`, "m"));

    if (!match) {
      continue;
    }

    const rawValue = match[1].trim();
    return rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1).replace(/\\n/g, "\n")
      : rawValue;
  }

  throw new Error(`Missing ${name} for E2E auth seeding.`);
}

function getTestAdminAuth(): admin.auth.Auth {
  if (admin.apps.length > 0) {
    return admin.auth();
  }

  const projectId = readFirebaseEnv("FIREBASE_PROJECT_ID");
  const clientEmail = readFirebaseEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = readFirebaseEnv("FIREBASE_PRIVATE_KEY");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  return admin.auth();
}

test.beforeAll(async () => {
  const auth = getTestAdminAuth();
  const email = `${TEST_USER_ID}@example.test`;

  try {
    await auth.getUser(TEST_USER_ID);
  } catch {
    await auth.createUser({
      uid: TEST_USER_ID,
      email,
      emailVerified: true,
      displayName: "E2E Dashboard Shell",
    });
  }

  const customToken = await auth.createCustomToken(TEST_USER_ID, {
    name: "E2E Dashboard Shell",
    email,
  });

  const apiKey = readFirebaseEnv("NEXT_PUBLIC_FIREBASE_API_KEY");
  const signInResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );

  if (!signInResponse.ok) {
    throw new Error(`Failed to exchange custom token for ID token: ${signInResponse.status}`);
  }

  const signInData = (await signInResponse.json()) as { idToken?: string };
  if (!signInData.idToken) {
    throw new Error("Missing idToken from Firebase custom-token exchange.");
  }

  sessionCookieValue = await auth.createSessionCookie(
    signInData.idToken,
    { expiresIn: SESSION_DURATION_MS },
  );
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "__session",
      value: sessionCookieValue,
      url: "http://127.0.0.1:3978",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
});

test.describe("Authenticated dashboard shell", () => {
  test("should render the dashboard command center on /dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/(?:\/en)?\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: "Your brand command center" }),
    ).toBeVisible();
    // No Telegram config seeded for this test user, so Start is disabled
    // until Telegram is configured in Settings.
    await expect(page.getByRole("button", { name: "Start" })).toBeDisabled();

    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Usage" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });

  test("should render dashboard settings controls on /dashboard/settings", async ({ page }) => {
    await page.goto("/dashboard/settings");

    await expect(page).toHaveURL(/(?:\/en)?\/dashboard\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Telegram bot" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Buffer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Azure Foundry (default)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Skill integrations" })).toBeVisible();
  });
});
