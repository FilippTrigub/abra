import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AksOrchestrationAdapter } from "@/lib/orchestration/aks-adapter";
import type {
  OrchestrationAction,
  OrchestrationOperation,
  OrchestrationOperationInput,
} from "@/lib/orchestration/types";

const requireApiAuthMock = vi.fn();
const getPlatformAccountMock = vi.fn();
const loadAgentConfigMock = vi.fn();
const dispatchOrchestrationActionMock = vi.fn();

type StoredDoc = Record<string, unknown>;
type FirestoreSetOptions = { merge?: boolean };

const documentStore = new Map<string, StoredDoc>();
const updateCalls: Array<{ path: string; data: StoredDoc }> = [];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeDocSnapshot(path: string) {
  const data = documentStore.get(path);

  return {
    id: path.split("/").at(-1) ?? path,
    exists: Boolean(data),
    data: () => (data ? clone(data) : undefined),
  };
}

const mockFirestore = {
  doc: vi.fn((path: string) => ({
    get: vi.fn(async () => makeDocSnapshot(path)),
    set: vi.fn(async (data: StoredDoc, options?: FirestoreSetOptions) => {
      const next = clone(data);
      documentStore.set(path, options?.merge ? { ...(documentStore.get(path) ?? {}), ...next } : next);
    }),
    update: vi.fn(async (data: StoredDoc) => {
      const next = clone(data);
      updateCalls.push({ path, data: next });
      documentStore.set(path, {
        ...(documentStore.get(path) ?? {}),
        ...next,
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

vi.mock("@/lib/auth", () => ({
  requireApiAuth: requireApiAuthMock,
}));

vi.mock("@/lib/platform-account", () => ({
  getPlatformAccount: getPlatformAccountMock,
}));

vi.mock("@/lib/agent-config/service", () => ({
  loadAgentConfig: loadAgentConfigMock,
}));

vi.mock("@/lib/orchestration", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orchestration")>();

  return {
    ...actual,
    dispatchOrchestrationAction: dispatchOrchestrationActionMock,
    getOrchestrationAdapter: vi.fn(),
  };
});

class InMemoryOperationStore {
  private readonly records = new Map<string, OrchestrationOperation>();

  async create(operation: OrchestrationOperation) {
    this.records.set(operation.operationId, operation);
    return operation;
  }

  async update(operation: OrchestrationOperation) {
    this.records.set(operation.operationId, operation);
    return operation;
  }

  async getStatus(operationId: string) {
    return this.records.get(operationId) ?? null;
  }

  all() {
    return [...this.records.values()];
  }
}

function createResourceClient() {
  return {
    ensureNamespace: vi.fn(async () => "existing" as const),
    ensureServiceAccount: vi.fn(async () => "existing" as const),
    ensureConfigMap: vi.fn(async () => "existing" as const),
    ensureSecret: vi.fn(async () => "existing" as const),
    patchConfigMap: vi.fn(async () => undefined),
    patchSecret: vi.fn(async () => undefined),
    ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
    ensureService: vi.fn(async () => "existing" as const),
    ensureStatefulSet: vi.fn(async () => "existing" as const),
    readStatefulSet: vi.fn(async () => ({ status: { readyReplicas: 1, replicas: 1 } })),
    readPodReadiness: vi.fn(async () => ({ found: true, ready: true, phase: "Running" })),
    patchStatefulSet: vi.fn(async () => undefined),
    deleteStatefulSet: vi.fn(async () => undefined),
    deleteService: vi.fn(async () => undefined),
    deleteConfigMap: vi.fn(async () => undefined),
    deleteSecret: vi.fn(async () => undefined),
    deletePersistentVolumeClaim: vi.fn(async () => undefined),
  };
}

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

let operationStore: InMemoryOperationStore;
let resourceClient: ReturnType<typeof createResourceClient>;
let adapter: AksOrchestrationAdapter;
let nowIndex = 0;

function nextTimestamp() {
  const minute = String(nowIndex++).padStart(2, "0");
  return `2026-06-11T21:${minute}:00.000Z`;
}

function seedDeployment(overrides: StoredDoc = {}) {
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

function installAksDispatch() {
  dispatchOrchestrationActionMock.mockImplementation(
    async (action: OrchestrationAction, input: OrchestrationOperationInput) => {
      switch (action) {
        case "create":
          return adapter.create(input);
        case "update":
          return adapter.update(input);
        case "restart":
          return adapter.restart(input);
        case "destroy":
          return adapter.destroy(input);
      }
    },
  );
}

function getLastPatchedSecret() {
  const call = resourceClient.patchSecret.mock.calls.at(-1) as unknown[] | undefined;
  expect(call).toBeDefined();
  return call?.[2] as { stringData: Record<string, string> };
}

function getLastPatchedStatefulSetEnv() {
  const call = resourceClient.patchStatefulSet.mock.calls.at(-1) as unknown[] | undefined;
  expect(call).toBeDefined();
  const patch = call?.[2] as {
    spec: { template: { spec: { containers: Array<{ env?: unknown[] }> } } };
  };
  return patch.spec.template.spec.containers[0].env ?? [];
}

function expectSecretKeyRef(env: unknown[], key: string) {
  expect(env).toContainEqual({
    name: key,
    valueFrom: {
      secretKeyRef: {
        name: persistedAksNames.secretName,
        key,
      },
    },
  });
}

function expectNoPlaintextReturned(result: unknown, plaintextValues: string[]) {
  const serialized = JSON.stringify(result);
  for (const value of plaintextValues) {
    expect(serialized).not.toContain(value);
  }
}

describe("runtime env save/import to AKS integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RUNTIME_ENV_ENCRYPTION_KEY", Buffer.alloc(32, 17).toString("base64"));
    vi.stubEnv("AKS_RUNTIME_IMAGE", "ghcr.io/abra/runtime:test");
    documentStore.clear();
    updateCalls.length = 0;
    nowIndex = 0;
    operationStore = new InMemoryOperationStore();
    resourceClient = createResourceClient();
    adapter = new AksOrchestrationAdapter({
      operationStore: operationStore as never,
      now: nextTimestamp,
      createOperationId: () => `op-update-${operationStore.all().length + 1}`,
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });
    requireApiAuthMock.mockResolvedValue({ user: { id: "user-1" } });
    getPlatformAccountMock.mockResolvedValue({ id: "account-1", name: "Test account" });
    loadAgentConfigMock.mockResolvedValue(null);
    installAksDispatch();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("manual field save persists through service/action/deployment update into AKS Secret and StatefulSet patches", async () => {
    seedDeployment();
    const { saveRuntimeEnvFieldsAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvFieldsAction({
      values: {
        BUFFER_API_KEY: "buf_field_secret",
      },
    });

    const secretPatch = getLastPatchedSecret();
    const env = getLastPatchedStatefulSetEnv();
    const persistedOperation = operationStore.all().at(-1);

    expect(result.success).toBe(true);
    expect(dispatchOrchestrationActionMock).toHaveBeenCalledTimes(1);
    expect(secretPatch.stringData.env).toContain("BUFFER_API_KEY=buf_field_secret");
    expect(secretPatch.stringData.BUFFER_API_KEY).toBe("buf_field_secret");
    expectSecretKeyRef(env, "BUFFER_API_KEY");
    expect(persistedOperation?.payload).toEqual(expect.objectContaining({ runtimeEnvRef: "account-current" }));
    expect(JSON.stringify(persistedOperation?.payload)).not.toContain("buf_field_secret");
    expectNoPlaintextReturned(result, ["buf_field_secret"]);
  });

  test("dotenv import only applies accepted keys to generated Secret and StatefulSet patches", async () => {
    seedDeployment();
    const { saveRuntimeEnvImportAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvImportAction(`
BUFFER_API_KEY=buf_import_secret
RANDOM_SECRET=random_plain_secret
KUBECONFIG_B64=reserved_plain_secret
FAL_API_KEY=fal_import_secret
`);

    const secretPatch = getLastPatchedSecret();
    const env = getLastPatchedStatefulSetEnv();

    expect(result.success).toBe(true);
    expect(result.accepted.map((entry) => entry.key)).toEqual(["BUFFER_API_KEY", "FAL_API_KEY"]);
    expect(result.rejected).toEqual([
      expect.objectContaining({ code: "unknown-key", key: "RANDOM_SECRET" }),
      expect.objectContaining({ code: "reserved-key", key: "KUBECONFIG_B64" }),
    ]);
    expect(secretPatch.stringData.env).toContain("BUFFER_API_KEY=buf_import_secret");
    expect(secretPatch.stringData.env).toContain("FAL_API_KEY=fal_import_secret");
    expect(secretPatch.stringData.env).not.toContain("RANDOM_SECRET");
    expect(secretPatch.stringData.env).not.toContain("KUBECONFIG_B64");
    expect(secretPatch.stringData.BUFFER_API_KEY).toBe("buf_import_secret");
    expect(secretPatch.stringData.FAL_API_KEY).toBe("fal_import_secret");
    expect(secretPatch.stringData).not.toHaveProperty("RANDOM_SECRET");
    expect(secretPatch.stringData).not.toHaveProperty("KUBECONFIG_B64");
    expectSecretKeyRef(env, "BUFFER_API_KEY");
    expectSecretKeyRef(env, "FAL_API_KEY");
    expectNoPlaintextReturned(result, [
      "buf_import_secret",
      "fal_import_secret",
      "random_plain_secret",
      "reserved_plain_secret",
    ]);
  });

  test("save without a deployed runtime remains non-fatal and does not dispatch AKS updates", async () => {
    const { saveRuntimeEnvFieldsAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvFieldsAction({
      values: {
        BUFFER_API_KEY: "buf_saved_only_secret",
      },
    });

    expect(result.success).toBe(true);
    expect(dispatchOrchestrationActionMock).not.toHaveBeenCalled();
    expect(resourceClient.patchSecret).not.toHaveBeenCalled();
    expect(resourceClient.patchStatefulSet).not.toHaveBeenCalled();
    expectNoPlaintextReturned(result, ["buf_saved_only_secret"]);
  });

  test("legacy Telegram config fills missing Telegram runtime env keys before AKS update", async () => {
    seedDeployment();
    loadAgentConfigMock.mockResolvedValue({
      telegramBotToken: "telegram_old_token",
      telegramHomeChannel: "@abra-old-home",
      telegramAllowedUsers: "@abra-old-user",
    });
    const { saveRuntimeEnvFieldsAction } = await import("@/lib/runtime-env/actions");

    const result = await saveRuntimeEnvFieldsAction({
      values: {
        BUFFER_API_KEY: "buf_with_telegram_secret",
      },
    });

    const dispatchedInput = dispatchOrchestrationActionMock.mock.calls[0][1] as OrchestrationOperationInput;
    const secretPatch = getLastPatchedSecret();
    const env = getLastPatchedStatefulSetEnv();

    expect(result.success).toBe(true);
    expect(dispatchedInput.payload.runtimeEnv).toEqual(expect.objectContaining({
      BUFFER_API_KEY: "buf_with_telegram_secret",
      TELEGRAM_BOT_TOKEN: "telegram_old_token",
      TELEGRAM_HOME_CHANNEL: "@abra-old-home",
      TELEGRAM_ALLOWED_USERS: "@abra-old-user",
    }));
    expect(secretPatch.stringData.env).toContain("TELEGRAM_BOT_TOKEN=telegram_old_token");
    expect(secretPatch.stringData.env).toContain("TELEGRAM_HOME_CHANNEL=@abra-old-home");
    expect(secretPatch.stringData.env).toContain("TELEGRAM_ALLOWED_USERS=@abra-old-user");
    expectSecretKeyRef(env, "TELEGRAM_BOT_TOKEN");
    expectSecretKeyRef(env, "TELEGRAM_HOME_CHANNEL");
    expectSecretKeyRef(env, "TELEGRAM_ALLOWED_USERS");
    expectNoPlaintextReturned(result, [
      "buf_with_telegram_secret",
      "telegram_old_token",
      "@abra-old-home",
      "@abra-old-user",
    ]);
  });
});
