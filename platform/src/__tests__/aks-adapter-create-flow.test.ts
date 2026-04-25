import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/orchestration/firestore-operation-store", () => ({
  firestoreOperationStore: {
    create: vi.fn(),
    update: vi.fn(),
    getStatus: vi.fn(),
  },
}));

import { AksOrchestrationAdapter } from "@/lib/orchestration/aks-adapter";
import type {
  OrchestrationOperation,
  OrchestrationOperationInput,
} from "@/lib/orchestration/types";

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
}

function createInput(overrides: Partial<OrchestrationOperationInput> = {}): OrchestrationOperationInput {
  return {
    requestId: "request-1",
    target: {
      accountId: "account-1",
      agentId: null,
      deploymentId: "deployment-1",
    },
    payload: {
      name: "Abra runtime",
      image: "ghcr.io/abra/runtime:latest",
    },
    ...overrides,
  };
}

describe("AksOrchestrationAdapter create flow", () => {
  let store: InMemoryOperationStore;
  let nowIndex: number;

  beforeEach(() => {
    store = new InMemoryOperationStore();
    nowIndex = 0;
  });

  function nextTimestamp() {
    const minute = String(nowIndex++).padStart(2, "0");
    return `2026-04-24T12:${minute}:00.000Z`;
  }

  it("persists a queued create operation with a stable runtime handle", async () => {
    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-create-1",
    });

    const operation = await adapter.create(createInput());
    const persisted = await store.getStatus("op-create-1");

    expect(operation.status).toBe("queued");
    expect(operation.result?.resourceHandle).toBe(
      "aks-runtime/abra/abra-account-1-deployment-1"
    );
    expect(operation.runtimeMetadata?.aks).toEqual(
      expect.objectContaining({
        namespace: "abra",
        statefulSetName: "abra-account-1-deployment-1",
        pvcName: "abra-account-1-deployment-1-data",
        serviceName: "abra-account-1-deployment-1-svc",
      })
    );
    expect(operation.runtimeMetadata?.createFlow).toEqual({
      phase: "create_created",
      order: ["storage", "service", "workload"],
      createdResources: {
        service: false,
        workload: false,
      },
    });
    expect(persisted?.operationId).toBe("op-create-1");
  });

  it("advances create-created operations through storage, service, workload, and readiness", async () => {
    const callOrder: string[] = [];
    let readinessChecks = 0;

    const resourceClient = {
      ensurePersistentVolumeClaim: vi.fn(async () => {
        callOrder.push("storage");
        return "created" as const;
      }),
      ensureService: vi.fn(async () => {
        callOrder.push("service");
        return "created" as const;
      }),
      ensureStatefulSet: vi.fn(async () => {
        callOrder.push("workload");
        return "created" as const;
      }),
      readStatefulSet: vi.fn(async () => ({
        status: {
          readyReplicas: readinessChecks >= 1 ? 1 : 0,
          replicas: 1,
        },
      })),
      readPodReadiness: vi.fn(async () => {
        readinessChecks += 1;
        return readinessChecks >= 2
          ? { found: true, ready: true, phase: "Running" }
          : {
              found: true,
              ready: false,
              phase: "Running",
              message: "Waiting for hydrated runtime readiness.",
            };
      }),
      patchStatefulSet: vi.fn(async () => undefined),
      deleteStatefulSet: vi.fn(async () => undefined),
      deleteService: vi.fn(async () => undefined),
      deletePersistentVolumeClaim: vi.fn(async () => undefined),
    };

    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-create-2",
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });

    const created = await adapter.create(createInput());
    const afterStorage = await adapter.getStatus(created.operationId);
    const afterService = await adapter.getStatus(created.operationId);
    const afterWorkload = await adapter.getStatus(created.operationId);
    const waiting = await adapter.getStatus(created.operationId);
    const succeeded = await adapter.getStatus(created.operationId);

    expect(callOrder).toEqual(["storage", "service", "workload"]);
    expect(afterStorage?.status).toBe("running");
    expect(afterStorage?.runtimeMetadata?.createFlow).toEqual(
      expect.objectContaining({ phase: "storage_reconciled" })
    );
    expect(afterService?.runtimeMetadata?.createFlow).toEqual(
      expect.objectContaining({
        phase: "service_reconciled",
        createdResources: { service: true, workload: false },
      })
    );
    expect(afterWorkload?.runtimeMetadata?.createFlow).toEqual(
      expect.objectContaining({
        phase: "workload_reconciled",
        createdResources: { service: true, workload: true },
      })
    );
    expect(waiting?.status).toBe("running");
    expect(waiting?.runtimeMetadata?.createFlow).toEqual(
      expect.objectContaining({ phase: "waiting_for_readiness" })
    );
    expect(succeeded?.status).toBe("succeeded");
    expect(succeeded?.completedAt).toBe("2026-04-24T12:05:00.000Z");
    expect(succeeded?.result?.resourceHandle).toBe(created.result?.resourceHandle);
    expect(succeeded?.result?.metadata?.aks).toEqual(
      expect.objectContaining({
        podName: "abra-account-1-deployment-1-0",
        gatewayRoute: "http://abra-account-1-deployment-1-svc.abra.svc.cluster.local:3000",
      })
    );
  });

  it("fails and cleans up created service and workload when readiness becomes fatal", async () => {
    const resourceClient = {
      ensurePersistentVolumeClaim: vi.fn(async () => "created" as const),
      ensureService: vi.fn(async () => "created" as const),
      ensureStatefulSet: vi.fn(async () => "created" as const),
      readStatefulSet: vi.fn(async () => ({
        status: {
          readyReplicas: 0,
          replicas: 1,
        },
      })),
      readPodReadiness: vi.fn(async () => ({
        found: true,
        ready: false,
        phase: "Pending",
        fatalReason: "CrashLoopBackOff",
      })),
      patchStatefulSet: vi.fn(async () => undefined),
      deleteStatefulSet: vi.fn(async () => undefined),
      deleteService: vi.fn(async () => undefined),
      deletePersistentVolumeClaim: vi.fn(async () => undefined),
    };

    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-create-3",
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });

    const created = await adapter.create(createInput());
    await adapter.getStatus(created.operationId);
    await adapter.getStatus(created.operationId);
    await adapter.getStatus(created.operationId);
    const failed = await adapter.getStatus(created.operationId);

    expect(failed?.status).toBe("failed");
    expect(failed?.error).toEqual(
      expect.objectContaining({
        code: "AKS_CREATE_RECONCILE_FAILED",
        message: "Runtime failed before readiness: CrashLoopBackOff.",
      })
    );
    expect(resourceClient.deleteStatefulSet).toHaveBeenCalledWith(
      "abra",
      "abra-account-1-deployment-1"
    );
    expect(resourceClient.deleteService).toHaveBeenCalledWith(
      "abra",
      "abra-account-1-deployment-1-svc"
    );
  });

  it("rejects create requests that do not resolve a runtime image", async () => {
    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-create-4",
    });

    await expect(
      adapter.create(
        createInput({
          payload: {
            name: "Abra runtime",
          },
        })
      )
    ).rejects.toThrow(
      "AKS create requires a runtime image. Provide payload.image or set AKS_RUNTIME_IMAGE."
    );
  });

  it("increments config revision and patches the StatefulSet during update", async () => {
    const resourceClient = {
      ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
      ensureService: vi.fn(async () => "existing" as const),
      ensureStatefulSet: vi.fn(async () => "existing" as const),
      readStatefulSet: vi.fn(async () => ({ status: { readyReplicas: 1, replicas: 1 } })),
      readPodReadiness: vi.fn(async () => ({ found: true, ready: true, phase: "Running" })),
      patchStatefulSet: vi.fn(async () => undefined),
      deleteStatefulSet: vi.fn(async () => undefined),
      deleteService: vi.fn(async () => undefined),
      deletePersistentVolumeClaim: vi.fn(async () => undefined),
    };

    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-update-1",
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });

    const operation = await adapter.update(
      createInput({
        requestId: "request-update-1",
        payload: {
          name: "Abra runtime",
          image: "ghcr.io/abra/runtime:latest",
          configRevision: 4,
        },
      })
    );

    expect(operation.status).toBe("succeeded");
    expect(operation.completedAt).toBe("2026-04-24T12:02:00.000Z");
    expect(operation.result?.message).toBe("AKS configuration update applied.");
    expect(operation.result?.metadata?.aks).toEqual(
      expect.objectContaining({
        configRevision: 5,
      })
    );
    expect(operation.steps.map((step) => step.summary)).toEqual([
      "AKS update request persisted. Config revision reconciliation will start immediately.",
      "Reconciling StatefulSet for config revision 5.",
      "Config revision 5 reconciled and StatefulSet rollout triggered.",
    ]);
    expect(resourceClient.patchStatefulSet).toHaveBeenCalledWith(
      "abra",
      "abra-account-1-deployment-1",
      expect.objectContaining({
        spec: {
          template: {
            metadata: {
              annotations: expect.objectContaining({
                "abra.io/config-revision": "5",
                "abra.io/restarted-at": "2026-04-24T12:01:00.000Z",
              }),
            },
          },
        },
      })
    );
  });

  it("patches the StatefulSet for restart without deleting the PVC", async () => {
    const resourceClient = {
      ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
      ensureService: vi.fn(async () => "existing" as const),
      ensureStatefulSet: vi.fn(async () => "existing" as const),
      readStatefulSet: vi.fn(async () => ({ status: { readyReplicas: 1, replicas: 1 } })),
      readPodReadiness: vi.fn(async () => ({ found: true, ready: true, phase: "Running" })),
      patchStatefulSet: vi.fn(async () => undefined),
      deleteStatefulSet: vi.fn(async () => undefined),
      deleteService: vi.fn(async () => undefined),
      deletePersistentVolumeClaim: vi.fn(async () => undefined),
    };

    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-restart-1",
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });

    const operation = await adapter.restart(
      createInput({
        requestId: "request-restart-1",
        payload: {
          name: "Abra runtime",
          image: "ghcr.io/abra/runtime:latest",
          configRevision: 2,
        },
      })
    );

    expect(operation.status).toBe("succeeded");
    expect(operation.result?.message).toBe("AKS runtime restarted.");
    expect(operation.runtimeMetadata).toEqual(
      expect.objectContaining({
        actionPhase: "restart_reconciled",
        pvcRetained: true,
      })
    );
    expect(resourceClient.patchStatefulSet).toHaveBeenCalledWith(
      "abra",
      "abra-account-1-deployment-1",
      expect.objectContaining({
        spec: {
          template: {
            metadata: {
              annotations: {
                "kubectl.kubernetes.io/restartedAt": "2026-04-24T12:01:00.000Z",
              },
            },
          },
        },
      })
    );
    expect(resourceClient.deletePersistentVolumeClaim).not.toHaveBeenCalled();
  });

  it("destroys compute resources and retains the PVC by default", async () => {
    const previousRetention = process.env.AKS_PVC_RETENTION_DAYS;
    delete process.env.AKS_PVC_RETENTION_DAYS;

    const resourceClient = {
      ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
      ensureService: vi.fn(async () => "existing" as const),
      ensureStatefulSet: vi.fn(async () => "existing" as const),
      readStatefulSet: vi.fn(async () => ({ status: { readyReplicas: 1, replicas: 1 } })),
      readPodReadiness: vi.fn(async () => ({ found: true, ready: true, phase: "Running" })),
      patchStatefulSet: vi.fn(async () => undefined),
      deleteStatefulSet: vi.fn(async () => undefined),
      deleteService: vi.fn(async () => undefined),
      deletePersistentVolumeClaim: vi.fn(async () => undefined),
    };

    try {
      const adapter = new AksOrchestrationAdapter({
        operationStore: store as never,
        now: nextTimestamp,
        createOperationId: () => "op-destroy-1",
        loadKubernetesClient: vi.fn(async () => ({}) as never),
        createResourceClient: vi.fn(() => resourceClient),
      });

      const operation = await adapter.destroy(
        createInput({
          requestId: "request-destroy-1",
          payload: {
            name: "Abra runtime",
          },
        })
      );

      expect(operation.status).toBe("succeeded");
      expect(operation.result?.message).toBe("AKS runtime destroyed. Persistent storage retained.");
      expect(operation.runtimeMetadata).toEqual(
        expect.objectContaining({
          actionPhase: "destroy_reconciled",
          pvcRetentionDays: 7,
          pvcRetained: true,
          pvcDeleteAfter: "2026-05-01T12:01:00.000Z",
        })
      );
      expect(resourceClient.deleteStatefulSet).toHaveBeenCalledWith(
        "abra",
        "abra-account-1-deployment-1"
      );
      expect(resourceClient.deleteService).toHaveBeenCalledWith(
        "abra",
        "abra-account-1-deployment-1-svc"
      );
      expect(resourceClient.deletePersistentVolumeClaim).not.toHaveBeenCalled();
    } finally {
      if (previousRetention === undefined) {
        delete process.env.AKS_PVC_RETENTION_DAYS;
      } else {
        process.env.AKS_PVC_RETENTION_DAYS = previousRetention;
      }
    }
  });

  it("deletes the PVC during destroy when retention is disabled", async () => {
    const previousRetention = process.env.AKS_PVC_RETENTION_DAYS;
    process.env.AKS_PVC_RETENTION_DAYS = "0";

    const resourceClient = {
      ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
      ensureService: vi.fn(async () => "existing" as const),
      ensureStatefulSet: vi.fn(async () => "existing" as const),
      readStatefulSet: vi.fn(async () => ({ status: { readyReplicas: 1, replicas: 1 } })),
      readPodReadiness: vi.fn(async () => ({ found: true, ready: true, phase: "Running" })),
      patchStatefulSet: vi.fn(async () => undefined),
      deleteStatefulSet: vi.fn(async () => undefined),
      deleteService: vi.fn(async () => undefined),
      deletePersistentVolumeClaim: vi.fn(async () => undefined),
    };

    try {
      const adapter = new AksOrchestrationAdapter({
        operationStore: store as never,
        now: nextTimestamp,
        createOperationId: () => "op-destroy-2",
        loadKubernetesClient: vi.fn(async () => ({}) as never),
        createResourceClient: vi.fn(() => resourceClient),
      });

      const operation = await adapter.destroy(
        createInput({
          requestId: "request-destroy-2",
          payload: {
            name: "Abra runtime",
          },
        })
      );

      expect(operation.status).toBe("succeeded");
      expect(operation.result?.message).toBe("AKS runtime destroyed and persistent storage deleted.");
      expect(resourceClient.deletePersistentVolumeClaim).toHaveBeenCalledWith(
        "abra",
        "abra-account-1-deployment-1-data"
      );
    } finally {
      if (previousRetention === undefined) {
        delete process.env.AKS_PVC_RETENTION_DAYS;
      } else {
        process.env.AKS_PVC_RETENTION_DAYS = previousRetention;
      }
    }
  });
});
