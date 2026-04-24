import { getAdminFirestore } from "@/lib/firebase/admin";
import { getPlatformAccount } from "@/lib/platform-account";
import {
  dispatchOrchestrationAction,
  getOrchestrationAdapter,
  type MockOperationOutcome,
} from "@/lib/orchestration";
import * as admin from "firebase-admin";
import type { DocumentData, Timestamp } from "firebase-admin/firestore";

export type DeploymentStatus = "queued" | "running" | "succeeded" | "failed";
export type DeploymentEnvironment = "preview" | "staging" | "production";
export type DeploymentPersistence = "database" | "memory";

export interface DashboardDeploymentRequest {
  name: string;
  environment: DeploymentEnvironment;
  sourceRef: string;
  notes: string;
  mockOutcome: MockOperationOutcome;
}

interface DeploymentPayloadEnvelope {
  request: DashboardDeploymentRequest;
  orchestration?: {
    requestId: string;
    operationId?: string;
    adapter?: string;
    pollAfterMs?: number;
    lastKnownStatus?: DeploymentStatus;
    lastSyncedAt?: string;
  };
}

export interface DashboardDeployment {
  id: string;
  accountScope: string;
  persistence: DeploymentPersistence;
  status: DeploymentStatus;
  errorMessage: string | null;
  resultUrl: string | null;
  createdAt: string;
  updatedAt: string;
  request: DashboardDeploymentRequest;
  orchestration: {
    requestId: string;
    operationId: string | null;
    adapter: string | null;
    pollAfterMs: number;
    lastKnownStatus: DeploymentStatus;
    lastSyncedAt: string | null;
  } | null;
}

interface DeploymentRecordRow {
  id: string;
  account_id: string;
  agent_id: string | null;
  request_payload: unknown;
  status: string;
  error_message: string | null;
  result_url: string | null;
  created_at: string;
  updated_at: string;
}

interface MemoryDeploymentRecord {
  id: string;
  accountScope: string;
  requestPayload: DeploymentPayloadEnvelope;
  status: DeploymentStatus;
  errorMessage: string | null;
  resultUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateDeploymentInput {
  authUserId: string;
  request: DashboardDeploymentRequest;
}

const MEMORY_SCOPE_PREFIX = "memory:";
const deploymentMemoryStore = new Map<string, MemoryDeploymentRecord>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDeploymentStatus(value: unknown): value is DeploymentStatus {
  return (
    value === "queued" ||
    value === "running" ||
    value === "succeeded" ||
    value === "failed"
  );
}

function isEnvironment(value: unknown): value is DeploymentEnvironment {
  return value === "preview" || value === "staging" || value === "production";
}

function isMockOutcome(value: unknown): value is MockOperationOutcome {
  return value === "succeeded" || value === "failed";
}

function getMemoryScope(authUserId: string) {
  return `${MEMORY_SCOPE_PREFIX}${authUserId}`;
}

function isMemoryScope(accountScope: string) {
  return accountScope.startsWith(MEMORY_SCOPE_PREFIX);
}

function normalizePayload(value: unknown): DeploymentPayloadEnvelope | null {
  if (!isRecord(value) || !isRecord(value.request)) {
    return null;
  }

  const request = value.request;
  const environment = request.environment;
  const mockOutcome = request.mockOutcome;

  if (
    typeof request.name !== "string" ||
    typeof request.sourceRef !== "string" ||
    typeof request.notes !== "string" ||
    !isEnvironment(environment) ||
    !isMockOutcome(mockOutcome)
  ) {
    return null;
  }

  const orchestration = isRecord(value.orchestration) ? value.orchestration : null;

  return {
    request: {
      name: request.name,
      environment,
      sourceRef: request.sourceRef,
      notes: request.notes,
      mockOutcome,
    },
    orchestration: orchestration
      ? {
          requestId:
            typeof orchestration.requestId === "string"
              ? orchestration.requestId
              : crypto.randomUUID(),
          operationId:
            typeof orchestration.operationId === "string"
              ? orchestration.operationId
              : undefined,
          adapter:
            typeof orchestration.adapter === "string"
              ? orchestration.adapter
              : undefined,
          pollAfterMs:
            typeof orchestration.pollAfterMs === "number"
              ? orchestration.pollAfterMs
              : undefined,
          lastKnownStatus: isDeploymentStatus(orchestration.lastKnownStatus)
            ? orchestration.lastKnownStatus
            : undefined,
          lastSyncedAt:
            typeof orchestration.lastSyncedAt === "string"
              ? orchestration.lastSyncedAt
              : undefined,
        }
      : undefined,
  };
}

function toDashboardDeployment(
  record:
    | { persistence: "database"; row: DeploymentRecordRow; accountScope: string }
    | { persistence: "memory"; row: MemoryDeploymentRecord; accountScope: string },
): DashboardDeployment {
  const payload =
    record.persistence === "database"
      ? normalizePayload(record.row.request_payload)
      : record.row.requestPayload;
  const safePayload =
    payload ?? {
      request: {
        name: "Untitled deployment",
        environment: "preview",
        sourceRef: "unknown",
        notes: "",
        mockOutcome: "succeeded",
      },
      orchestration: {
        requestId: crypto.randomUUID(),
      },
    };
  const status =
    record.persistence === "database" && isDeploymentStatus(record.row.status)
      ? record.row.status
      : record.persistence === "memory"
        ? record.row.status
        : "queued";
  const createdAt =
    record.persistence === "database" ? record.row.created_at : record.row.createdAt;
  const updatedAt =
    record.persistence === "database" ? record.row.updated_at : record.row.updatedAt;
  const errorMessage =
    record.persistence === "database"
      ? record.row.error_message
      : record.row.errorMessage;
  const resultUrl =
    record.persistence === "database" ? record.row.result_url : record.row.resultUrl;
  const orchestration = safePayload.orchestration;

  return {
    id: record.row.id,
    accountScope: record.accountScope,
    persistence: record.persistence,
    status,
    errorMessage,
    resultUrl,
    createdAt,
    updatedAt,
    request: safePayload.request,
    orchestration: orchestration
      ? {
          requestId: orchestration.requestId,
          operationId: orchestration.operationId ?? null,
          adapter: orchestration.adapter ?? null,
          pollAfterMs: orchestration.pollAfterMs ?? 1500,
          lastKnownStatus: orchestration.lastKnownStatus ?? status,
          lastSyncedAt: orchestration.lastSyncedAt ?? null,
        }
      : null,
  };
}

function sortDeployments<T extends { createdAt: string }>(records: T[]) {
  return [...records].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

async function resolveAccountScope(authUserId: string) {
  const account = await getPlatformAccount(authUserId);

  if (account?.id) {
    return {
      accountScope: account.id,
      persistence: "database" as const,
      warning: null,
    };
  }

  return {
    accountScope: getMemoryScope(authUserId),
    persistence: "memory" as const,
    warning:
      "Firestore deployment storage is unavailable. Requests are stored in an in-memory fallback for this session.",
  };
}

export async function getDeploymentFeed(authUserId: string) {
  const account = await resolveAccountScope(authUserId);
  const deployments = await listDeployments(account.accountScope);

  return {
    ...account,
    deployments,
  };
}

async function listDeployments(accountScope: string) {
  if (isMemoryScope(accountScope)) {
    return sortDeployments(
      [...deploymentMemoryStore.values()]
        .filter((record) => record.accountScope === accountScope)
        .map((row) =>
          toDashboardDeployment({
            persistence: "memory",
            row,
            accountScope,
          }),
        ),
    );
  }

  try {
    const firestore = getAdminFirestore();
    const snapshot = await firestore
      .collection(`accounts/${accountScope}/deployments`)
      .orderBy("createdAt", "desc")
      .limit(12)
      .get();

    return snapshot.docs.map((doc) =>
      toDashboardDeployment({
        persistence: "database",
        row: {
          id: doc.id,
          account_id: accountScope,
          agent_id: null,
          request_payload: doc.data().requestPayload,
          status: doc.data().status,
          error_message: doc.data().errorMessage ?? null,
          result_url: doc.data().resultUrl ?? null,
          created_at: doc.data().createdAt,
          updated_at: doc.data().updatedAt,
        } as DeploymentRecordRow,
        accountScope,
      }),
    );
  } catch (error) {
    console.warn("[deployments] list failed, falling back to memory:", error);
    return [];
  }
}

async function getDeploymentRecordForUser(authUserId: string, deploymentId: string) {
  const account = await resolveAccountScope(authUserId);
  const accountScoped = await getDeploymentRecord(account.accountScope, deploymentId);

  if (accountScoped) {
    return accountScoped;
  }

  const memoryScoped = await getDeploymentRecord(getMemoryScope(authUserId), deploymentId);

  return memoryScoped;
}

async function getDeploymentRecord(accountScope: string, deploymentId: string) {
  if (isMemoryScope(accountScope)) {
    const row = deploymentMemoryStore.get(deploymentId);
    if (!row || row.accountScope !== accountScope) {
      return null;
    }

    return toDashboardDeployment({
      persistence: "memory",
      row,
      accountScope,
    });
  }

  try {
    const firestore = getAdminFirestore();
    const doc = await firestore
      .doc(`accounts/${accountScope}/deployments/${deploymentId}`)
      .get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return toDashboardDeployment({
      persistence: "database",
      row: {
        id: doc.id,
        account_id: accountScope,
        agent_id: null,
        request_payload: data.requestPayload,
        status: data.status,
        error_message: data.errorMessage ?? null,
        result_url: data.resultUrl ?? null,
        created_at: data.createdAt,
        updated_at: data.updatedAt,
      } as DeploymentRecordRow,
      accountScope,
    });
  } catch (error) {
    console.warn("[deployments] fetch failed:", error);
    return null;
  }
}

async function persistDeployment(
  deployment: DashboardDeployment,
  accountScope: string,
): Promise<DashboardDeployment> {
  const payload: DeploymentPayloadEnvelope = {
    request: deployment.request,
    orchestration: deployment.orchestration
      ? {
          requestId: deployment.orchestration.requestId,
          operationId: deployment.orchestration.operationId ?? undefined,
          adapter: deployment.orchestration.adapter ?? undefined,
          pollAfterMs: deployment.orchestration.pollAfterMs,
          lastKnownStatus: deployment.orchestration.lastKnownStatus,
          lastSyncedAt: deployment.orchestration.lastSyncedAt ?? undefined,
        }
      : undefined,
  };

  if (deployment.persistence === "memory" || isMemoryScope(accountScope)) {
    const row: MemoryDeploymentRecord = {
      id: deployment.id,
      accountScope,
      requestPayload: payload,
      status: deployment.status,
      errorMessage: deployment.errorMessage,
      resultUrl: deployment.resultUrl,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
    };

    deploymentMemoryStore.set(deployment.id, row);
    return toDashboardDeployment({
      persistence: "memory",
      row,
      accountScope,
    });
  }

  const firestore = getAdminFirestore();
  const docRef = firestore.doc(`accounts/${accountScope}/deployments/${deployment.id}`);
  const doc = await docRef.get();

  const now = admin.firestore.FieldValue.serverTimestamp();

  if (!doc.exists) {
    await docRef.set({
      id: deployment.id,
      accountScope,
      requestPayload: payload,
      status: deployment.status,
      errorMessage: deployment.errorMessage,
      resultUrl: deployment.resultUrl,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await docRef.update({
      requestPayload: payload,
      status: deployment.status,
      errorMessage: deployment.errorMessage,
      resultUrl: deployment.resultUrl,
      updatedAt: now,
    });
  }

  return toDashboardDeployment({
    persistence: "database",
    row: {
      id: deployment.id,
      account_id: accountScope,
      agent_id: null,
      request_payload: payload,
      status: deployment.status,
      error_message: deployment.errorMessage,
      result_url: deployment.resultUrl,
      created_at: deployment.createdAt,
      updated_at: deployment.updatedAt,
    } as DeploymentRecordRow,
    accountScope,
  });
}

export async function createDeploymentRecord({
  authUserId,
  request,
}: CreateDeploymentInput) {
  const account = await resolveAccountScope(authUserId);
  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();
  const requestPayload: DeploymentPayloadEnvelope = {
    request,
    orchestration: {
      requestId,
      lastKnownStatus: "queued",
      pollAfterMs: 1500,
      lastSyncedAt: now,
    },
  };

  if (account.persistence === "memory") {
    const row: MemoryDeploymentRecord = {
      id: crypto.randomUUID(),
      accountScope: account.accountScope,
      requestPayload,
      status: "queued",
      errorMessage: null,
      resultUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    deploymentMemoryStore.set(row.id, row);

    return {
      deployment: toDashboardDeployment({
        persistence: "memory",
        row,
        accountScope: account.accountScope,
      }),
      warning: account.warning,
    };
  }

  try {
    const firestore = getAdminFirestore();
    const deploymentId = crypto.randomUUID();
    const docRef = firestore.doc(`accounts/${account.accountScope}/deployments/${deploymentId}`);

    const nowTs = admin.firestore.FieldValue.serverTimestamp();

    const data = {
      id: deploymentId,
      accountScope: account.accountScope,
      requestPayload,
      status: "queued",
      errorMessage: null,
      resultUrl: null,
      createdAt: nowTs,
      updatedAt: nowTs,
    };

    await docRef.set(data);

    return {
      deployment: toDashboardDeployment({
        persistence: "database",
        row: {
          id: deploymentId,
          account_id: account.accountScope,
          agent_id: null,
          request_payload: requestPayload,
          status: "queued",
          error_message: null,
          result_url: null,
          created_at: now,
          updated_at: now,
        } as DeploymentRecordRow,
        accountScope: account.accountScope,
      }),
      warning: null,
    };
  } catch (error) {
    console.warn("[deployments] create failed, falling back to memory:", error);

    const fallbackScope = getMemoryScope(authUserId);
    const row: MemoryDeploymentRecord = {
      id: crypto.randomUUID(),
      accountScope: fallbackScope,
      requestPayload,
      status: "queued",
      errorMessage: null,
      resultUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    deploymentMemoryStore.set(row.id, row);

    return {
      deployment: toDashboardDeployment({
        persistence: "memory",
        row,
        accountScope: fallbackScope,
      }),
      warning:
        "Firestore deployment storage is unavailable. The request was queued in local memory for this process.",
    };
  }
}

export async function dispatchDeploymentRequest(deploymentId: string, authUserId: string) {
  const deployment = await getDeploymentRecordForUser(authUserId, deploymentId);

  if (!deployment) {
    return null;
  }

  try {
    const operation = await dispatchOrchestrationAction("create", {
      requestId:
        deployment.orchestration?.requestId ?? crypto.randomUUID(),
      target: {
        accountId: deployment.accountScope,
        agentId: null,
        deploymentId: deployment.id,
      },
      payload: {
        name: deployment.request.name,
        environment: deployment.request.environment,
        sourceRef: deployment.request.sourceRef,
        notes: deployment.request.notes,
      },
      mockBehavior: {
        outcome: deployment.request.mockOutcome,
      },
    });

    return await persistDeployment(
      {
        ...deployment,
        status: operation.status,
        updatedAt: operation.updatedAt,
        errorMessage: operation.error?.message ?? null,
        resultUrl: operation.result?.resourceHandle ?? null,
        orchestration: {
          requestId: operation.requestId,
          operationId: operation.operationId,
          adapter: operation.adapter,
          pollAfterMs: operation.pollAfterMs,
          lastKnownStatus: operation.status,
          lastSyncedAt: operation.updatedAt,
        },
      },
      deployment.accountScope,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dispatch failed.";

    return await persistDeployment(
      {
        ...deployment,
        status: "failed",
        updatedAt: new Date().toISOString(),
        errorMessage: message,
        orchestration: deployment.orchestration
          ? {
              ...deployment.orchestration,
              lastKnownStatus: "failed",
              lastSyncedAt: new Date().toISOString(),
            }
          : null,
      },
      deployment.accountScope,
    );
  }
}

export async function syncDeploymentStatusForUser(
  authUserId: string,
  deploymentId: string,
) {
  const deployment = await getDeploymentRecordForUser(authUserId, deploymentId);

  if (!deployment) {
    return null;
  }

  if (
    !deployment.orchestration?.operationId ||
    deployment.status === "succeeded" ||
    deployment.status === "failed"
  ) {
    return deployment;
  }

  const operation = await getOrchestrationAdapter().getStatus(
    deployment.orchestration.operationId,
  );

  if (!operation) {
    return await persistDeployment(
      {
        ...deployment,
        status: "failed",
        updatedAt: new Date().toISOString(),
        errorMessage: "The orchestration status could not be found for this deployment request.",
        orchestration: {
          ...deployment.orchestration,
          lastKnownStatus: "failed",
          lastSyncedAt: new Date().toISOString(),
        },
      },
      deployment.accountScope,
    );
  }

  return await persistDeployment(
    {
      ...deployment,
      status: operation.status,
      updatedAt: operation.updatedAt,
      errorMessage: operation.error?.message ?? null,
      resultUrl: operation.result?.resourceHandle ?? deployment.resultUrl,
      orchestration: {
        requestId: operation.requestId,
        operationId: operation.operationId,
        adapter: operation.adapter,
        pollAfterMs: operation.pollAfterMs,
        lastKnownStatus: operation.status,
        lastSyncedAt: operation.updatedAt,
      },
    },
    deployment.accountScope,
  );
}
