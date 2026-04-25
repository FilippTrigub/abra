/* ═══════════════════════════════════════════════════════
   Subscription types — v1 stub, no billing logic
   ═══════════════════════════════════════════════════════ */

import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type SubscriptionStatus = "active" | "inactive" | "missing";
export type SubscriptionPlan = "free" | "pro" | "enterprise" | "unknown";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  cancellationReason: string | null;
}

/**
 * Read subscription state from an account object (Firestore doc or legacy row).
 * Returns "active" / "free" for every v1 user (no billing integration).
 * Falls back to inactive when the object lacks subscription fields entirely.
 */
export function getSubscriptionInfo(account: {
  subscription_plan?: string | null;
  subscription_status?: string | null;
  subscription_cancellation_reason?: string | null;
} | null): SubscriptionInfo {
  if (!account) {
    return { status: "missing", plan: "unknown", cancellationReason: null };
  }

  const rawPlan = (account.subscription_plan ?? "free") as SubscriptionPlan;
  const validPlans: SubscriptionPlan[] = ["free", "pro", "enterprise", "unknown"];
  const plan = validPlans.includes(rawPlan) ? rawPlan : "unknown";

  const rawStatus = (account.subscription_status ?? "active") as SubscriptionStatus;
  const validStatuses: SubscriptionStatus[] = ["active", "inactive", "missing"];
  const status = validStatuses.includes(rawStatus) ? rawStatus : "active";

  // If the object exists but has no subscription fields at all, default to active v1.
  const effectiveStatus: SubscriptionStatus =
    !account.subscription_plan && !account.subscription_status
      ? "active"
      : status;

  const cancellationReason = account.subscription_cancellation_reason ?? null;

  return { status: effectiveStatus, plan, cancellationReason };
}

export function isSubscriptionActive(account: {
  subscription_plan?: string | null;
  subscription_status?: string | null;
} | null): boolean {
  return getSubscriptionInfo(account).status === "active";
}

export function getSubscriptionPlan(account: {
  subscription_plan?: string | null;
} | null): SubscriptionPlan {
  return getSubscriptionInfo(account).plan;
}

/* ═══════════════════════════════════════════════════════
   Firestore account interface
   ═══════════════════════════════════════════════════════ */

export interface FirestoreAccount {
  id: string;
  authUserId: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  subscriptionCancellationReason?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/* ═══════════════════════════════════════════════════════
   Platform account bootstrap via Firestore
   ═══════════════════════════════════════════════════════ */

export async function ensurePlatformAccount(authUserId: string) {
  try {
    // Use dynamic import to avoid server-only issues in test environments
    const adminMod = await import("@/lib/firebase/admin");
    const settingsMod = await import("@/lib/settings/service");
    const firestore = adminMod.getAdminFirestore();

    // Check if account doc already exists.
    const docRef = firestore.doc(`accounts/${authUserId}`);
    const docSnap = await docRef.get();

    const isNewAccount = !docSnap.exists;

    if (isNewAccount) {
      // Create new account doc with explicit defaults and server timestamps.
      await docRef.set({
        authUserId,
        subscriptionPlan: "free" as SubscriptionPlan,
        subscriptionStatus: "active" as SubscriptionStatus,
        subscriptionCancellationReason: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      await settingsMod.ensureSettingsDocument(authUserId);
    }

    // Read the doc to return account data (compatibility with existing callers).
    const updatedSnap = await docRef.get();
    const data = updatedSnap.data();

    if (!data) {
      return { account: null, booted: false };
    }

    // Normalize Firestore doc to legacy-style object for downstream compatibility.
    const account = {
      id: updatedSnap.id, // doc.id = authUserId, but kept for settings/deployments compatibility
      auth_user_id: data.authUserId,
      subscription_plan: data.subscriptionPlan,
      subscription_status: data.subscriptionStatus,
      subscription_cancellation_reason: data.subscriptionCancellationReason ?? null,
    };

    return { account, booted: isNewAccount };
  } catch {
    return { account: null, booted: false };
  }
}

export async function getPlatformAccount(authUserId: string): Promise<FirestoreAccount | null> {
  try {
    // Use dynamic import to avoid server-only issues in test environments
    const adminMod = await import("@/lib/firebase/admin");
    const firestore = adminMod.getAdminFirestore();

    const docSnap = await firestore.doc(`accounts/${authUserId}`).get();

    if (!docSnap.exists) {
      return null;
    }

    const data = docSnap.data();
    if (!data) {
      return null;
    }

    return {
      id: docSnap.id,
      authUserId: data.authUserId,
      subscriptionPlan: data.subscriptionPlan,
      subscriptionStatus: data.subscriptionStatus,
      subscriptionCancellationReason: data.subscriptionCancellationReason ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}

export function getUserDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  last_sign_in_at?: string;
}): string {
  const name = user.user_metadata?.name as string | undefined;
  if (name) return name;

  const email = user.email;
  if (email) {
    const local = email.split("@")[0];
    return local
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return "User";
}
