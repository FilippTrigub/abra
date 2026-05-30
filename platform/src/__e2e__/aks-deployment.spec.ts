import fs from "node:fs";
import path from "node:path";

import * as admin from "firebase-admin";
import { type APIRequestContext, expect, test } from "@playwright/test";

import type { DashboardDeployment } from "@/lib/deployments";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_USER_ID = "e2e-aks-deployment-user";
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

// How long to wait for the deployment to reach a terminal state
const DEPLOY_TIMEOUT_MS = 12 * 60 * 1000;
// How long to wait for a destroy to complete before starting a fresh deploy
const DESTROY_TIMEOUT_MS = 5 * 60 * 1000;
// Interval between status polls
const POLL_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------------
// Firebase helpers (copied from dashboard-shell.spec.ts pattern)
// ---------------------------------------------------------------------------

function readFirebaseEnv(
  name:
    | "FIREBASE_PROJECT_ID"
    | "FIREBASE_CLIENT_EMAIL"
    | "FIREBASE_PRIVATE_KEY"
    | "NEXT_PUBLIC_FIREBASE_API_KEY",
): string {
  const direct = process.env[name];
  if (direct) return direct;

  for (const filename of ["../../.env.local", "../../.env"] as const) {
    const filePath = path.resolve(__dirname, filename);
    if (!fs.existsSync(filePath)) continue;

    const match = fs
      .readFileSync(filePath, "utf-8")
      .match(new RegExp(`^${name}=(.*)$`, "m"));

    if (!match) continue;

    const rawValue = match[1].trim();
    return rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1).replace(/\\n/g, "\n")
      : rawValue;
  }

  throw new Error(`Missing ${name} — set it in .env.local or as an env var.`);
}

function getTestAdminAuth(): admin.auth.Auth {
  if (admin.apps.length > 0) return admin.auth();

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: readFirebaseEnv("FIREBASE_PROJECT_ID"),
      clientEmail: readFirebaseEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: readFirebaseEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });

  return admin.auth();
}

async function ensureTestFirestoreAccount(userId: string): Promise<void> {
  const firestore = admin.firestore();
  const docRef = firestore.doc(`accounts/${userId}`);
  const snap = await docRef.get();

  if (!snap.exists) {
    await docRef.set({
      authUserId: userId,
      subscriptionPlan: "free",
      subscriptionStatus: "active",
      subscriptionCancellationReason: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function createSessionCookie(): Promise<string> {
  const auth = getTestAdminAuth();
  const email = `${TEST_USER_ID}@example.test`;

  try {
    await auth.getUser(TEST_USER_ID);
  } catch {
    await auth.createUser({
      uid: TEST_USER_ID,
      email,
      emailVerified: true,
      displayName: "E2E AKS Deployment",
    });
  }

  await ensureTestFirestoreAccount(TEST_USER_ID);

  const customToken = await auth.createCustomToken(TEST_USER_ID);
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
    throw new Error(`Firebase sign-in failed: ${signInResponse.status}`);
  }

  const { idToken } = (await signInResponse.json()) as { idToken?: string };
  if (!idToken) throw new Error("Missing idToken from Firebase custom-token exchange.");

  return auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
}

// ---------------------------------------------------------------------------
// Deployment polling helper
// ---------------------------------------------------------------------------

type TerminalStatus = "succeeded" | "failed" | "deleted";

async function pollUntil(
  request: APIRequestContext,
  deploymentId: string,
  terminalStatuses: TerminalStatus[],
  timeoutMs: number,
): Promise<DashboardDeployment> {
  const deadline = Date.now() + timeoutMs;
  let last: DashboardDeployment | null = null;
  let elapsed = 0;

  while (Date.now() < deadline) {
    const response = await request.get(`/api/dashboard/deployments/${deploymentId}/status`);

    if (response.status() === 404) {
      throw new Error("Deployment not found — was it created successfully?");
    }

    if (!response.ok()) {
      throw new Error(`Status API returned ${response.status()}: ${await response.text()}`);
    }

    last = (await response.json()) as DashboardDeployment;
    elapsed = Math.round((Date.now() - (deadline - timeoutMs)) / 1000);

    console.log(
      `[${elapsed}s] status=${last.status} action=${last.orchestration?.action ?? "—"} error=${last.errorMessage ?? "—"}`,
    );

    if ((terminalStatuses as string[]).includes(last.status)) {
      return last;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timeout after ${timeoutMs / 1000}s waiting for [${terminalStatuses.join(",")}]. ` +
    `Last: status=${last?.status ?? "unknown"}, error=${last?.errorMessage ?? "—"}`,
  );
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let sessionCookieValue = "";

test.beforeAll(async () => {
  sessionCookieValue = await createSessionCookie();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "__session",
      value: sessionCookieValue,
      url: process.env.E2E_BASE_URL ?? "https://abra-platform.vercel.app",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("AKS deployment lifecycle", () => {
  test("deploys a new Abra runtime and reaches 'succeeded' status", async ({ page, request }) => {
    const deploymentId = "abra-instance";

    // --- Step 1: navigate and check for a pre-existing deployment ------------
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const deleteBtn = page.getByRole("button", { name: "Delete instance" });
    const deployBtn = page.getByRole("button", { name: "Deploy Abra" });

    const hasExisting = await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasExisting) {
      console.log("Existing deployment found — deleting before test run...");
      await deleteBtn.click();

      const destroyed = await pollUntil(request, deploymentId, ["deleted", "failed"], DESTROY_TIMEOUT_MS)
        .catch((err) => { throw new Error(`Cleanup failed: ${err.message}`); });

      console.log(`Cleanup complete: status=${destroyed.status}`);
      await page.reload();
      await page.waitForLoadState("networkidle");
    }

    // --- Step 2: trigger new deployment ----------------------------------------
    await expect(deployBtn).toBeVisible({ timeout: 10_000 });
    await deployBtn.click();

    // Give the server action a moment to register the queued state
    await page.waitForTimeout(2_000);

    // --- Step 3: poll until terminal -------------------------------------------
    const result = await pollUntil(
      request,
      deploymentId,
      ["succeeded", "failed"],
      DEPLOY_TIMEOUT_MS,
    );

    // --- Step 4: assertions ----------------------------------------------------
    console.log("Final deployment:", JSON.stringify(result, null, 2));

    expect(
      result.status,
      `Deployment failed with error: ${result.errorMessage ?? "unknown"}`,
    ).toBe("succeeded");

    // resultUrl holds the AKS resource handle on success
    expect(result.resultUrl).toMatch(/^aks-runtime\//);

    // The orchestration record should reference the completed operation
    expect(result.orchestration?.operationId).toBeTruthy();
    expect(result.orchestration?.lastKnownStatus).toBe("succeeded");
  });
});
