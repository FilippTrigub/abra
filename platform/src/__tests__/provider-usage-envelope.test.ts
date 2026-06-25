import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminFirestoreMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

import {
  admissionUsageEventPath,
  BillingAdmissionService,
  createAdmissionEventId,
} from "@/lib/billing/admission-ledger";
import { ManagedRuntimeAdmissionService } from "@/lib/billing/managed-admission";
import {
  buildEstimatedUsageEnvelope,
  buildLangfuseAdmissionMetadata,
  buildProviderReportedUsageEnvelope,
} from "@/lib/billing/provider-usage-envelope";

type StoredDoc = Record<string, unknown>;

const ACCOUNT_ID = "acct-usage";
const DEPLOYMENT_ID = "deploy-usage";
const NOW = "2026-06-25T12:00:00.000Z";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createFirestoreMock(initialDocs: Array<[string, StoredDoc]> = []) {
  const docs = new Map<string, StoredDoc>(initialDocs);
  const doc = vi.fn((path: string) => ({
    path,
    get: vi.fn(async () => ({
      exists: docs.has(path),
      data: () => {
        const value = docs.get(path);
        return value ? clone(value) : undefined;
      },
    })),
  }));
  let transactionQueue = Promise.resolve();
  const runTransaction = vi.fn(<T>(callback: (transaction: {
    get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => StoredDoc | undefined }>;
    set: (ref: { path: string }, data: StoredDoc, options?: { merge?: boolean }) => void;
  }) => Promise<T>) => {
    const run = async () => {
      const staged: Array<{ path: string; data: StoredDoc; merge?: boolean }> = [];
      const transaction = {
        get: vi.fn(async (ref: { path: string }) => ({
          exists: docs.has(ref.path),
          data: () => {
            const value = docs.get(ref.path);
            return value ? clone(value) : undefined;
          },
        })),
        set: vi.fn((ref: { path: string }, data: StoredDoc, options?: { merge?: boolean }) => {
          staged.push({ path: ref.path, data: clone(data), merge: options?.merge });
        }),
      };
      const result = await callback(transaction);
      for (const write of staged) {
        docs.set(write.path, write.merge && docs.has(write.path)
          ? { ...docs.get(write.path), ...write.data }
          : write.data);
      }
      return result;
    };

    const result = transactionQueue.then(run, run);
    transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  });

  return { firestore: { doc, runTransaction }, docs };
}

function eventPathFor(idempotencyKey: string) {
  return admissionUsageEventPath(ACCOUNT_ID, createAdmissionEventId({ accountId: ACCOUNT_ID, idempotencyKey }));
}

describe("provider usage envelopes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ABRA_MANAGED_RUNTIME_CREDENTIAL_SECRET = "test-platform-secret";
  });

  it("links provider-reported usage to admission while keeping quota authority false", () => {
    const envelope = buildProviderReportedUsageEnvelope({
      usageEventId: "adm_123",
      provider: "huggingface",
      model: "Qwen/Qwen2.5-VL-7B-Instruct",
      inputTokens: 100,
      outputTokens: 25,
      costUsd: 0.03,
      capturedAt: NOW,
    });

    expect(envelope).toMatchObject({
      usageEventId: "adm_123",
      reservationId: "adm_123",
      source: "provider_reported",
      totalTokens: 125,
      authoritativeForQuota: false,
      authoritativeForUsageAnalytics: true,
    });
  });

  it("marks estimated provider usage as non-authoritative for quota and analytics", () => {
    const envelope = buildEstimatedUsageEnvelope({
      usageEventId: "adm_123",
      provider: "local-runtime",
      model: "smolvlm",
      totalTokens: 300,
      capturedAt: NOW,
    });

    expect(envelope).toMatchObject({
      source: "estimated",
      authoritativeForQuota: false,
      authoritativeForUsageAnalytics: false,
    });
  });

  it("stores provider-returned usage on the admission ledger event with usageEventId linkage", async () => {
    const firestore = createFirestoreMock();
    const service = new BillingAdmissionService(firestore.firestore as never);
    const reservation = await service.reserve({
      accountId: ACCOUNT_ID,
      tier: "free",
      idempotencyKey: "provider-usage-message",
      now: NOW,
    });

    const result = await service.recordProviderUsage({
      accountId: ACCOUNT_ID,
      eventId: reservation.eventId,
      now: NOW,
      usage: {
        provider: "huggingface",
        model: "Qwen/Qwen2.5-VL-7B-Instruct",
        source: "provider_reported",
        inputTokens: 20,
        outputTokens: 10,
        costUsd: 0.01,
      },
    });

    expect(result.event.providerUsageEnvelopes[0]).toMatchObject({
      usageEventId: reservation.eventId,
      reservationId: reservation.eventId,
      source: "provider_reported",
      authoritativeForQuota: false,
      authoritativeForUsageAnalytics: true,
    });
    expect(firestore.docs.get(eventPathFor("provider-usage-message"))).toMatchObject({
      providerUsageUpdatedAt: NOW,
    });
  });

  it("builds Langfuse metadata with admission ledger authority fields", () => {
    expect(buildLangfuseAdmissionMetadata({
      billingAccountId: ACCOUNT_ID,
      abraInstanceId: "abra-instance-1",
      deploymentId: DEPLOYMENT_ID,
      runId: "run-1",
      usageEventId: "adm_123",
      tier: "growth",
      environment: "test",
      existingMetadata: { feature: "caption" },
    })).toMatchObject({
      feature: "caption",
      billing_account_id: ACCOUNT_ID,
      abra_instance_id: "abra-instance-1",
      deployment_id: DEPLOYMENT_ID,
      run_id: "run-1",
      usage_event_id: "adm_123",
      tier: "growth",
      environment: "test",
      quota_authority: "abra_admission_ledger",
      provider_usage_authoritative_for_quota: false,
      langfuse_cost_authoritative_for_quota: false,
    });
  });

  it("does not fail admission when Langfuse telemetry emission is unavailable", async () => {
    const firestore = createFirestoreMock([[`accounts/${ACCOUNT_ID}/summaries/billing`, { tier: "free" }]]);
    getAdminFirestoreMock.mockReturnValue(firestore.firestore);
    const onAdmissionReserved = vi.fn(async () => {
      throw new Error("langfuse unavailable");
    });
    const service = new ManagedRuntimeAdmissionService(
      firestore.firestore as never,
      { onAdmissionReserved },
    );
    const { createManagedRuntimeCredential } = await import("@/lib/billing/managed-admission-runtime");
    const credential = createManagedRuntimeCredential({
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      secret: "test-platform-secret",
    });

    const decision = await service.reserve({
      accountId: ACCOUNT_ID,
      deploymentId: DEPLOYMENT_ID,
      requestId: "runtime-request-langfuse-down",
      credential,
      now: NOW,
    });

    expect(decision).toMatchObject({ allow: true, status: 200, reasonCode: null });
    expect(onAdmissionReserved).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        billing_account_id: ACCOUNT_ID,
        deployment_id: DEPLOYMENT_ID,
        usage_event_id: decision.reservation?.eventId,
        quota_authority: "abra_admission_ledger",
      }),
    }));
  });
});
