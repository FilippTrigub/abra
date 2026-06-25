import type { AdmissionLedgerEventDocument } from "./admission-ledger";
import type { ProviderUsageEnvelope } from "./contracts";

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

export function reconcileBillingUsage(input: BillingReconciliationReportInput): BillingReconciliationReport {
  const ledgerByEventId = new Map(input.ledgerEvents.map((event) => [event.eventId, event]));
  const providerUsageByKey = new Map<string, ProviderUsageEnvelope>();

  for (const usage of input.providerUsage) {
    for (const key of usageKeys(usage)) {
      providerUsageByKey.set(key, usage);
    }
  }

  const admittedLedgerEvents = input.ledgerEvents.filter((event) => event.status === "admitted");
  const admittedLedgerEventsWithoutCompletion = admittedLedgerEvents.filter((event) => event.state === "reserved");
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
