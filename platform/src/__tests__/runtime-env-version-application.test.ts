import { beforeEach, describe, expect, test, vi } from "vitest";

const getPlatformAccountMock = vi.fn();
const dispatchOrchestrationActionMock = vi.fn();
const loadRuntimeEnvForOrchestrationWithTelegramCompatMock = vi.fn();
const loadAgentConfigMock = vi.fn();
const getStoredOperationStatusMock = vi.fn();
const getAdapterStatusMock = vi.fn();

const documentStore = new Map<string, Record<string, unknown>>();
const updateCalls: Array<{ path: string; data: Record<string, unknown> }> = [];

function makeDocSnapshot(path: string) {
  const data = documentStore.get(path);
  return {
    id: path.split("/").at(-1) ?? path,
    exists: Boolean(data),
    data: () => data,
  };
}

const mockFirestore = {
  doc: vi.fn((path: string) => ({
    get: vi.fn(async () => makeDocSnapshot(path)),
    set: vi.fn(async (data: Record<string, unknown>) => {
      documentStore.set(path, data);
    }),
    update: vi.fn(async (data: Record<string, unknown>) => {
      updateCalls.push({ path, data });
      documentStore.set(path, {
        ...(documentStore.get(path) ?? {}),
        ...data,
      });
    }),
  })),
  collection: vi.fn((path: string) => ({
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn(async () => ({
          docs: [...documentStore.entries()]
            .filter(([documentPath]) => documentPath.startsWith(`${path}/`))
            .map(([documentPath]) => makeDocSnapshot(documentPath)),
        })),
      })),
    })),
  })),
};

vi.mock("firebase-admin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "server-timestamp",
      },
    },
  },
  firestore: {
    FieldValue: {
      serverTimestamp: () => "server-timestamp",
    },
  },
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: vi.fn(() => mockFirestore),
}));

vi.mock("@/lib/platform-account", () => ({
  getPlatformAccount: getPlatformAccountMock,
}));

vi.mock("@/lib/orchestration", () => ({
  dispatchOrchestrationAction: dispatchOrchestrationActionMock,
  getOrchestrationAdapter: vi.fn(() => ({
    name: "aks",
    getStatus: getAdapterStatusMock,
  })),
}));

vi.mock("@/lib/orchestration/firestore-operation-store", () => ({
  firestoreOperationStore: {
    getStatus: getStoredOperationStatusMock,
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/runtime-env/telegram-compat", () => ({
  loadRuntimeEnvForOrchestrationWithTelegramCompat: loadRuntimeEnvForOrchestrationWithTelegramCompatMock,
}));

vi.mock("@/lib/agent-config/service", () => ({
  loadAgentConfig: loadAgentConfigMock,
}));

const deploymentPath = "accounts/account-1/deployments/abra-instance";
const baseRequest = {
  name: "Abra Production",
  environment: "production" as const,
  sourceRef: "main@abc123",
  notes: "existing deployment request",
};
const persistedAksNames = {
  namespace: "abra-prod",
  configMapName: "abra-config",
  secretName: "abra-secret",
  serviceAccountName: "abra-runtime",
  statefulSetName: "abra-statefulset",
  pvcName: "abra-pvc",
  serviceName: "abra-service",
  configRevision: 2,
  podName: "abra-statefulset-0",
  gatewayRoute: "http://abra-service.abra-prod.svc.cluster.local:18789",
};

type SeedOptions = {
  desiredRuntimeEnvVersionId?: string;
  appliedRuntimeEnvVersionId?: string;
  status?: "queued" | "running" | "succeeded" | "failed";
  lastKnownStatus?: "queued" | "running" | "succeeded" | "failed";
  operationId?: string;
  action?: "create" | "update";
};

function seedDeployment({
  desiredRuntimeEnvVersionId,
  appliedRuntimeEnvVersionId,
  status = "succeeded",
  lastKnownStatus = "succeeded",
  operationId = "op-create",
  action = "create",
}: SeedOptions = {}) {
  documentStore.set(deploymentPath, {
    id: "abra-instance",
    accountScope: "account-1",
    requestPayload: {
      request: baseRequest,
      orchestration: {
        requestId: "req-existing",
        action,
        operationId,
        adapter: "aks",
        pollAfterMs: 1500,
        lastKnownStatus,
        lastSyncedAt: "2026-06-11T20:00:00.000Z",
        aksNames: persistedAksNames,
        desiredRuntimeEnvVersionId,
        appliedRuntimeEnvVersionId,
      },
    },
    status,
    errorMessage: null,
    resultUrl: "aks-runtime/abra-prod/abra-statefulset",
    createdAt: "2026-06-11T20:00:00.000Z",
    updatedAt: "2026-06-11T20:00:00.000Z",
  });
}

function buildUpdateOperation(status: "queued" | "running" | "succeeded" | "failed") {
  return {
    operationId: "op-update",
    adapter: "aks",
    action: "update" as const,
    requestId: "req-existing",
    target: {
      accountId: "account-1",
      agentId: null,
      deploymentId: "abra-instance",
    },
    payload: {},
    status,
    createdAt: "2026-06-11T20:05:00.000Z",
    updatedAt: "2026-06-11T20:05:01.000Z",
    completedAt: status === "queued" || status === "running"
      ? null
      : "2026-06-11T20:05:01.000Z",
    pollAfterMs: status === "succeeded" || status === "failed" ? 0 : 1500,
    steps: [],
    error: status === "failed" ? { message: "AKS update failed." } : null,
    result: status === "failed"
      ? null
      : {
          message: status === "succeeded"
            ? "AKS configuration update applied."
            : "AKS configuration update queued.",
          resourceHandle: "aks-runtime/abra-prod/abra-statefulset",
          metadata: {
            aks: {
              ...persistedAksNames,
              configRevision: 3,
            },
          },
        },
  };
}

function persistedOrchestration() {
  const deployment = documentStore.get(deploymentPath);
  const requestPayload = deployment?.requestPayload as { orchestration?: Record<string, unknown> } | undefined;

  return requestPayload?.orchestration;
}

describe("runtime env version application tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documentStore.clear();
    updateCalls.length = 0;
    getPlatformAccountMock.mockResolvedValue({ id: "account-1", name: "Test account" });
    loadRuntimeEnvForOrchestrationWithTelegramCompatMock.mockResolvedValue({
      BUFFER_API_KEY: "buffer-secret",
      TELEGRAM_BOT_TOKEN: "telegram-secret",
      TELEGRAM_HOME_CHANNEL: "@abra-home",
      TELEGRAM_ALLOWED_USERS: "@abra-home",
    });
    loadAgentConfigMock.mockResolvedValue({
      telegramBotToken: "telegram-secret",
      telegramHomeChannel: "@abra-home",
      telegramAllowedUsers: "@abra-home",
    });
    getStoredOperationStatusMock.mockResolvedValue(null);
    getAdapterStatusMock.mockResolvedValue(null);
  });

  test.each(["queued", "running"] as const)(
    "records desired version but preserves prior applied version while update is %s",
    async (status) => {
      seedDeployment({ appliedRuntimeEnvVersionId: "ver-old" });
      dispatchOrchestrationActionMock.mockResolvedValue(buildUpdateOperation(status));
      const { updateCurrentDeploymentRuntimeEnvForUser } = await import("@/lib/deployments");

      const result = await updateCurrentDeploymentRuntimeEnvForUser("user-1", "ver-new");

      expect(result.applied).toBe(false);
      expect(result.status).toBe("applying");
      expect(persistedOrchestration()).toEqual(expect.objectContaining({
        desiredRuntimeEnvVersionId: "ver-new",
        appliedRuntimeEnvVersionId: "ver-old",
        lastKnownStatus: status,
      }));
    },
  );

  test("advances applied version immediately when the update operation succeeds", async () => {
    seedDeployment({ appliedRuntimeEnvVersionId: "ver-old" });
    dispatchOrchestrationActionMock.mockResolvedValue(buildUpdateOperation("succeeded"));
    const { updateCurrentDeploymentRuntimeEnvForUser } = await import("@/lib/deployments");

    const result = await updateCurrentDeploymentRuntimeEnvForUser("user-1", "ver-new");

    expect(result.applied).toBe(true);
    expect(result.status).toBe("live");
    expect(persistedOrchestration()).toEqual(expect.objectContaining({
      desiredRuntimeEnvVersionId: "ver-new",
      appliedRuntimeEnvVersionId: "ver-new",
      lastKnownStatus: "succeeded",
    }));
  });

  test("keeps desired visible and preserves previous applied version when update fails", async () => {
    seedDeployment({ appliedRuntimeEnvVersionId: "ver-old" });
    dispatchOrchestrationActionMock.mockResolvedValue(buildUpdateOperation("failed"));
    const { updateCurrentDeploymentRuntimeEnvForUser } = await import("@/lib/deployments");

    const result = await updateCurrentDeploymentRuntimeEnvForUser("user-1", "ver-new");

    expect(result.applied).toBe(false);
    expect(result.status).toBe("saved");
    expect(persistedOrchestration()).toEqual(expect.objectContaining({
      desiredRuntimeEnvVersionId: "ver-new",
      appliedRuntimeEnvVersionId: "ver-old",
      lastKnownStatus: "failed",
    }));
  });

  test("preserves desired and previous applied version when dispatch throws before an operation is returned", async () => {
    seedDeployment({ appliedRuntimeEnvVersionId: "ver-old" });
    dispatchOrchestrationActionMock.mockRejectedValue(new Error("AKS dispatch failed."));
    const { updateCurrentDeploymentRuntimeEnvForUser } = await import("@/lib/deployments");

    const result = await updateCurrentDeploymentRuntimeEnvForUser("user-1", "ver-new");

    expect(result.applied).toBe(false);
    expect(result.status).toBe("saved");
    expect(result.deployment?.errorMessage).toBe("AKS dispatch failed.");
    expect(persistedOrchestration()).toEqual(expect.objectContaining({
      desiredRuntimeEnvVersionId: "ver-new",
      appliedRuntimeEnvVersionId: "ver-old",
      lastKnownStatus: "failed",
    }));
  });

  test("status sync advances applied version after a queued update later succeeds", async () => {
    seedDeployment({
      desiredRuntimeEnvVersionId: "ver-new",
      appliedRuntimeEnvVersionId: "ver-old",
      status: "running",
      lastKnownStatus: "running",
      operationId: "op-update",
      action: "update",
    });
    getStoredOperationStatusMock.mockResolvedValue(buildUpdateOperation("succeeded"));
    const { syncDeploymentStatusForUser } = await import("@/lib/deployments");

    const result = await syncDeploymentStatusForUser("user-1", "abra-instance");

    expect(result?.orchestration).toEqual(expect.objectContaining({
      desiredRuntimeEnvVersionId: "ver-new",
      appliedRuntimeEnvVersionId: "ver-new",
      lastKnownStatus: "succeeded",
    }));
    expect(persistedOrchestration()).toEqual(expect.objectContaining({
      desiredRuntimeEnvVersionId: "ver-new",
      appliedRuntimeEnvVersionId: "ver-new",
      lastKnownStatus: "succeeded",
    }));
  });
});
