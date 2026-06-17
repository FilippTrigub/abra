import { getAdminFirestore } from "@/lib/firebase/admin";
import { getPlatformAccount } from "@/lib/platform-account";
import { loadAgentConfig } from "@/lib/agent-config/service";
import type { AgentConfig } from "@/lib/agent-config/types";
import { loadRuntimeEnvForOrchestrationWithTelegramCompat } from "@/lib/runtime-env/telegram-compat";
import type { RuntimeEnvDecryptedMap } from "@/lib/runtime-env/types";
import {
  dispatchOrchestrationAction,
  getOrchestrationAdapter,
  type AkRuntimeMetadata,
  type OrchestrationAction,
  type OrchestrationOperation,
  type OrchestrationOperationStatus,
} from "@/lib/orchestration";
import { synthesizeMockOperation } from "@/lib/orchestration/mock-store";
import { firestoreOperationStore } from "@/lib/orchestration/firestore-operation-store";
import { toIsoTimestamp } from "@/lib/firestore-serialization";
import * as admin from "firebase-admin";

export type DeploymentStatus = "queued" | "running" | "succeeded" | "failed" | "deleting" | "deleted";
export type DeploymentEnvironment = "preview" | "staging" | "production";
export type DeploymentPersistence = "database" | "memory";

export const CURRENT_ABRA_DEPLOYMENT_ID = "abra-instance";

export interface DashboardDeploymentRequest {
  name: string;
  environment: DeploymentEnvironment;
  sourceRef: string;
  notes: string;
}

interface DeploymentPayloadEnvelope {
  request: DashboardDeploymentRequest;
  orchestration?: {
    requestId: string;
    action?: OrchestrationAction;
    operationId?: string;
    adapter?: string;
    pollAfterMs?: number;
    lastKnownStatus?: DeploymentStatus;
    lastSyncedAt?: string;
    aksNames?: AkRuntimeMetadata;
    desiredRuntimeEnvVersionId?: string;
    appliedRuntimeEnvVersionId?: string;
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
    action: OrchestrationAction;
    operationId: string | null;
    adapter: string | null;
    pollAfterMs: number;
    lastKnownStatus: DeploymentStatus;
    lastSyncedAt: string | null;
    aksNames?: AkRuntimeMetadata;
    desiredRuntimeEnvVersionId?: string;
    appliedRuntimeEnvVersionId?: string;
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

export type RuntimeEnvDeploymentUpdateResult = {
  applied: boolean;
  status: "saved" | "applying" | "live";
  reason: string | null;
  deployment: DashboardDeployment | null;
  warning: string | null;
};

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
    value === "failed" ||
    value === "deleting" ||
    value === "deleted"
  );
}

function isTerminalDeploymentStatus(status: DeploymentStatus) {
  return status === "succeeded" || status === "failed" || status === "deleted";
}

function isLiveDeployment(deployment: DashboardDeployment) {
  return deployment.status === "queued" ||
    deployment.status === "running" ||
    deployment.status === "succeeded" ||
    deployment.status === "deleting" ||
    (deployment.status === "failed" && deployment.orchestration?.action === "destroy");
}

function isOrchestrationAction(value: unknown): value is OrchestrationAction {
  return value === "create" || value === "update" || value === "restart" || value === "destroy";
}

function toDeploymentStatus(
  operationStatus: OrchestrationOperationStatus,
  action: OrchestrationAction,
): DeploymentStatus {
  if (action === "destroy") {
    if (operationStatus === "succeeded") {
      return "deleted";
    }

    if (operationStatus === "failed") {
      return "failed";
    }

    return "deleting";
  }

  return operationStatus;
}

function isEnvironment(value: unknown): value is DeploymentEnvironment {
  return value === "preview" || value === "staging" || value === "production";
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
  if (
    typeof request.name !== "string" ||
    typeof request.sourceRef !== "string" ||
    typeof request.notes !== "string" ||
    !isEnvironment(environment)
  ) {
    return null;
  }

  const orchestration = isRecord(value.orchestration) ? value.orchestration : null;
  const rawAksNames = orchestration && isRecord(orchestration.aksNames)
    ? orchestration.aksNames
    : null;

  return {
    request: {
      name: request.name,
      environment,
      sourceRef: request.sourceRef,
      notes: request.notes,
    },
    orchestration: orchestration
      ? {
          requestId:
            typeof orchestration.requestId === "string"
              ? orchestration.requestId
              : crypto.randomUUID(),
          action: isOrchestrationAction(orchestration.action)
            ? orchestration.action
            : "create",
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
          aksNames: rawAksNames
            ? {
                namespace:
                  typeof rawAksNames.namespace === "string"
                    ? rawAksNames.namespace
                    : "abra",
                configMapName:
                  typeof rawAksNames.configMapName === "string"
                    ? rawAksNames.configMapName
                    : undefined,
                secretName:
                  typeof rawAksNames.secretName === "string"
                    ? rawAksNames.secretName
                    : undefined,
                serviceAccountName:
                  typeof rawAksNames.serviceAccountName === "string"
                    ? rawAksNames.serviceAccountName
                    : undefined,
                statefulSetName:
                  typeof rawAksNames.statefulSetName === "string"
                    ? rawAksNames.statefulSetName
                    : "",
                pvcName:
                  typeof rawAksNames.pvcName === "string"
                    ? rawAksNames.pvcName
                    : "",
                serviceName:
                  typeof rawAksNames.serviceName === "string"
                    ? rawAksNames.serviceName
                    : "",
                configRevision:
                  typeof rawAksNames.configRevision === "number"
                    ? rawAksNames.configRevision
                    : undefined,
                podName:
                  typeof rawAksNames.podName === "string"
                    ? rawAksNames.podName
                    : undefined,
                gatewayRoute:
                  typeof rawAksNames.gatewayRoute === "string"
                    ? rawAksNames.gatewayRoute
                    : undefined,
              }
            : undefined,
          desiredRuntimeEnvVersionId:
            typeof orchestration.desiredRuntimeEnvVersionId === "string"
              ? orchestration.desiredRuntimeEnvVersionId
              : undefined,
          appliedRuntimeEnvVersionId:
            typeof orchestration.appliedRuntimeEnvVersionId === "string"
              ? orchestration.appliedRuntimeEnvVersionId
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
    record.persistence === "database"
      ? toIsoTimestamp(record.row.created_at, new Date().toISOString())
      : record.row.createdAt;
  const updatedAt =
    record.persistence === "database"
      ? toIsoTimestamp(record.row.updated_at, createdAt)
      : record.row.updatedAt;
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
          action: orchestration.action ?? "create",
          operationId: orchestration.operationId ?? null,
          adapter: orchestration.adapter ?? null,
          pollAfterMs: orchestration.pollAfterMs ?? 1500,
          lastKnownStatus: orchestration.lastKnownStatus ?? status,
          lastSyncedAt: orchestration.lastSyncedAt ?? null,
          aksNames: orchestration.aksNames,
          desiredRuntimeEnvVersionId: orchestration.desiredRuntimeEnvVersionId,
          appliedRuntimeEnvVersionId: orchestration.appliedRuntimeEnvVersionId,
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
    currentDeployment: findCurrentDeployment(deployments),
  };
}

function findCurrentDeployment(deployments: DashboardDeployment[]) {
  return deployments.find((deployment) => isLiveDeployment(deployment))
    ?? deployments.find((deployment) => deployment.id === CURRENT_ABRA_DEPLOYMENT_ID && deployment.status !== "deleted")
    ?? deployments.find((deployment) => deployment.id === CURRENT_ABRA_DEPLOYMENT_ID)
    ?? null;
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

async function getCurrentDeploymentRecord(accountScope: string) {
  const currentDeployment = await getDeploymentRecord(accountScope, CURRENT_ABRA_DEPLOYMENT_ID);
  if (currentDeployment) {
    return currentDeployment;
  }

  const deployments = await listDeployments(accountScope);
  return findCurrentDeployment(deployments);
}

function buildDeploymentOperationInput(
  deployment: DashboardDeployment,
  agentConfig: AgentConfig | null,
  overrides: {
    runtimeEnv?: RuntimeEnvDecryptedMap;
    configRevision?: number;
  } = {},
) {
  return {
    requestId: deployment.orchestration?.requestId ?? crypto.randomUUID(),
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
      ...(deployment.orchestration?.aksNames ? { aksNames: deployment.orchestration.aksNames } : {}),
      ...(overrides.configRevision ? { configRevision: overrides.configRevision } : {}),
      ...(overrides.runtimeEnv ? { runtimeEnv: overrides.runtimeEnv } : {}),
      ...(agentConfig ? { agentConfig } : {}),
    },
  };
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
          action: deployment.orchestration.action,
          operationId: deployment.orchestration.operationId ?? undefined,
          adapter: deployment.orchestration.adapter ?? undefined,
          pollAfterMs: deployment.orchestration.pollAfterMs,
          lastKnownStatus: deployment.orchestration.lastKnownStatus,
          lastSyncedAt: deployment.orchestration.lastSyncedAt ?? undefined,
          aksNames: deployment.orchestration.aksNames,
          desiredRuntimeEnvVersionId: deployment.orchestration.desiredRuntimeEnvVersionId,
          appliedRuntimeEnvVersionId: deployment.orchestration.appliedRuntimeEnvVersionId,
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
  const existingDeployment = await getCurrentDeploymentRecord(account.accountScope);

  if (existingDeployment && isLiveDeployment(existingDeployment)) {
    return {
      deployment: existingDeployment,
      warning: "An Abra instance already exists for this account. Delete it before deploying another one.",
      created: false,
    };
  }

  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();
  const requestPayload: DeploymentPayloadEnvelope = {
    request,
    orchestration: {
      requestId,
      action: "create",
      lastKnownStatus: "queued",
      pollAfterMs: 1500,
      lastSyncedAt: now,
    },
  };

  if (account.persistence === "memory") {
    const row: MemoryDeploymentRecord = {
      id: CURRENT_ABRA_DEPLOYMENT_ID,
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
      created: true,
    };
  }

  try {
    const firestore = getAdminFirestore();
    const deploymentId = CURRENT_ABRA_DEPLOYMENT_ID;
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

    await firestore.runTransaction(async (transaction) => {
      const currentDoc = await transaction.get(docRef);

      if (currentDoc.exists) {
        const currentData = currentDoc.data();
        if (currentData) {
          const currentDeployment = toDashboardDeployment({
            persistence: "database",
            row: {
              id: currentDoc.id,
              account_id: account.accountScope,
              agent_id: null,
              request_payload: currentData.requestPayload,
              status: currentData.status,
              error_message: currentData.errorMessage ?? null,
              result_url: currentData.resultUrl ?? null,
              created_at: currentData.createdAt,
              updated_at: currentData.updatedAt,
            } as DeploymentRecordRow,
            accountScope: account.accountScope,
          });

          if (isLiveDeployment(currentDeployment)) {
            throw new Error("ABRA_INSTANCE_EXISTS");
          }
        }
      }

      transaction.set(docRef, data, { merge: true });
    });

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
      created: true,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "ABRA_INSTANCE_EXISTS") {
      const currentDeployment = existingDeployment
        ?? await getCurrentDeploymentRecord(account.accountScope);

      if (!currentDeployment) {
        throw error;
      }

      return {
        deployment: currentDeployment,
        warning: "An Abra instance already exists for this account. Delete it before deploying another one.",
        created: false,
      };
    }

    console.warn("[deployments] create failed, falling back to memory:", error);

    const fallbackScope = getMemoryScope(authUserId);
    const row: MemoryDeploymentRecord = {
      id: CURRENT_ABRA_DEPLOYMENT_ID,
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
      created: true,
    };
  }
}

function mergeOperationIntoDeployment(
  deployment: DashboardDeployment,
  operation: OrchestrationOperation,
): DashboardDeployment {
  const action = operation.action;
  const desiredRuntimeEnvVersionId = getDesiredRuntimeEnvVersionId(deployment, operation);
  const appliedRuntimeEnvVersionId = getAppliedRuntimeEnvVersionId(
    deployment,
    operation,
    desiredRuntimeEnvVersionId,
  );

  return {
    ...deployment,
    status: toDeploymentStatus(operation.status, action),
    updatedAt: operation.updatedAt,
    errorMessage: operation.error?.message ?? null,
    resultUrl: operation.result?.resourceHandle ?? deployment.resultUrl,
      orchestration: {
        requestId: operation.requestId,
        action,
        operationId: operation.operationId,
        adapter: operation.adapter,
        pollAfterMs: operation.pollAfterMs,
        lastKnownStatus: toDeploymentStatus(operation.status, action),
        lastSyncedAt: operation.updatedAt,
        aksNames: operation.result?.metadata?.aks ?? deployment.orchestration?.aksNames,
        desiredRuntimeEnvVersionId,
        appliedRuntimeEnvVersionId,
      },
  };
}

function getOperationRuntimeEnvVersionId(operation: OrchestrationOperation) {
  if (!isRecord(operation.payload)) {
    return undefined;
  }

  return typeof operation.payload.runtimeEnvVersionId === "string"
    ? operation.payload.runtimeEnvVersionId
    : undefined;
}

function getDesiredRuntimeEnvVersionId(
  deployment: DashboardDeployment,
  operation: OrchestrationOperation,
) {
  if (operation.action !== "update") {
    return deployment.orchestration?.desiredRuntimeEnvVersionId;
  }

  return getOperationRuntimeEnvVersionId(operation)
    ?? deployment.orchestration?.desiredRuntimeEnvVersionId;
}

function getAppliedRuntimeEnvVersionId(
  deployment: DashboardDeployment,
  operation: OrchestrationOperation,
  desiredRuntimeEnvVersionId: string | undefined,
) {
  if (
    operation.action === "update" &&
    operation.status === "succeeded" &&
    desiredRuntimeEnvVersionId
  ) {
    return desiredRuntimeEnvVersionId;
  }

  return deployment.orchestration?.appliedRuntimeEnvVersionId;
}

function toRuntimeEnvDeploymentStatus(deployment: DashboardDeployment | null) {
  if (!deployment?.orchestration?.desiredRuntimeEnvVersionId) {
    return "saved" as const;
  }

  if (
    deployment.orchestration.appliedRuntimeEnvVersionId ===
    deployment.orchestration.desiredRuntimeEnvVersionId
  ) {
    return "live" as const;
  }

  return deployment.orchestration.lastKnownStatus === "queued" ||
    deployment.orchestration.lastKnownStatus === "running"
    ? "applying" as const
    : "saved" as const;
}

export async function dispatchDeploymentRequest(deploymentId: string, authUserId: string) {
  const deployment = await getDeploymentRecordForUser(authUserId, deploymentId);

  if (!deployment) {
    return null;
  }

  try {
    const [runtimeEnv, agentConfig] = await Promise.all([
      loadRuntimeEnvForOrchestrationWithTelegramCompat(authUserId),
      loadAgentConfig(authUserId),
    ]);
    if (!agentConfig) {
      throw new Error(
        "Telegram setup is incomplete. Add a bot token and TELEGRAM_HOME_CHANNEL before deploying.",
      );
    }

    const operation = await dispatchOrchestrationAction(
      "create",
      buildDeploymentOperationInput(deployment, agentConfig, { runtimeEnv }),
    );

    return await persistDeployment(mergeOperationIntoDeployment(deployment, operation), deployment.accountScope);
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
              action: "create",
              lastKnownStatus: "failed",
              lastSyncedAt: new Date().toISOString(),
            }
          : null,
      },
      deployment.accountScope,
    );
  }
}

export async function destroyCurrentDeploymentForUser(authUserId: string) {
  const account = await resolveAccountScope(authUserId);
  const deployment = await getCurrentDeploymentRecord(account.accountScope);

  if (!deployment || deployment.status === "deleted") {
    return {
      deployment: null,
      warning: account.warning,
      destroyed: false,
    };
  }

  try {
    const operation = await dispatchOrchestrationAction(
      "destroy",
      buildDeploymentOperationInput(deployment, null),
    );

    return {
      deployment: await persistDeployment(
        mergeOperationIntoDeployment(deployment, operation),
        deployment.accountScope,
      ),
      warning: account.warning,
      destroyed: true,
    };
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Destroy failed.";

    return {
      deployment: await persistDeployment(
        {
          ...deployment,
          status: "failed",
          updatedAt: now,
          errorMessage: message,
          orchestration: deployment.orchestration
            ? {
                ...deployment.orchestration,
                action: "destroy",
                lastKnownStatus: "failed",
                lastSyncedAt: now,
              }
            : null,
        },
        deployment.accountScope,
      ),
      warning: account.warning,
      destroyed: false,
    };
  }
}

export async function updateCurrentDeploymentRuntimeEnvForUser(
  authUserId: string,
  versionId?: string,
): Promise<RuntimeEnvDeploymentUpdateResult> {
  const account = await resolveAccountScope(authUserId);
  const deployment = await getCurrentDeploymentRecord(account.accountScope);

  if (!deployment || deployment.status === "deleted") {
    return {
      applied: false,
      status: "saved",
      reason: "No runtime deployed",
      deployment: null,
      warning: account.warning,
    };
  }

  const aksNames = deployment.orchestration?.aksNames;
  if (!aksNames) {
    return {
      applied: false,
      status: "saved",
      reason: "Runtime deployment metadata is missing",
      deployment,
      warning: account.warning,
    };
  }

  try {
    const [runtimeEnv, agentConfig] = await Promise.all([
      loadRuntimeEnvForOrchestrationWithTelegramCompat(authUserId),
      loadAgentConfig(authUserId),
    ]);
    const operation = await dispatchOrchestrationAction(
      "update",
      buildDeploymentOperationInput(deployment, agentConfig, {
        runtimeEnv,
        configRevision: aksNames.configRevision ?? 1,
      }),
    );

    const updatedDeployment = await persistDeployment(
      mergeOperationIntoDeployment(deployment, {
        ...operation,
        payload: versionId
          ? { ...operation.payload, runtimeEnvVersionId: versionId }
          : operation.payload,
      }),
      deployment.accountScope,
    );
    const status = toRuntimeEnvDeploymentStatus(updatedDeployment);

    return {
      applied: status === "live",
      status,
      reason: null,
      deployment: updatedDeployment,
      warning: account.warning,
    };
  } catch (error) {
    const now = new Date().toISOString();
    const message = error instanceof Error ? error.message : "Runtime update failed.";
    const failedDeployment = await persistDeployment(
      {
        ...deployment,
        status: "failed",
        updatedAt: now,
        errorMessage: message,
        orchestration: deployment.orchestration
          ? {
              ...deployment.orchestration,
              action: "update",
              lastKnownStatus: "failed",
              lastSyncedAt: now,
              desiredRuntimeEnvVersionId:
                versionId ?? deployment.orchestration.desiredRuntimeEnvVersionId,
            }
          : null,
      },
      deployment.accountScope,
    );

    return {
      applied: false,
      status: toRuntimeEnvDeploymentStatus(failedDeployment),
      reason: "Runtime update failed",
      deployment: failedDeployment,
      warning: account.warning,
    };
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
    isTerminalDeploymentStatus(deployment.status)
  ) {
    return deployment;
  }

  // First, try to read from the durable operation store
  const storedOperation = await firestoreOperationStore.getStatus(
    deployment.orchestration.operationId,
  );
  let operation = storedOperation;
  const adapter = getOrchestrationAdapter();
  const canRefreshFromAdapter =
    !deployment.orchestration.adapter || deployment.orchestration.adapter === adapter.name;

  if (
    canRefreshFromAdapter &&
    (!storedOperation || !isTerminalDeploymentStatus(storedOperation.status))
  ) {
    try {
      const liveOperation = await adapter.getStatus(deployment.orchestration.operationId);

      if (liveOperation) {
        operation = liveOperation;

        if (storedOperation) {
          await firestoreOperationStore.update(liveOperation);
        } else {
          await firestoreOperationStore.create(liveOperation);
        }
      }
    } catch (error) {
      const now = new Date().toISOString();
      const message =
        error instanceof Error
          ? error.message
          : "Unable to refresh orchestration status for this deployment request.";

      return await persistDeployment(
        {
          ...deployment,
          status: "failed",
          updatedAt: now,
          errorMessage: message,
          orchestration: {
            ...deployment.orchestration,
            lastKnownStatus: "failed",
            lastSyncedAt: now,
          },
        },
        deployment.accountScope,
      );
    }
  }

  // Fallback: if not found in durable store and adapter is mock, synthesize from mock store
  if (!operation && deployment.orchestration.adapter === "mock") {
    const adapterOperation = await adapter.getStatus(
      deployment.orchestration.operationId,
    );

    if (adapterOperation) {
      // Persist the mock operation to durable store for future reads
      operation = adapterOperation;
      await firestoreOperationStore.create(adapterOperation);
    }
  }

  // If still no operation found, synthesize or fail
  if (!operation) {
    if (deployment.orchestration.adapter === "mock") {
      const synthesizedOperation = synthesizeMockOperation(
        deployment.orchestration.operationId,
        "create",
        buildDeploymentOperationInput(deployment, null),
        "succeeded",
        deployment.createdAt,
      );

      return await persistDeployment(
        {
          ...deployment,
          ...mergeOperationIntoDeployment(deployment, synthesizedOperation),
        },
        deployment.accountScope,
      );
    }

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

  return await persistDeployment(mergeOperationIntoDeployment(deployment, operation), deployment.accountScope);
}
