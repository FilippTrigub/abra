import fs from "node:fs";
import path from "node:path";

import * as admin from "firebase-admin";
import { expect, test } from "@playwright/test";

const TEST_USER_ID = "e2e-dashboard-shell-user";
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
let sessionCookieValue = "";
let seededAdminApp: admin.app.App | null = null;

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
    seededAdminApp = admin.app();
    return admin.auth();
  }

  const projectId = readFirebaseEnv("FIREBASE_PROJECT_ID");
  const clientEmail = readFirebaseEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = readFirebaseEnv("FIREBASE_PRIVATE_KEY");

  seededAdminApp = admin.initializeApp({
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
  if (!seededAdminApp) {
    throw new Error("Firebase Admin app was not initialized for E2E seeding.");
  }
  const firestore = seededAdminApp.firestore();
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

  const now = admin.firestore.FieldValue.serverTimestamp();
  await firestore.doc(`accounts/${TEST_USER_ID}`).set(
    {
      authUserId: TEST_USER_ID,
      subscriptionPlan: "free",
      subscriptionStatus: "active",
      subscriptionCancellationReason: null,
      updatedAt: now,
      createdAt: now,
    },
    { merge: true },
  );
  await firestore.doc(`accounts/${TEST_USER_ID}/brand-profile/current`).set(
    {
      brandDescription:
        "E2E Dashboard Shell helps test authenticated Abra setup with a concise, credible operator voice.",
      markdown:
        "# Brand Profile\n\n## User Description\nE2E Dashboard Shell helps test authenticated Abra setup with a concise, credible operator voice.\n",
      completedAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
  await firestore.doc(`accounts/${TEST_USER_ID}/agent-config/current`).set(
    {
      telegramBotToken: "e2e-token",
      telegramHomeChannel: "388259993",
      telegramAllowedUsers: "388259993",
      updatedAt: now,
    },
    { merge: true },
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
  test("should render the dashboard shell on /dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/(?:\/en)?\/dashboard$/);
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Start" })).toBeEnabled();

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

    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Restart onboarding" })).toBeVisible();
  });

  test("should hide dashboard chrome on onboarding restart", async ({ page }) => {
    await page.goto("/dashboard/onboarding?restart=1");

    await expect(page).toHaveURL(/(?:\/en)?\/dashboard\/onboarding\?restart=1$/);
    await expect(page.getByText("Abra setup")).toBeVisible();
    await expect(page.getByLabel("Brand description")).toBeVisible();
    await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  });
});
