import { createSupabaseServerClient } from "@/lib/auth/supabase-client";

/* ═══════════════════════════════════════════════════════
   Subscription types — v1 stub, no billing logic
   ═══════════════════════════════════════════════════════ */

export type SubscriptionStatus = "active" | "inactive" | "missing";
export type SubscriptionPlan = "free" | "pro" | "enterprise" | "unknown";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  cancellationReason: string | null;
}

/**
 * Read subscription state from a platform_account row.
 * Returns "active" / "free" for every v1 user (no billing integration).
 * Falls back to inactive when the row lacks subscription_plan entirely.
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

  // If the row exists but has no subscription fields at all, default to active v1.
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
   Platform account bootstrap
   ═══════════════════════════════════════════════════════ */

export async function ensurePlatformAccount(authUserId: string) {
  try {
    const supabase = await createSupabaseServerClient();

    // Check if an account row already exists — this is the only reliable
    // first-sign-in signal (display_name is nullable on existing rows too).
    const { data: existing } = await supabase
      .schema("platform")
      .from("platform_account")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const isNewAccount = !existing;

    // Upsert: create on first sign-in, sync on returning visits.
    const { data, error } = await supabase
      .schema("platform")
      .from("platform_account")
      .upsert({ auth_user_id: authUserId }, { onConflict: "auth_user_id" })
      .select("*")
      .single();

    if (error) {
      console.warn("[platform-account] bootstrap failed:", error.message);
      return { account: null, booted: false };
    }

    return { account: data, booted: isNewAccount };
  } catch (err) {
    console.warn("[platform-account] bootstrap exception:", err);
    return { account: null, booted: false };
  }
}

export async function getPlatformAccount(authUserId: string) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .schema("platform")
      .from("platform_account")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data;
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
