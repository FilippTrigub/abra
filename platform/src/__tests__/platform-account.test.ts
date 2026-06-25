/**
 * Unit tests for platform-account Firestore migration.
 *
 * Tests account bootstrap idempotency, Firestore reads, and default values.
 * Skips when FIREBASE_EMULATOR_HOST is not set.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getSubscriptionInfo, ensurePlatformAccount, getPlatformAccount } from "@/lib/platform-account";

function expectDefined<T>(value: T | null | undefined, message: string): asserts value is T {
  expect(value, message).toBeDefined();
}

describe("platform-account Firestore integration", () => {
  const emulatorHost = process.env.FIREBASE_EMULATOR_HOST;

  if (!emulatorHost) {
    it.skip("skipped — FIREBASE_EMULATOR_HOST not set", () => {});
    return;
  }

  let firestore: ReturnType<typeof getAdminFirestore>;
  let testUid: string;

  beforeAll(async () => {
    const adminMod = await import("@/lib/firebase/admin");
    firestore = adminMod.getAdminFirestore();
    // Generate a unique test UID
    testUid = `test_user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  });

  afterEach(async () => {
    // Clean up test document after each test
    try {
      await firestore.doc(`accounts/${testUid}`).delete();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("ensurePlatformAccount", () => {
    it("should create new account with explicit defaults on first call", async () => {
      const result = await ensurePlatformAccount(testUid);

      expect(result.booted).toBe(true);
      expectDefined(result.account, "account should be created");
      expect(result.account.id).toBe(testUid);
      expect(result.account.subscription_plan).toBe("free");
      expect(result.account.subscription_status).toBe("active");
      expect(result.account.subscription_cancellation_reason).toBe(null);
    });

    it("should return booted=false on subsequent calls (idempotent)", async () => {
      // First call creates account
      await ensurePlatformAccount(testUid);

      // Second call should not re-boot
      const result = await ensurePlatformAccount(testUid);

      expect(result.booted).toBe(false);
      expectDefined(result.account, "account should exist on repeat call");
      expect(result.account.id).toBe(testUid);
    });

    it("should preserve defaults across multiple bootstrap calls", async () => {
      // Bootstrap multiple times
      await ensurePlatformAccount(testUid);
      await ensurePlatformAccount(testUid);
      await ensurePlatformAccount(testUid);

      // Verify account still has defaults
      const account = await getPlatformAccount(testUid);

      expectDefined(account, "account should be loaded");
      expect(account.subscriptionPlan).toBe("free");
      expect(account.subscriptionStatus).toBe("active");
    });
  });

  describe("getPlatformAccount", () => {
    it("should return null for non-existent account", async () => {
      const result = await getPlatformAccount(`non_existent_uid_${Date.now()}`);
      expect(result).toBeNull();
    });

    it("should return Firestore account object with required fields", async () => {
      // Create account first
      await ensurePlatformAccount(testUid);

      const account = await getPlatformAccount(testUid);

      expectDefined(account, "account should be loaded");
      expect(account.id).toBe(testUid);
      expect(account.authUserId).toBe(testUid);
      expect(account.subscriptionPlan).toBe("free");
      expect(account.subscriptionStatus).toBe("active");
      expect(account.subscriptionCancellationReason).toBe(null);
      expect(account.createdAt).toBeInstanceOf(Timestamp);
      expect(account.updatedAt).toBeInstanceOf(Timestamp);
    });

    it("should have createdAt and updatedAt timestamps", async () => {
      await ensurePlatformAccount(testUid);

      const account = await getPlatformAccount(testUid);

      expectDefined(account, "account should be loaded");
      expect(account.createdAt).toBeDefined();
      expect(account.updatedAt).toBeDefined();
    });
  });

});

describe("getSubscriptionInfo", () => {
  it("should return active/free for account with default values", () => {
    const account = {
      subscription_plan: "free",
      subscription_status: "active",
      subscription_cancellation_reason: null,
    };

    const subInfo = getSubscriptionInfo(account);

    expect(subInfo.status).toBe("active");
    expect(subInfo.plan).toBe("free");
    expect(subInfo.cancellationReason).toBe(null);
  });

  it("should support the managed growth plan", () => {
    const subInfo = getSubscriptionInfo({
      subscription_plan: "growth",
      subscription_status: "active",
    });

    expect(subInfo.status).toBe("active");
    expect(subInfo.plan).toBe("growth");
  });

  it("should return missing/unknown for a missing account", () => {
    const subInfo = getSubscriptionInfo(null);

    expect(subInfo.status).toBe("missing");
    expect(subInfo.plan).toBe("unknown");
  });

  it("should defensively hide legacy paid plans from user-facing reads", () => {
    for (const legacyPlan of ["pro", "enterprise", "paid", "team"]) {
      const subInfo = getSubscriptionInfo({
        subscription_plan: legacyPlan,
        subscription_status: undefined,
      });

      expect(subInfo.status).toBe("active");
      expect(subInfo.plan).toBe("unknown");
    }
  });

  it("should validate subscription status enum", () => {
    const account = {
      subscription_plan: "free",
      subscription_status: "invalid_status",
    };

    const subInfo = getSubscriptionInfo(account);

    // Invalid status falls back to active
    expect(subInfo.status).toBe("active");
  });

  it("should validate subscription plan enum", () => {
    const account = {
      subscription_plan: "invalid_plan",
      subscription_status: "active",
    };

    const subInfo = getSubscriptionInfo(account);

    // Invalid plan becomes unknown
    expect(subInfo.plan).toBe("unknown");
  });
});
