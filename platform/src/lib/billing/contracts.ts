export const MANAGED_BILLING_TIERS = ["free", "growth"] as const;

export type ManagedBillingTier = (typeof MANAGED_BILLING_TIERS)[number];
export type ManagedBillingTierReadState = ManagedBillingTier | "unknown";

export const MANAGED_BILLING_TIER_LABELS: Record<ManagedBillingTier, string> = {
  free: "Free",
  growth: "Growth",
};

const MANAGED_BILLING_TIER_SET = new Set<string>(MANAGED_BILLING_TIERS);

export function isManagedBillingTier(value: unknown): value is ManagedBillingTier {
  return typeof value === "string" && MANAGED_BILLING_TIER_SET.has(value);
}

export function parseManagedBillingTier(value: unknown): ManagedBillingTier | null {
  return isManagedBillingTier(value) ? value : null;
}

/**
 * Defensive read-state parser for persisted or provider-derived values. The
 * product tier itself is still only free | growth; unknown is never a managed
 * user-facing tier.
 */
export function parseManagedBillingTierReadState(value: unknown): ManagedBillingTierReadState {
  return parseManagedBillingTier(value) ?? "unknown";
}

export const STRIPE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;

export type StripeSubscriptionStatus = (typeof STRIPE_SUBSCRIPTION_STATUSES)[number];

const STRIPE_SUBSCRIPTION_STATUS_SET = new Set<string>(STRIPE_SUBSCRIPTION_STATUSES);

export interface StripeEntitlementProjectionInput {
  /** Stripe subscription status. Null/missing means no subscription was found. */
  status?: StripeSubscriptionStatus | string | null;
  /** Managed tier encoded by the server-side Stripe price/product mapping. */
  mappedTier?: unknown;
  /** Treat trialing growth as entitled only when a product decision enables it. */
  trialingGrantsEntitlement?: boolean;
  /** Stripe pause_collection or equivalent paused-subscription state. */
  subscriptionPaused?: boolean;
}

export type StripeEntitlementReason =
  | "active-growth"
  | "trialing-growth-enabled"
  | "free-or-unmapped-plan"
  | "subscription-missing"
  | "subscription-paused"
  | "subscription-not-entitled"
  | "subscription-status-unknown";

export interface StripeEntitlementProjection {
  tier: ManagedBillingTier;
  readState: ManagedBillingTierReadState;
  hardBlocked: false;
  status: StripeSubscriptionStatus | null;
  reason: StripeEntitlementReason;
}

function parseStripeSubscriptionStatus(status: StripeEntitlementProjectionInput["status"]): StripeSubscriptionStatus | null {
  if (typeof status !== "string") {
    return null;
  }

  if (!STRIPE_SUBSCRIPTION_STATUS_SET.has(status)) {
    return null;
  }

  return status as StripeSubscriptionStatus;
}

/**
 * Projects Stripe state into Abra's managed entitlement. Non-entitled Stripe
 * states demote to free without creating a hard block; manual blocks are a
 * separate server-owned contract.
 */
export function projectStripeEntitlement(input: StripeEntitlementProjectionInput): StripeEntitlementProjection {
  const status = parseStripeSubscriptionStatus(input.status);
  const readState = parseManagedBillingTierReadState(input.mappedTier);
  const mappedTier = parseManagedBillingTier(input.mappedTier);

  if (input.subscriptionPaused) {
    return {
      tier: "free",
      readState,
      hardBlocked: false,
      status,
      reason: "subscription-paused",
    };
  }

  if (status === null) {
    return {
      tier: "free",
      readState,
      hardBlocked: false,
      status: null,
      reason: typeof input.status === "string" ? "subscription-status-unknown" : "subscription-missing",
    };
  }

  if (status === "paused") {
    return {
      tier: "free",
      readState,
      hardBlocked: false,
      status,
      reason: "subscription-paused",
    };
  }

  if (mappedTier !== "growth") {
    return {
      tier: "free",
      readState,
      hardBlocked: false,
      status,
      reason: "free-or-unmapped-plan",
    };
  }

  if (status === "active") {
    return {
      tier: "growth",
      readState,
      hardBlocked: false,
      status,
      reason: "active-growth",
    };
  }

  if (status === "trialing" && input.trialingGrantsEntitlement === true) {
    return {
      tier: "growth",
      readState,
      hardBlocked: false,
      status,
      reason: "trialing-growth-enabled",
    };
  }

  return {
    tier: "free",
    readState,
    hardBlocked: false,
    status,
    reason: "subscription-not-entitled",
  };
}

export type ManualBlockReason =
  | "terms_violation"
  | "abuse"
  | "chargeback_review"
  | "operator_hold";

export interface ManualBlockState {
  blocked: boolean;
  reason: ManualBlockReason | null;
  message: string | null;
  updatedAt: unknown;
  updatedBy: string | null;
}

export const NO_MANUAL_BLOCK: ManualBlockState = {
  blocked: false,
  reason: null,
  message: null,
  updatedAt: null,
  updatedBy: null,
};

export const QUOTA_UNIT_V1 = "managed_inbound_message" as const;
export type QuotaUnitV1 = typeof QUOTA_UNIT_V1;

export const QUOTA_UNIT_V1_DESCRIPTION = "One successfully admitted managed inbound message/request.";
export const QUOTA_WINDOW_KIND_V1 = "fixed_utc_week" as const;

export type QuotaWindowKindV1 = typeof QUOTA_WINDOW_KIND_V1;
export type QuotaWindowId = `${number}-W${string}`;

export interface QuotaWindowRef {
  kind: QuotaWindowKindV1;
  id: QuotaWindowId;
  startsAt: string;
  endsAt: string;
}

export interface QuotaLimit {
  tier: ManagedBillingTier;
  unit: QuotaUnitV1;
  windowKind: QuotaWindowKindV1;
  limit: number;
}

export const QUOTA_LIMITS_V1 = [
  {
    tier: "free",
    unit: QUOTA_UNIT_V1,
    windowKind: QUOTA_WINDOW_KIND_V1,
    limit: 25,
  },
  {
    tier: "growth",
    unit: QUOTA_UNIT_V1,
    windowKind: QUOTA_WINDOW_KIND_V1,
    limit: 500,
  },
] as const satisfies readonly QuotaLimit[];

export function getQuotaLimitForTier(tier: ManagedBillingTier): QuotaLimit {
  const quotaLimit = QUOTA_LIMITS_V1.find((entry) => entry.tier === tier);

  if (quotaLimit === undefined) {
    throw new Error(`Missing quota limit for managed billing tier: ${tier}`);
  }

  return quotaLimit;
}

export interface QuotaUsageSnapshot {
  unit: QuotaUnitV1;
  window: QuotaWindowRef;
  used: number;
  limit: number;
}

export function getFixedUtcWeekQuotaWindow(dateInput: Date | string | number): QuotaWindowRef {
  const date = new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date for quota window.");
  }

  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = new Date(utcMidnight).getUTCDay() || 7;
  const monday = new Date(utcMidnight);
  monday.setUTCDate(monday.getUTCDate() - day + 1);

  const thursday = new Date(monday);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const weekYear = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstThursdayDay = firstThursday.getUTCDay() || 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 4);

  const weekNumber = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604_800_000);
  const startsAt = monday.toISOString();
  const endsAtDate = new Date(monday);
  endsAtDate.setUTCDate(endsAtDate.getUTCDate() + 7);

  return {
    kind: QUOTA_WINDOW_KIND_V1,
    id: `${weekYear}-W${String(weekNumber).padStart(2, "0")}`,
    startsAt,
    endsAt: endsAtDate.toISOString(),
  };
}

export type AdmissionDecision = "admit" | "reject";
export type AdmissionRejectReason = "manual_block" | "quota_exhausted" | "invalid_request";

export type QuotaLedgerOperation = "reserve" | "commit" | "release" | "deny";

export type QuotaLedgerState =
  | "reserved"
  | "committed"
  | "released"
  | "denied";

export const QUOTA_LEDGER_STATE_BY_OPERATION: Record<QuotaLedgerOperation, QuotaLedgerState> = {
  reserve: "reserved",
  commit: "committed",
  release: "released",
  deny: "denied",
};

export interface AdmissionInput {
  accountId: string;
  abraInstanceId: string;
  requestId: string;
  tier: ManagedBillingTier;
  manualBlock: ManualBlockState;
  usage: QuotaUsageSnapshot;
  now: string;
}

export interface AdmissionOutput {
  decision: AdmissionDecision;
  admitted: boolean;
  rejectReason: AdmissionRejectReason | null;
  ledgerState: QuotaLedgerState;
  unit: QuotaUnitV1;
  window: QuotaWindowRef;
}

export function decideAdmission(input: AdmissionInput): AdmissionOutput {
  if (input.manualBlock.blocked) {
    return {
      decision: "reject",
      admitted: false,
      rejectReason: "manual_block",
      ledgerState: QUOTA_LEDGER_STATE_BY_OPERATION.deny,
      unit: QUOTA_UNIT_V1,
      window: input.usage.window,
    };
  }

  if (input.usage.used >= input.usage.limit) {
    return {
      decision: "reject",
      admitted: false,
      rejectReason: "quota_exhausted",
      ledgerState: QUOTA_LEDGER_STATE_BY_OPERATION.deny,
      unit: QUOTA_UNIT_V1,
      window: input.usage.window,
    };
  }

  return {
    decision: "admit",
    admitted: true,
    rejectReason: null,
    ledgerState: QUOTA_LEDGER_STATE_BY_OPERATION.reserve,
    unit: QUOTA_UNIT_V1,
    window: input.usage.window,
  };
}

export type ProviderUsageSource = "provider_reported" | "estimated" | "langfuse_inferred";

export interface ProviderUsageEnvelope {
  provider: string;
  model: string | null;
  source: ProviderUsageSource;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  capturedAt: string;
  /** Informational only. Quota/admission authority lives in Abra's ledger. */
  authoritativeForQuota: false;
}

export function createProviderUsageEnvelope(
  input: Omit<ProviderUsageEnvelope, "authoritativeForQuota">,
): ProviderUsageEnvelope {
  return {
    ...input,
    authoritativeForQuota: false,
  };
}

export interface LangfuseBillingMetadataInput {
  billingAccountId: string;
  abraInstanceId: string;
  deploymentId?: string | null;
  runId?: string | null;
  usageEventId?: string | null;
  tier: ManagedBillingTierReadState;
  environment: string;
}

export interface LangfuseBillingMetadata {
  billing_account_id: string;
  abra_instance_id: string;
  deployment_id?: string;
  run_id?: string;
  usage_event_id?: string;
  tier: ManagedBillingTierReadState;
  environment: string;
  quota_unit: QuotaUnitV1;
  quota_window_kind: QuotaWindowKindV1;
  quota_authority: "abra_admission_ledger";
  provider_usage_authoritative_for_quota: false;
  langfuse_cost_authoritative_for_quota: false;
}

export function createLangfuseBillingMetadata(input: LangfuseBillingMetadataInput): LangfuseBillingMetadata {
  const metadata: LangfuseBillingMetadata = {
    billing_account_id: input.billingAccountId,
    abra_instance_id: input.abraInstanceId,
    tier: input.tier,
    environment: input.environment,
    quota_unit: QUOTA_UNIT_V1,
    quota_window_kind: QUOTA_WINDOW_KIND_V1,
    quota_authority: "abra_admission_ledger",
    provider_usage_authoritative_for_quota: false,
    langfuse_cost_authoritative_for_quota: false,
  };

  if (input.deploymentId) {
    metadata.deployment_id = input.deploymentId;
  }

  if (input.runId) {
    metadata.run_id = input.runId;
  }

  if (input.usageEventId) {
    metadata.usage_event_id = input.usageEventId;
  }

  return metadata;
}
