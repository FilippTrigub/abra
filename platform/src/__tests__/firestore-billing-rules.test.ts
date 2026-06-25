import { readFileSync } from "node:fs";
import path from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const FIRESTORE_RULES = readFileSync(path.join(process.cwd(), "firestore.rules"), "utf8");
const PROJECT_ID = "demo-claw-parade-billing-rules";

const OWNER_UID = "billing-owner";
const OTHER_UID = "billing-non-owner";

const SAFE_BILLING_SUMMARY_PATH = `accounts/${OWNER_UID}/summaries/billing`;

const INTERNAL_PATHS = [
  `accounts/${OWNER_UID}/billing/internal`,
  `accounts/${OWNER_UID}/quota/windows/2026-W26/current`,
  `accounts/${OWNER_UID}/usage/events/usage-event-1/current`,
  `accounts/${OWNER_UID}/billing/events/billing-event-1/current`,
  `accounts/${OWNER_UID}/moderation/current`,
  "stripeWebhookEvents/evt_test_1",
] as const;

describe("Firestore billing and metering security rules", () => {
  if (!process.env.FIREBASE_EMULATOR_HOST) {
    it.skip("skipped — FIREBASE_EMULATOR_HOST not set", () => {});
    return;
  }

  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: FIRESTORE_RULES,
      },
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  async function seedDoc(documentPath: string, data: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(documentPath).set(data);
    });
  }

  async function updateDocAsAdmin(documentPath: string, data: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(documentPath).update(data);
    });
  }

  it("allows an account owner to read the sanitized billing summary", async () => {
    await seedDoc(SAFE_BILLING_SUMMARY_PATH, {
      tier: "growth",
      status: "active",
      quota: {
        unit: "managed_inbound_message",
        limit: 1000,
        used: 12,
        remaining: 988,
        windowId: "2026-W26",
      },
      updatedAt: "2026-06-25T00:00:00.000Z",
    });

    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    const snapshot = await assertSucceeds(ownerDb.doc(SAFE_BILLING_SUMMARY_PATH).get());

    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()).toMatchObject({
      tier: "growth",
      status: "active",
      quota: {
        unit: "managed_inbound_message",
        limit: 1000,
        used: 12,
        remaining: 988,
        windowId: "2026-W26",
      },
    });
  });

  it("denies non-owner reads and all browser writes to the billing summary", async () => {
    await seedDoc(SAFE_BILLING_SUMMARY_PATH, {
      tier: "free",
      status: "active",
    });

    const nonOwnerDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();

    await assertFails(nonOwnerDb.doc(SAFE_BILLING_SUMMARY_PATH).get());
    await assertFails(
      ownerDb.doc(SAFE_BILLING_SUMMARY_PATH).set(
        {
          tier: "growth",
          stripeCustomerId: "cus_should_never_be_browser_written",
        },
        { merge: true },
      ),
    );
  });

  it("denies owner reads when a billing summary contains sensitive server fields", async () => {
    await seedDoc(SAFE_BILLING_SUMMARY_PATH, {
      tier: "growth",
      status: "active",
      stripeCustomerId: "cus_internal_only",
    });

    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();

    await assertFails(ownerDb.doc(SAFE_BILLING_SUMMARY_PATH).get());
  });

  it("denies browser reads and writes for server-owned billing, quota, usage, moderation, and Stripe docs", async () => {
    for (const documentPath of INTERNAL_PATHS) {
      await seedDoc(documentPath, {
        serverOwned: true,
        stripeCustomerId: "cus_internal_only",
        rawProviderCostMicros: 12345,
        operatorNotes: "internal-only",
      });
    }

    const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
    const nonOwnerDb = testEnv.authenticatedContext(OTHER_UID).firestore();
    const anonymousDb = testEnv.unauthenticatedContext().firestore();

    for (const documentPath of INTERNAL_PATHS) {
      await assertFails(ownerDb.doc(documentPath).get());
      await assertFails(nonOwnerDb.doc(documentPath).get());
      await assertFails(anonymousDb.doc(documentPath).get());
      await assertFails(
        ownerDb.doc(documentPath).set(
          {
            serverOwned: false,
            attemptedFromBrowser: true,
          },
          { merge: true },
        ),
      );
    }
  });

  it("allows server/Admin contexts to create and update internal docs", async () => {
    for (const documentPath of INTERNAL_PATHS) {
      await seedDoc(documentPath, {
        serverOwned: true,
        createdBy: "admin-test",
      });

      await updateDocAsAdmin(documentPath, {
        updatedBy: "admin-test",
      });
    }

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();

      for (const documentPath of INTERNAL_PATHS) {
        const snapshot = await adminDb.doc(documentPath).get();
        expect(snapshot.exists).toBe(true);
        expect(snapshot.data()).toMatchObject({
          serverOwned: true,
          createdBy: "admin-test",
          updatedBy: "admin-test",
        });
      }
    });
  });
});
