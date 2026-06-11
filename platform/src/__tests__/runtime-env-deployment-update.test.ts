import { beforeEach, describe, expect, test, vi } from "vitest";

const getPlatformAccountMock = vi.fn();
const dispatchOrchestrationActionMock = vi.fn();
const loadRuntimeEnvForOrchestrationWithTelegramCompatMock = vi.fn();
const loadAgentConfigMock = vi.fn();
const requireApiAuthMock = vi.fn();
const loadRuntimeEnvSummaryMock = vi.fn();

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
  runTransaction: vi.fn(),
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
  getOrchestrationAdapter: vi.fn(),
}));

vi.mock("@/lib/runtime-env/telegram-compat", () => ({
  loadRuntimeEnvForOrchestrationWithTelegramCompat: loadRuntimeEnvForOrchestrationWithTelegramCompatMock,
}));

vi.mock("@/lib/agent-config/service", () => ({
  loadAgentConfig: loadAgentConfigMock,
}));

vi.mock("@/lib/auth", () => ({
  requireApiAuth: requireApiAuthMock,
}));

vi.mock("@/lib/runtime-env/service", () => ({
  loadRuntimeEnvSummary: loadRuntimeEnvSummaryMock,
  deleteRuntimeEnvKey: vi.fn(),
  rollbackRuntimeEnvVersion: vi.fn(),
  saveRuntimeEnvFields: vi.fn(),
  saveRuntimeEnvImport: vi.fn(),
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

function seedDeployment(overrides: Record<string, unknown> = {}) {
  documentStore.set(deploymentPath, {
    id: "abra-instance",
    accountScope: "account-1",
    requestPayload: {
      request: baseRequest,
      orchestration: {
        requestId: "req-existing",
        action: "create",
        operationId: "op-create",
        adapter: "aks",
        pollAfterMs: 1500,
        lastKnownStatus: "succeeded",
        lastSyncedAt: "2026-06-11T20:00:00.000Z",
        aksNames: persistedAksNames,
      },
    },
    status: "succeeded",
    errorMessage: null,
    resultUrl: "aks-runtime/abra-prod/abra-statefulset",
    createdAt: "2026-06-11T20:00:00.000Z",
    updatedAt: "2026-06-11T20:00:00.000Z",
    ...overrides,
  });
}

describe("runtime env deployment update", () => {
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
    dispatchOrchestrationActionMock.mockResolvedValue({
      operationId: "op-update",
      adapter: "aks",
      action: "update",
      requestId: "req-existing",
      target: {
        accountId: "account-1",
        agentId: null,
        deploymentId: "abra-instance",
      },
      payload: {},
      status: "succeeded",
      createdAt: "2026-06-11T20:05:00.000Z",
      updatedAt: "2026-06-11T20:05:01.000Z",
      completedAt: "2026-06-11T20:05:01.000Z",
      pollAfterMs: 0,
      steps: [],
      error: null,
      result: {
        message: "AKS configuration update applied.",
        resourceHandle: "aks-runtime/abra-prod/abra-statefulset",
        metadata: {
          aks: {
            ...persistedAksNames,
            configRevision: 3,
          },
        },
      },
    });
    requireApiAuthMock.mockResolvedValue({ user: { id: "user-1" } });
    loadRuntimeEnvSummaryMock.mockResolvedValue({
      accountScope: "user-1",
      versionId: "ver-runtime-1",
      createdAt: "2026-06-11T20:04:00.000Z",
      updatedAt: "2026-06-11T20:04:00.000Z",
      values: [],
    });
  });

  test("dispatches update with persisted AKS names, existing request data, config revision, agent config, and runtime env", async () => {
    seedDeployment();
    const { updateCurrentDeploymentRuntimeEnvForUser } = await import("@/lib/deployments");

    const result = await updateCurrentDeploymentRuntimeEnvForUser("user-1", "ver-runtime-1");

    expect(result.applied).toBe(true);
    expect(dispatchOrchestrationActionMock).toHaveBeenCalledTimes(1);
    expect(dispatchOrchestrationActionMock).toHaveBeenCalledWith("update", {
      requestId: "req-existing",
      target: {
        accountId: "account-1",
        agentId: null,
        deploymentId: "abra-instance",
      },
      payload: expect.objectContaining({
        ...baseRequest,
        aksNames: persistedAksNames,
        configRevision: 2,
        agentConfig: {
          telegramBotToken: "telegram-secret",
          telegramHomeChannel: "@abra-home",
          telegramAllowedUsers: "@abra-home",
        },
        runtimeEnv: {
          BUFFER_API_KEY: "buffer-secret",
          TELEGRAM_BOT_TOKEN: "telegram-secret",
          TELEGRAM_HOME_CHANNEL: "@abra-home",
          TELEGRAM_ALLOWED_USERS: "@abra-home",
        },
      }),
    });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].path).toBe(deploymentPath);
    expect(updateCalls[0].data.status).toBe("succeeded");
    expect(updateCalls[0].data.requestPayload).toEqual({
      request: baseRequest,
      orchestration: expect.objectContaining({
        requestId: "req-existing",
        action: "update",
        operationId: "op-update",
        adapter: "aks",
        lastKnownStatus: "succeeded",
        aksNames: expect.objectContaining({ configRevision: 3 }),
      }),
    });
  });

  test("reports no deployment as saved but unapplied without dispatching", async () => {
    const { updateCurrentDeploymentRuntimeEnvForUser } = await import("@/lib/deployments");

    const result = await updateCurrentDeploymentRuntimeEnvForUser("user-1");

    expect(result).toEqual({
      applied: false,
      status: "saved",
      reason: "No runtime deployed",
      deployment: null,
      warning: null,
    });
    expect(dispatchOrchestrationActionMock).not.toHaveBeenCalled();
    expect(loadRuntimeEnvForOrchestrationWithTelegramCompatMock).not.toHaveBeenCalled();
  });

  test("does not dispatch when the current deployment is missing AKS metadata", async () => {
    seedDeployment({
      requestPayload: {
        request: baseRequest,
        orchestration: {
          requestId: "req-existing",
          action: "create",
          operationId: "op-create",
          adapter: "aks",
          pollAfterMs: 1500,
          lastKnownStatus: "succeeded",
          lastSyncedAt: "2026-06-11T20:00:00.000Z",
        },
      },
    });
    const { updateCurrentDeploymentRuntimeEnvForUser } = await import("@/lib/deployments");

    const result = await updateCurrentDeploymentRuntimeEnvForUser("user-1");

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("Runtime deployment metadata is missing");
    expect(result.deployment?.id).toBe("abra-instance");
    expect(dispatchOrchestrationActionMock).not.toHaveBeenCalled();
    expect(loadRuntimeEnvForOrchestrationWithTelegramCompatMock).not.toHaveBeenCalled();
  });

  test("applyRuntimeEnvAction delegates to deployment update and returns product-safe applied status", async () => {
    seedDeployment();
    const { applyRuntimeEnvAction } = await import("@/lib/runtime-env/actions");

    const result = await applyRuntimeEnvAction();

    expect(loadRuntimeEnvSummaryMock).toHaveBeenCalledWith("user-1");
    expect(dispatchOrchestrationActionMock).toHaveBeenCalledWith("update", expect.any(Object));
    expect(result).toEqual({
      success: true,
      applied: true,
      status: "live",
      message: "Runtime environment values are live on Abra.",
      summary: expect.objectContaining({ versionId: "ver-runtime-1" }),
      error: null,
    });
    expect(JSON.stringify(result)).not.toContain("telegram-secret");
    expect(JSON.stringify(result)).not.toContain("buffer-secret");
  });
});
