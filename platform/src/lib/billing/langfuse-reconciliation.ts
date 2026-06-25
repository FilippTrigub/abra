import type { AdmissionLedgerEventDocument } from "./admission-ledger";
import {
  isManualBlockReason,
  isManagedBillingTier,
  type ProviderUsageEnvelope,
} from "./contracts";

export interface LangfuseUsageObservation {
  id: string;
  usageEventId?: string | null;
  reservationId?: string | null;
  traceId?: string | null;
  observationId?: string | null;
  costUsd?: number | null;
}

export interface BillingReconciliationReportInput {
  ledgerEvents: AdmissionLedgerEventDocument[];
  providerUsage: ProviderUsageEnvelope[];
  langfuseObservations?: LangfuseUsageObservation[];
}

export interface BillingReconciliationReport {
  admittedLedgerEventsWithoutCompletion: AdmissionLedgerEventDocument[];
  admittedLedgerEventsWithoutUsage: AdmissionLedgerEventDocument[];
  providerUsageWithoutAdmission: ProviderUsageEnvelope[];
  langfuseObservationsWithoutAdmission: LangfuseUsageObservation[];
  summary: {
    ledgerEvents: number;
    providerUsage: number;
    langfuseObservations: number;
    issues: number;
  };
}

export type UsageReconciliationFindingReason =
  | "missing_completion"
  | "missing_usage"
  | "unmatched_external_usage"
  | "duplicate_settlement"
  | "usage_drift"
  | "unknown_tier_state"
  | "unknown_block_state";

export type UsageReconciliationFindingSeverity = "warning" | "critical";

export interface BillingTierStateObservation {
  accountId: string;
  tier: unknown;
  source: "billing_summary" | "stripe_projection" | "ledger";
}

export interface ManualBlockStateObservation {
  accountId: string;
  blocked: unknown;
  reason?: unknown;
  source: "manual_block" | "moderation";
}

export interface UsageReconciliationReportInput extends BillingReconciliationReportInput {
  billingTierStates?: BillingTierStateObservation[];
  manualBlockStates?: ManualBlockStateObservation[];
  driftThresholdRatio?: number;
}

export type UsageReconciliationFinding =
  | {
    reason: "missing_completion";
    severity: "warning";
    accountId: string;
    usageEventId: string;
    ledgerState: string;
  }
  | {
    reason: "missing_usage";
    severity: "warning";
    accountId: string;
    usageEventId: string;
  }
  | {
    reason: "unmatched_external_usage";
    severity: "critical";
    source: "provider" | "langfuse";
    usageEventId: string | null;
    reservationId: string | null;
    observationId: string;
  }
  | {
    reason: "duplicate_settlement";
    severity: "critical";
    usageEventId: string;
    attempts: number;
  }
  | {
    reason: "usage_drift";
    severity: "warning";
    usageEventId: string;
    metric: "total_tokens" | "cost_usd";
    driftRatio: number;
    thresholdRatio: number;
  }
  | {
    reason: "unknown_tier_state";
    severity: "critical";
    accountId: string;
    source: BillingTierStateObservation["source"];
  }
  | {
    reason: "unknown_block_state";
    severity: "critical";
    accountId: string;
    source: ManualBlockStateObservation["source"];
  };

export interface UsageReconciliationReport {
  visibility: "internal_admin_only";
  readonly: true;
  findings: UsageReconciliationFinding[];
  baseReport: BillingReconciliationReport;
  summary: BillingReconciliationReport["summary"] & {
    findings: number;
    criticalFindings: number;
    warningFindings: number;
    duplicateSettlementGroups: number;
    usageDriftFindings: number;
  };
}

function usageKeys(input: { usageEventId?: string | null; reservationId?: string | null }) {
  return [input.usageEventId, input.reservationId]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
}

function eventHasUsage(event: AdmissionLedgerEventDocument, providerUsageByKey: Map<string, ProviderUsageEnvelope>) {
  if (event.providerUsageEnvelopes.length > 0) {
    return true;
  }

  return providerUsageByKey.has(event.eventId);
}

function firstUsageKey(input: { usageEventId?: string | null; reservationId?: string | null }) {
  return usageKeys(input)[0] ?? null;
}

function finiteNonNegativeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function relativeDrift(estimated: number | null, reported: number | null) {
  if (estimated === null || reported === null) {
    return null;
  }

  const denominator = Math.abs(reported) > 0 ? Math.abs(reported) : Math.max(Math.abs(estimated), 1);
  return Math.abs(estimated - reported) / denominator;
}

function allUsageEnvelopes(input: BillingReconciliationReportInput) {
  return [
    ...input.providerUsage,
    ...input.ledgerEvents.flatMap((event) => event.providerUsageEnvelopes),
  ];
}

function groupUsageByAdmissionKey(usageEnvelopes: ProviderUsageEnvelope[]) {
  const groups = new Map<string, ProviderUsageEnvelope[]>();

  for (const usage of usageEnvelopes) {
    const key = firstUsageKey(usage);
    if (!key) {
      continue;
    }

    const current = groups.get(key) ?? [];
    current.push(usage);
    groups.set(key, current);
  }

  return groups;
}

function hasMissingCompletion(event: AdmissionLedgerEventDocument) {
  return event.status === "admitted" && (event.state === "reserved" || event.committedAt === null);
}

function hasUnknownBlockState(state: ManualBlockStateObservation) {
  if (typeof state.blocked !== "boolean") {
    return true;
  }

  if (state.blocked === false) {
    return false;
  }

  return state.reason !== null && state.reason !== undefined && !isManualBlockReason(state.reason);
}

function normalizedDriftThreshold(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0.25;
}

export function reconcileBillingUsage(input: BillingReconciliationReportInput): BillingReconciliationReport {
  const ledgerByEventId = new Map(input.ledgerEvents.map((event) => [event.eventId, event]));
  const providerUsageByKey = new Map<string, ProviderUsageEnvelope>();

  for (const usage of input.providerUsage) {
    for (const key of usageKeys(usage)) {
      providerUsageByKey.set(key, usage);
    }
  }

  const admittedLedgerEvents = input.ledgerEvents.filter((event) => event.status === "admitted");
  const admittedLedgerEventsWithoutCompletion = admittedLedgerEvents.filter(hasMissingCompletion);
  const admittedLedgerEventsWithoutUsage = admittedLedgerEvents.filter((event) => !eventHasUsage(event, providerUsageByKey));
  const providerUsageWithoutAdmission = input.providerUsage.filter((usage) => {
    const keys = usageKeys(usage);
    return keys.length === 0 || keys.every((key) => !ledgerByEventId.has(key));
  });
  const langfuseObservations = input.langfuseObservations ?? [];
  const langfuseObservationsWithoutAdmission = langfuseObservations.filter((observation) => {
    const keys = usageKeys(observation);
    return keys.length === 0 || keys.every((key) => !ledgerByEventId.has(key));
  });
  const issues = admittedLedgerEventsWithoutCompletion.length
    + admittedLedgerEventsWithoutUsage.length
    + providerUsageWithoutAdmission.length
    + langfuseObservationsWithoutAdmission.length;

  return {
    admittedLedgerEventsWithoutCompletion,
    admittedLedgerEventsWithoutUsage,
    providerUsageWithoutAdmission,
    langfuseObservationsWithoutAdmission,
    summary: {
      ledgerEvents: input.ledgerEvents.length,
      providerUsage: input.providerUsage.length,
      langfuseObservations: langfuseObservations.length,
      issues,
    },
  };
}

export function createInternalUsageReconciliationReport(
  input: UsageReconciliationReportInput,
): UsageReconciliationReport {
  const baseReport = reconcileBillingUsage(input);
  const driftThresholdRatio = normalizedDriftThreshold(input.driftThresholdRatio);
  const findings: UsageReconciliationFinding[] = [];

  for (const event of baseReport.admittedLedgerEventsWithoutCompletion) {
    findings.push({
      reason: "missing_completion",
      severity: "warning",
      accountId: event.accountId,
      usageEventId: event.eventId,
      ledgerState: event.state,
    });
  }

  for (const event of baseReport.admittedLedgerEventsWithoutUsage) {
    findings.push({
      reason: "missing_usage",
      severity: "warning",
      accountId: event.accountId,
      usageEventId: event.eventId,
    });
  }

  for (const usage of baseReport.providerUsageWithoutAdmission) {
    findings.push({
      reason: "unmatched_external_usage",
      severity: "critical",
      source: "provider",
      usageEventId: usage.usageEventId,
      reservationId: usage.reservationId,
      observationId: firstUsageKey(usage) ?? "provider-usage-without-linkage",
    });
  }

  for (const observation of baseReport.langfuseObservationsWithoutAdmission) {
    findings.push({
      reason: "unmatched_external_usage",
      severity: "critical",
      source: "langfuse",
      usageEventId: observation.usageEventId ?? null,
      reservationId: observation.reservationId ?? null,
      observationId: observation.observationId ?? observation.id,
    });
  }

  const usageByAdmissionKey = groupUsageByAdmissionKey(allUsageEnvelopes(input));
  for (const [usageEventId, usageEnvelopes] of usageByAdmissionKey) {
    const providerReportedAttempts = usageEnvelopes.filter((usage) => usage.source === "provider_reported");
    if (providerReportedAttempts.length > 1) {
      findings.push({
        reason: "duplicate_settlement",
        severity: "critical",
        usageEventId,
        attempts: providerReportedAttempts.length,
      });
    }

    const estimatedUsage = usageEnvelopes.find((usage) => usage.source === "estimated");
    const reportedUsage = providerReportedAttempts[0];
    if (!estimatedUsage || !reportedUsage) {
      continue;
    }

    const tokenDrift = relativeDrift(
      finiteNonNegativeNumber(estimatedUsage.totalTokens),
      finiteNonNegativeNumber(reportedUsage.totalTokens),
    );
    if (tokenDrift !== null && tokenDrift > driftThresholdRatio) {
      findings.push({
        reason: "usage_drift",
        severity: "warning",
        usageEventId,
        metric: "total_tokens",
        driftRatio: tokenDrift,
        thresholdRatio: driftThresholdRatio,
      });
    }

    const costDrift = relativeDrift(
      finiteNonNegativeNumber(estimatedUsage.costUsd),
      finiteNonNegativeNumber(reportedUsage.costUsd),
    );
    if (costDrift !== null && costDrift > driftThresholdRatio) {
      findings.push({
        reason: "usage_drift",
        severity: "warning",
        usageEventId,
        metric: "cost_usd",
        driftRatio: costDrift,
        thresholdRatio: driftThresholdRatio,
      });
    }
  }

  const ledgerTierStates: BillingTierStateObservation[] = input.ledgerEvents.map((event) => ({
    accountId: event.accountId,
    tier: event.tier,
    source: "ledger",
  }));
  for (const tierState of [...ledgerTierStates, ...(input.billingTierStates ?? [])]) {
    if (!isManagedBillingTier(tierState.tier)) {
      findings.push({
        reason: "unknown_tier_state",
        severity: "critical",
        accountId: tierState.accountId,
        source: tierState.source,
      });
    }
  }

  for (const blockState of input.manualBlockStates ?? []) {
    if (hasUnknownBlockState(blockState)) {
      findings.push({
        reason: "unknown_block_state",
        severity: "critical",
        accountId: blockState.accountId,
        source: blockState.source,
      });
    }
  }

  const criticalFindings = findings.filter((finding) => finding.severity === "critical").length;
  const warningFindings = findings.length - criticalFindings;
  const duplicateSettlementGroups = findings.filter((finding) => finding.reason === "duplicate_settlement").length;
  const usageDriftFindings = findings.filter((finding) => finding.reason === "usage_drift").length;

  return {
    visibility: "internal_admin_only",
    readonly: true,
    findings,
    baseReport,
    summary: {
      ...baseReport.summary,
      findings: findings.length,
      criticalFindings,
      warningFindings,
      duplicateSettlementGroups,
      usageDriftFindings,
    },
  };
}
