import { describe, expect, test } from "vitest";

import {
  createLangfuseBillingMetadata,
  createProviderUsageEnvelope,
  decideAdmission,
  getFixedUtcWeekQuotaWindow,
  getQuotaExhaustedMessageForTier,
  getQuotaLimitForTier,
  isManagedBillingTier,
  NO_MANUAL_BLOCK,
  parseManagedBillingTier,
  parseManagedBillingTierReadState,
  projectStripeEntitlement,
  QUOTA_LEDGER_STATE_BY_OPERATION,
  QUOTA_LIMITS_V1,
  QUOTA_UNIT_V1,
  QUOTA_UNIT_V1_DESCRIPTION,
  QUOTA_WINDOW_KIND_V1,
} from "@/lib/billing";

describe("managed billing tier contracts", () => {
  test("accepts only free and growth as managed billing tiers", () => {
    expect(isManagedBillingTier("free")).toBe(true);
    expect(isManagedBillingTier("growth")).toBe(true);
    expect(parseManagedBillingTier("free")).toBe("free");
    expect(parseManagedBillingTier("growth")).toBe("growth");

    for (const rejected of ["pro", "paid", "team", "enterprise"]) {
      expect(isManagedBillingTier(rejected)).toBe(false);
      expect(parseManagedBillingTier(rejected)).toBeNull();
      expect(parseManagedBillingTierReadState(rejected)).toBe("unknown");
    }
  });

  test("keeps unknown as a defensive read state, not a managed tier", () => {
    expect(isManagedBillingTier("unknown")).toBe(false);
    expect(parseManagedBillingTier("unknown")).toBeNull();
    expect(parseManagedBillingTierReadState("unknown")).toBe("unknown");
    expect(parseManagedBillingTierReadState(null)).toBe("unknown");
  });
});

describe("Stripe entitlement projection", () => {
  test("maps active growth subscriptions to growth", () => {
    expect(projectStripeEntitlement({ status: "active", mappedTier: "growth" })).toEqual({
      tier: "growth",
      readState: "growth",
      hardBlocked: false,
      status: "active",
      reason: "active-growth",
    });
  });

  test("maps trialing growth only when trial entitlement is explicitly enabled", () => {
    expect(projectStripeEntitlement({ status: "trialing", mappedTier: "growth" })).toMatchObject({
      tier: "free",
      hardBlocked: false,
      reason: "subscription-not-entitled",
    });

    expect(projectStripeEntitlement({
      status: "trialing",
      mappedTier: "growth",
      trialingGrantsEntitlement: true,
    })).toMatchObject({
      tier: "growth",
      hardBlocked: false,
      reason: "trialing-growth-enabled",
    });
  });

  test("demotes non-entitled, missing, and paused subscriptions to free without hard block", () => {
    for (const status of ["past_due", "unpaid", "canceled", "incomplete", "incomplete_expired"] as const) {
      expect(projectStripeEntitlement({ status, mappedTier: "growth" })).toMatchObject({
        tier: "free",
        hardBlocked: false,
        status,
        reason: "subscription-not-entitled",
      });
    }

    expect(projectStripeEntitlement({ mappedTier: "growth" })).toMatchObject({
      tier: "free",
      hardBlocked: false,
      status: null,
      reason: "subscription-missing",
    });

    expect(projectStripeEntitlement({ status: "active", mappedTier: "growth", subscriptionPaused: true })).toMatchObject({
      tier: "free",
      hardBlocked: false,
      status: "active",
      reason: "subscription-paused",
    });

    expect(projectStripeEntitlement({ status: "paused", mappedTier: "growth" })).toMatchObject({
      tier: "free",
      hardBlocked: false,
      status: "paused",
      reason: "subscription-paused",
    });
  });
});

describe("quota units, windows, admission, and ledger contracts", () => {
  test("defines the v1 quota unit as one admitted managed inbound request", () => {
    expect(QUOTA_UNIT_V1).toBe("managed_inbound_message");
    expect(QUOTA_UNIT_V1_DESCRIPTION).toBe("One successfully admitted managed inbound message/request.");
    expect(QUOTA_WINDOW_KIND_V1).toBe("fixed_utc_week");
  });

  test("looks up distinct free and growth quota limits for the v1 unit and window", () => {
    const freeLimit = getQuotaLimitForTier("free");
    const growthLimit = getQuotaLimitForTier("growth");

    expect(QUOTA_LIMITS_V1).toHaveLength(2);
    expect(freeLimit).toEqual({
      tier: "free",
      unit: QUOTA_UNIT_V1,
      windowKind: QUOTA_WINDOW_KIND_V1,
      limit: 25,
    });
    expect(growthLimit).toEqual({
      tier: "growth",
      unit: QUOTA_UNIT_V1,
      windowKind: QUOTA_WINDOW_KIND_V1,
      limit: 100,
    });
    expect(growthLimit.limit).toBeGreaterThan(freeLimit.limit);
  });

  test("returns tier-specific quota exhausted messages", () => {
    expect(getQuotaExhaustedMessageForTier("free")).toBe(
      "You've reached your Free message limit. Upgrade to Growth to keep processing managed messages.",
    );
    expect(getQuotaExhaustedMessageForTier("growth")).toBe(
      "You've reached your Growth message limit. I will reach out within 24 hours with an offer.",
    );
  });

  test("maps ledger operations to reserve, commit, release, and deny lifecycle states", () => {
    expect(QUOTA_LEDGER_STATE_BY_OPERATION).toEqual({
      reserve: "reserved",
      commit: "committed",
      release: "released",
      deny: "denied",
    });
  });

  test("creates fixed UTC week window IDs across a year boundary", () => {
    expect(getFixedUtcWeekQuotaWindow("2020-12-31T23:59:59.999Z")).toEqual({
      kind: "fixed_utc_week",
      id: "2020-W53",
      startsAt: "2020-12-28T00:00:00.000Z",
      endsAt: "2021-01-04T00:00:00.000Z",
    });

    expect(getFixedUtcWeekQuotaWindow("2021-01-01T00:00:00.000Z").id).toBe("2020-W53");
    expect(getFixedUtcWeekQuotaWindow("2021-01-04T00:00:00.000Z").id).toBe("2021-W01");
  });

  test("admits only unblocked requests with remaining quota", () => {
    const window = getFixedUtcWeekQuotaWindow("2026-06-25T12:00:00.000Z");
    const baseInput = {
      accountId: "acct_123",
      abraInstanceId: "abra_123",
      requestId: "req_123",
      tier: "growth" as const,
      manualBlock: NO_MANUAL_BLOCK,
      usage: {
        unit: QUOTA_UNIT_V1,
        window,
        used: 9,
        limit: 10,
      },
      now: "2026-06-25T12:00:00.000Z",
    };

    expect(decideAdmission(baseInput)).toMatchObject({
      decision: "admit",
      admitted: true,
      rejectReason: null,
      ledgerState: "reserved",
      unit: QUOTA_UNIT_V1,
      window,
    });

    expect(decideAdmission({
      ...baseInput,
      usage: { ...baseInput.usage, used: 10 },
    })).toMatchObject({
      decision: "reject",
      admitted: false,
      rejectReason: "quota_exhausted",
      ledgerState: "denied",
    });

    expect(decideAdmission({
      ...baseInput,
      manualBlock: {
        blocked: true,
        reason: "operator_hold",
        message: "Manual review",
        updatedAt: "2026-06-25T12:00:00.000Z",
        updatedBy: "operator@example.com",
      },
    })).toMatchObject({
      decision: "reject",
      admitted: false,
      rejectReason: "manual_block",
      ledgerState: "denied",
    });
  });
});

describe("telemetry contracts", () => {
  test("keeps provider usage explicitly non-authoritative for quota", () => {
    expect(createProviderUsageEnvelope({
      provider: "openai",
      model: "gpt-example",
      source: "provider_reported",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      costUsd: 0.01,
      capturedAt: "2026-06-25T12:00:00.000Z",
    })).toMatchObject({
      source: "provider_reported",
      authoritativeForQuota: false,
    });
  });

  test("keeps Langfuse metadata observability-only for quota and cost authority", () => {
    expect(createLangfuseBillingMetadata({
      billingAccountId: "acct_123",
      abraInstanceId: "abra_123",
      deploymentId: "dep_123",
      runId: "run_123",
      usageEventId: "usage_123",
      tier: "growth",
      environment: "test",
    })).toEqual({
      billing_account_id: "acct_123",
      abra_instance_id: "abra_123",
      deployment_id: "dep_123",
      run_id: "run_123",
      usage_event_id: "usage_123",
      tier: "growth",
      environment: "test",
      quota_unit: QUOTA_UNIT_V1,
      quota_window_kind: QUOTA_WINDOW_KIND_V1,
      quota_authority: "abra_admission_ledger",
      provider_usage_authoritative_for_quota: false,
      langfuse_cost_authoritative_for_quota: false,
    });
  });
});
