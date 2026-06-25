import { describe, expect, it } from "vitest";

import type { AdmissionLedgerEventDocument } from "@/lib/billing/admission-ledger";
import { buildEstimatedUsageEnvelope, buildProviderReportedUsageEnvelope } from "@/lib/billing/provider-usage-envelope";
import { reconcileBillingUsage } from "@/lib/billing/langfuse-reconciliation";

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

describe("Langfuse/provider usage reconciliation", () => {
  it("flags admitted ledger events without completion or usage", () => {
    const reservedWithoutUsage = ledgerEvent({
      eventId: "adm_reserved_without_usage",
      state: "reserved",
      committedAt: null,
    });
    const committedWithUsage = ledgerEvent({ eventId: "adm_committed_with_usage" });
    const providerUsage = [buildProviderReportedUsageEnvelope({
      usageEventId: committedWithUsage.eventId,
      provider: "huggingface",
      model: "Qwen/Qwen2.5-VL-7B-Instruct",
      inputTokens: 10,
      outputTokens: 5,
      capturedAt: NOW,
    })];

    const report = reconcileBillingUsage({
      ledgerEvents: [reservedWithoutUsage, committedWithUsage],
      providerUsage,
    });

    expect(report.admittedLedgerEventsWithoutCompletion).toHaveLength(1);
    expect(report.admittedLedgerEventsWithoutCompletion[0]?.eventId).toBe(reservedWithoutUsage.eventId);
    expect(report.admittedLedgerEventsWithoutUsage.map((event) => event.eventId)).toEqual([reservedWithoutUsage.eventId]);
    expect(report.summary.issues).toBe(2);
  });

  it("flags provider and Langfuse observations with no matching admission event", () => {
    const matchedLedgerEvent = ledgerEvent({ eventId: "adm_matched" });
    const matchedProviderUsage = buildEstimatedUsageEnvelope({
      usageEventId: matchedLedgerEvent.eventId,
      provider: "local-runtime",
      model: "smolvlm",
      totalTokens: 50,
      capturedAt: NOW,
    });
    const orphanProviderUsage = buildProviderReportedUsageEnvelope({
      usageEventId: "adm_missing_provider",
      provider: "huggingface",
      model: "Qwen/Qwen2.5-VL-7B-Instruct",
      totalTokens: 100,
      capturedAt: NOW,
    });

    const report = reconcileBillingUsage({
      ledgerEvents: [matchedLedgerEvent],
      providerUsage: [matchedProviderUsage, orphanProviderUsage],
      langfuseObservations: [
        {
          id: "obs-matched",
          usageEventId: matchedLedgerEvent.eventId,
          traceId: "trace-matched",
        },
        {
          id: "obs-orphan",
          usageEventId: "adm_missing_langfuse",
          traceId: "trace-orphan",
          costUsd: 0.04,
        },
      ],
    });

    expect(report.providerUsageWithoutAdmission.map((usage) => usage.usageEventId)).toEqual(["adm_missing_provider"]);
    expect(report.langfuseObservationsWithoutAdmission.map((observation) => observation.id)).toEqual(["obs-orphan"]);
    expect(report.admittedLedgerEventsWithoutCompletion).toEqual([]);
    expect(report.admittedLedgerEventsWithoutUsage).toEqual([]);
    expect(report.summary).toMatchObject({
      ledgerEvents: 1,
      providerUsage: 2,
      langfuseObservations: 2,
      issues: 2,
    });
  });
});
