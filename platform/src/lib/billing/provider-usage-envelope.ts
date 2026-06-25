import {
  createLangfuseBillingMetadata,
  createProviderUsageEnvelope,
  type LangfuseBillingMetadata,
  type ManagedBillingTierReadState,
  type ProviderUsageEnvelope,
  type ProviderUsageSource,
} from "./contracts";

export interface ProviderUsageEnvelopeInput {
  usageEventId?: string | null;
  reservationId?: string | null;
  provider: string;
  model?: string | null;
  source: ProviderUsageSource;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  costUsd?: number | null;
  capturedAt?: string | Date | number | null;
}

export interface LangfuseAdmissionMetadataInput {
  billingAccountId: string;
  abraInstanceId: string;
  deploymentId?: string | null;
  runId?: string | null;
  usageEventId?: string | null;
  tier: ManagedBillingTierReadState;
  environment: string;
  existingMetadata?: Record<string, unknown> | null;
}

function normalizeString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeNonNegativeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeCapturedAt(value: ProviderUsageEnvelopeInput["capturedAt"]) {
  const date = value === undefined || value === null ? new Date() : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid provider usage capture timestamp.");
  }

  return date.toISOString();
}

export function buildProviderUsageEnvelope(input: ProviderUsageEnvelopeInput): ProviderUsageEnvelope {
  const inputTokens = normalizeNonNegativeNumber(input.inputTokens);
  const outputTokens = normalizeNonNegativeNumber(input.outputTokens);
  const explicitTotal = normalizeNonNegativeNumber(input.totalTokens);
  const totalTokens = explicitTotal ?? (inputTokens !== null || outputTokens !== null
    ? (inputTokens ?? 0) + (outputTokens ?? 0)
    : null);
  const usageEventId = normalizeString(input.usageEventId);
  const reservationId = normalizeString(input.reservationId) ?? usageEventId;

  return createProviderUsageEnvelope({
    usageEventId,
    reservationId,
    provider: input.provider,
    model: normalizeString(input.model) ?? null,
    source: input.source,
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd: normalizeNonNegativeNumber(input.costUsd),
    capturedAt: normalizeCapturedAt(input.capturedAt),
  });
}

export function buildProviderReportedUsageEnvelope(
  input: Omit<ProviderUsageEnvelopeInput, "source">,
) {
  return buildProviderUsageEnvelope({ ...input, source: "provider_reported" });
}

export function buildEstimatedUsageEnvelope(
  input: Omit<ProviderUsageEnvelopeInput, "source">,
) {
  return buildProviderUsageEnvelope({ ...input, source: "estimated" });
}

export function buildLangfuseAdmissionMetadata(input: LangfuseAdmissionMetadataInput): LangfuseBillingMetadata {
  return {
    ...(input.existingMetadata ?? {}),
    ...createLangfuseBillingMetadata({
      billingAccountId: input.billingAccountId,
      abraInstanceId: input.abraInstanceId,
      deploymentId: input.deploymentId,
      runId: input.runId,
      usageEventId: input.usageEventId,
      tier: input.tier,
      environment: input.environment,
    }),
  };
}
