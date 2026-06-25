import fs from "node:fs";
import path from "node:path";

import * as admin from "firebase-admin";
import { expect, test } from "@playwright/test";

const TEST_USER_ID = "e2e-billing-summary-user";
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
      displayName: "E2E Billing Summary",
    });
  }

  const customToken = await auth.createCustomToken(TEST_USER_ID, {
    name: "E2E Billing Summary",
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
  await firestore.doc(`accounts/${TEST_USER_ID}/summaries/billing`).set(
    {
      tier: "free",
      status: "missing",
      quota: { unit: "managed_inbound_message", limit: 25 },
      stripeCustomerId: "cus_should_not_render",
      stripeSubscriptionId: "sub_should_not_render",
      webhookEventId: "evt_should_not_render",
      operatorNote: "operator note should not render",
      runtimeCredential: "runtime_should_not_render",
      rawProviderCost: 77,
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

test.describe("Billing summary dashboard", () => {
  test("shows a free billing summary without sensitive fields", async ({ page }) => {
    await page.goto("/dashboard/billing");

    await expect(page).toHaveURL(/(?:\/en)?\/dashboard\/billing$/);
    await expect(page.getByRole("heading", { name: "Usage summary" })).toBeVisible();
    await expect(page.getByText("Free").first()).toBeVisible();
    await expect(page.getByText("Remaining", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upgrade" })).toBeVisible();
    await expect(page.getByText("cus_should_not_render")).toHaveCount(0);
    await expect(page.getByText("sub_should_not_render")).toHaveCount(0);
    await expect(page.getByText("operator note should not render")).toHaveCount(0);
    await expect(page.getByText("runtime_should_not_render")).toHaveCount(0);

    const screenshotPath = path.resolve(__dirname, "../../../.sisyphus/evidence/task-10-free-summary.png");
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
