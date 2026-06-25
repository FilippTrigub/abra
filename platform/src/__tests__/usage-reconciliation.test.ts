import { describe, expect, it } from "vitest";

import type { AdmissionLedgerEventDocument } from "@/lib/billing/admission-ledger";
import { createInternalUsageReconciliationReport } from "@/lib/billing/langfuse-reconciliation";
import { buildEstimatedUsageEnvelope, buildProviderReportedUsageEnvelope } from "@/lib/billing/provider-usage-envelope";

const NOW = "2026-06-25T12:00:00.000Z";

function ledgerEvent(input: Partial<AdmissionLedgerEventDocument> & Pick<AdmissionLedgerEventDocument, "eventId">): AdmissionLedgerEventDocument {
  return {
    eventId: input.eventId,
    accountId: input.accountId ?? "acct-reconcile",
    idempotencyKey: input.idempotencyKey ?? input.eventId,
    state: input.state ?? "committed",
    status: input.status ?? "admitted",
    unit: "managed_inbound_message",
    window: input.window ?? {
      kind: "fixed_utc_week",
      id: "2026-W26",
      startsAt: "2026-06-22T00:00:00.000Z",
      endsAt: "2026-06-29T00:00:00.000Z",
    },
    tier: input.tier ?? "free",
    limit: input.limit ?? 25,
    usedAfter: input.usedAfter ?? 1,
    billable: input.billable ?? true,
    denyReason: input.denyReason ?? null,
    createdAt: input.createdAt ?? NOW,
    updatedAt: input.updatedAt ?? NOW,
    reservedAt: input.reservedAt ?? NOW,
    committedAt: input.committedAt ?? NOW,
    releasedAt: input.releasedAt ?? null,
    deniedAt: input.deniedAt ?? null,
    providerUsageEnvelopes: input.providerUsageEnvelopes ?? [],
    providerUsageUpdatedAt: input.providerUsageUpdatedAt ?? null,
  };
}

function findingReasons(report: ReturnType<typeof createInternalUsageReconciliationReport>) {
  return report.findings.map((finding) => finding.reason);
}

describe("internal usage reconciliation hardening report", () => {
  it("flags admitted messages without completion and without usage", () => {
    const reservedWithoutUsage = ledgerEvent({
      eventId: "adm_reserved_without_usage",
      state: "reserved",
      committedAt: null,
    });

    const report = createInternalUsageReconciliationReport({
      ledgerEvents: [reservedWithoutUsage],
      providerUsage: [],
    });

    expect(report.visibility).toBe("internal_admin_only");
    expect(report.readonly).toBe(true);
    expect(findingReasons(report)).toEqual(["missing_completion", "missing_usage"]);
    expect(report.findings).toContainEqual(expect.objectContaining({
      reason: "missing_completion",
      accountId: reservedWithoutUsage.accountId,
      usageEventId: reservedWithoutUsage.eventId,
      ledgerState: "reserved",
    }));
    expect(report.summary).toMatchObject({ findings: 2, warningFindings: 2, criticalFindings: 0 });
  });

  it("flags provider and Langfuse usage observations without an admitted ledger event", () => {
    const admitted = ledgerEvent({ eventId: "adm_matched" });
    const matchedUsage = buildProviderReportedUsageEnvelope({
      usageEventId: admitted.eventId,
      provider: "huggingface",
      model: "Qwen/Qwen2.5-VL-7B-Instruct",
      totalTokens: 100,
      costUsd: 0.02,
      capturedAt: NOW,
    });
    const orphanProviderUsage = buildProviderReportedUsageEnvelope({
      usageEventId: "adm_orphan_provider",
      provider: "huggingface",
      model: "Qwen/Qwen2.5-VL-7B-Instruct",
      totalTokens: 50,
      costUsd: 0.01,
      capturedAt: NOW,
    });

    const report = createInternalUsageReconciliationReport({
      ledgerEvents: [admitted],
      providerUsage: [matchedUsage, orphanProviderUsage],
      langfuseObservations: [
        {
          id: "obs-matched",
          usageEventId: admitted.eventId,
          traceId: "trace-matched",
        },
        {
          id: "obs-orphan",
          observationId: "langfuse-observation-orphan",
          usageEventId: "adm_orphan_langfuse",
          traceId: "trace-orphan",
          costUsd: 0.04,
        },
      ],
    });

    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: "unmatched_external_usage",
        severity: "critical",
        source: "provider",
        usageEventId: "adm_orphan_provider",
      }),
      expect.objectContaining({
        reason: "unmatched_external_usage",
        severity: "critical",
        source: "langfuse",
        usageEventId: "adm_orphan_langfuse",
        observationId: "langfuse-observation-orphan",
      }),
    ]));
    expect(report.summary).toMatchObject({ findings: 2, criticalFindings: 2 });
  });

  it("flags duplicate provider settlement attempts for the same admission event", () => {
    const event = ledgerEvent({
      eventId: "adm_duplicate_settlement",
      providerUsageEnvelopes: [
        buildProviderReportedUsageEnvelope({
          usageEventId: "adm_duplicate_settlement",
          provider: "huggingface",
          totalTokens: 80,
          capturedAt: NOW,
        }),
        buildProviderReportedUsageEnvelope({
          usageEventId: "adm_duplicate_settlement",
          provider: "huggingface",
          totalTokens: 81,
          capturedAt: NOW,
        }),
      ],
    });

    const report = createInternalUsageReconciliationReport({ ledgerEvents: [event], providerUsage: [] });

    expect(report.findings).toContainEqual(expect.objectContaining({
      reason: "duplicate_settlement",
      severity: "critical",
      usageEventId: event.eventId,
      attempts: 2,
    }));
    expect(report.summary.duplicateSettlementGroups).toBe(1);
  });

  it("flags high estimated-vs-provider-reported usage drift without affecting quota authority", () => {
    const event = ledgerEvent({
      eventId: "adm_usage_drift",
      providerUsageEnvelopes: [
        buildEstimatedUsageEnvelope({
          usageEventId: "adm_usage_drift",
          provider: "local-runtime",
          totalTokens: 200,
          costUsd: 0.08,
          capturedAt: NOW,
        }),
        buildProviderReportedUsageEnvelope({
          usageEventId: "adm_usage_drift",
          provider: "huggingface",
          totalTokens: 100,
          costUsd: 0.04,
          capturedAt: NOW,
        }),
      ],
    });

    const report = createInternalUsageReconciliationReport({
      ledgerEvents: [event],
      providerUsage: [],
      driftThresholdRatio: 0.25,
    });

    expect(event.providerUsageEnvelopes.map((usage) => usage.costUsd)).toEqual([0.08, 0.04]);
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reason: "usage_drift",
        metric: "total_tokens",
        driftRatio: 1,
        thresholdRatio: 0.25,
      }),
      expect.objectContaining({
        reason: "usage_drift",
        metric: "cost_usd",
        driftRatio: 1,
        thresholdRatio: 0.25,
      }),
    ]));
    expect(event.providerUsageEnvelopes.every((usage) => usage.authoritativeForQuota === false)).toBe(true);
    expect(report.summary.usageDriftFindings).toBe(2);
  });

  it("flags unknown tier and manual block states from internal state snapshots", () => {
    const eventWithUnknownTier = ledgerEvent({
      eventId: "adm_unknown_tier",
      tier: "enterprise" as never,
    });

    const report = createInternalUsageReconciliationReport({
      ledgerEvents: [eventWithUnknownTier],
      providerUsage: [buildProviderReportedUsageEnvelope({
        usageEventId: eventWithUnknownTier.eventId,
        provider: "huggingface",
        totalTokens: 5,
        capturedAt: NOW,
      })],
      billingTierStates: [
        { accountId: "acct-summary", tier: "legacy_paid", source: "billing_summary" },
      ],
      manualBlockStates: [
        { accountId: "acct-block", blocked: true, reason: "fraud_hold", source: "manual_block" },
        { accountId: "acct-block-shape", blocked: "yes", source: "moderation" },
      ],
    });

    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "unknown_tier_state", accountId: eventWithUnknownTier.accountId, source: "ledger" }),
      expect.objectContaining({ reason: "unknown_tier_state", accountId: "acct-summary", source: "billing_summary" }),
      expect.objectContaining({ reason: "unknown_block_state", accountId: "acct-block", source: "manual_block" }),
      expect.objectContaining({ reason: "unknown_block_state", accountId: "acct-block-shape", source: "moderation" }),
    ]));
    expect(report.summary.criticalFindings).toBe(4);
  });

  it("keeps reconciliation reporting isolated from admission correctness", () => {
    const admitted = ledgerEvent({
      eventId: "adm_admission_remains_admitted",
      state: "committed",
      status: "admitted",
      providerUsageEnvelopes: [
        buildProviderReportedUsageEnvelope({
          usageEventId: "adm_admission_remains_admitted",
          provider: "huggingface",
          totalTokens: 10,
          capturedAt: NOW,
        }),
        buildProviderReportedUsageEnvelope({
          usageEventId: "adm_admission_remains_admitted",
          provider: "huggingface",
          totalTokens: 10,
          capturedAt: NOW,
        }),
      ],
    });

    const report = createInternalUsageReconciliationReport({
      ledgerEvents: [admitted],
      providerUsage: [],
      billingTierStates: [{ accountId: admitted.accountId, tier: "unknown_legacy", source: "stripe_projection" }],
    });

    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.readonly).toBe(true);
    expect(admitted.status).toBe("admitted");
    expect(admitted.state).toBe("committed");
    expect(admitted.billable).toBe(true);
  });
});
