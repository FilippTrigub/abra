import type { BillingAdmissionResult } from "./admission-ledger";
import { buildLangfuseAdmissionMetadata, type LangfuseAdmissionMetadataInput } from "./provider-usage-envelope";
import type { LangfuseBillingMetadata } from "./contracts";

export interface BillingAdmissionTelemetryPayload {
  reservation: BillingAdmissionResult;
  metadata: LangfuseBillingMetadata;
}

export interface BillingAdmissionTelemetryHook {
  onAdmissionReserved?: (payload: BillingAdmissionTelemetryPayload) => void | Promise<void>;
}

export interface BillingAdmissionTelemetryResult {
  emitted: boolean;
  retryable: boolean;
  error: string | null;
  metadata: LangfuseBillingMetadata;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown billing telemetry error.";
}

export async function emitAdmissionTelemetrySafely(input: {
  hook: BillingAdmissionTelemetryHook | null | undefined;
  reservation: BillingAdmissionResult;
  metadata: LangfuseAdmissionMetadataInput;
}): Promise<BillingAdmissionTelemetryResult> {
  const metadata = buildLangfuseAdmissionMetadata({
    ...input.metadata,
    usageEventId: input.metadata.usageEventId ?? input.reservation.eventId,
  });

  if (!input.hook?.onAdmissionReserved) {
    return {
      emitted: false,
      retryable: false,
      error: null,
      metadata,
    };
  }

  try {
    await input.hook.onAdmissionReserved({ reservation: input.reservation, metadata });
    return {
      emitted: true,
      retryable: false,
      error: null,
      metadata,
    };
  } catch (error) {
    return {
      emitted: false,
      retryable: true,
      error: errorMessage(error),
      metadata,
    };
  }
}
