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

function createResourceClient(overrides: Record<string, unknown> = {}) {
  return {
    ensureNamespace: vi.fn(async () => "created" as const),
    ensureServiceAccount: vi.fn(async () => "created" as const),
    ensureConfigMap: vi.fn(async () => "created" as const),
    ensureSecret: vi.fn(async () => "created" as const),
    patchConfigMap: vi.fn(async () => undefined),
    patchSecret: vi.fn(async () => undefined),
    ensurePersistentVolumeClaim: vi.fn(async () => "created" as const),
    ensureService: vi.fn(async () => "created" as const),
    ensureStatefulSet: vi.fn(async () => "created" as const),
    readStatefulSet: vi.fn(async () => ({ status: { readyReplicas: 1, replicas: 1 } })),
    readPodReadiness: vi.fn(async () => ({ found: true, ready: true, phase: "Running" })),
    patchStatefulSet: vi.fn(async () => undefined),
    deleteStatefulSet: vi.fn(async () => undefined),
    deleteService: vi.fn(async () => undefined),
    deleteConfigMap: vi.fn(async () => undefined),
    deleteSecret: vi.fn(async () => undefined),
    deletePersistentVolumeClaim: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("AksOrchestrationAdapter create flow", () => {
  let store: InMemoryOperationStore;
  let nowIndex: number;

  beforeEach(() => {
    store = new InMemoryOperationStore();
    nowIndex = 0;
    delete process.env.AZURE_FOUNDRY_API_KEY;
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
    expect(operation.payload.agentConfig).toBeUndefined();
    expect(operation.result?.resourceHandle).toBe(
      "aks-runtime/abra/abra-account-1-deployment-1"
    );
    expect(operation.runtimeMetadata?.aks).toEqual(
      expect.objectContaining({
        namespace: "abra",
        configMapName: "abra-account-1-deployment-1-config",
        secretName: "abra-account-1-deployment-1-secrets",
        statefulSetName: "abra-account-1-deployment-1",
        pvcName: "abra-account-1-deployment-1-data",
        serviceName: "abra-account-1-deployment-1-svc",
      })
    );
    expect(operation.runtimeMetadata?.createFlow).toEqual({
      phase: "create_created",
      order: ["storage", "service", "workload"],
      createdResources: {
        configMap: false,
        secret: false,
        service: false,
        workload: false,
      },
    });
    expect(persisted?.operationId).toBe("op-create-1");
  });

  it("advances create-created operations through storage, service, workload, and readiness", async () => {
    const callOrder: string[] = [];
    let readinessChecks = 0;

    const resourceClient = createResourceClient({
      ensureNamespace: vi.fn(async () => {
        callOrder.push("namespace");
        return "created" as const;
      }),
      ensureConfigMap: vi.fn(async () => {
        callOrder.push("config");
        return "created" as const;
      }),
      ensureSecret: vi.fn(async () => {
        callOrder.push("secret");
        return "created" as const;
      }),
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
    });

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

    expect(callOrder).toEqual(["namespace", "config", "secret", "storage", "service", "workload"]);
    expect(afterStorage?.status).toBe("running");
    expect(afterStorage?.runtimeMetadata?.createFlow).toEqual(
      expect.objectContaining({ phase: "storage_reconciled" })
    );
    expect(afterService?.runtimeMetadata?.createFlow).toEqual(
      expect.objectContaining({
        phase: "service_reconciled",
        createdResources: {
          configMap: true,
          secret: true,
          service: true,
          workload: false,
        },
      })
    );
    expect(afterWorkload?.runtimeMetadata?.createFlow).toEqual(
      expect.objectContaining({
        phase: "workload_reconciled",
        createdResources: {
          configMap: true,
          secret: true,
          service: true,
          workload: true,
        },
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
        gatewayRoute: "http://abra-account-1-deployment-1-svc.abra.svc.cluster.local:18789",
      })
    );
  });

  it("fails and cleans up created service and workload when readiness becomes fatal", async () => {
    const resourceClient = createResourceClient({
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
    });

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
    expect(resourceClient.deleteConfigMap).toHaveBeenCalledWith(
      "abra",
      "abra-account-1-deployment-1-config"
    );
    expect(resourceClient.deleteSecret).toHaveBeenCalledWith(
      "abra",
      "abra-account-1-deployment-1-secrets"
    );
  });

  it("reconciles a configured service account before moving past storage", async () => {
    const callOrder: string[] = [];
    const resourceClient = createResourceClient({
      ensureNamespace: vi.fn(async () => {
        callOrder.push("namespace");
        return "created" as const;
      }),
      ensureServiceAccount: vi.fn(async () => {
        callOrder.push("service-account");
        return "created" as const;
      }),
      ensureConfigMap: vi.fn(async () => {
        callOrder.push("config");
        return "created" as const;
      }),
      ensureSecret: vi.fn(async () => {
        callOrder.push("secret");
        return "created" as const;
      }),
      ensurePersistentVolumeClaim: vi.fn(async () => {
        callOrder.push("storage");
        return "created" as const;
      }),
    });

    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-create-sa",
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });

    const created = await adapter.create(
      createInput({
        payload: {
          name: "Abra runtime",
          image: "ghcr.io/abra/runtime:latest",
          useServiceAccount: true,
          serviceAccountName: "abra-runtime-sa",
        },
      })
    );

    const afterStorage = await adapter.getStatus(created.operationId);

    expect(callOrder).toEqual(["namespace", "service-account", "config", "secret", "storage"]);
    expect(afterStorage?.status).toBe("running");
    expect(afterStorage?.runtimeMetadata?.aks).toEqual(
      expect.objectContaining({
        serviceAccountName: "abra-runtime-sa",
      })
    );
    expect(resourceClient.ensureServiceAccount).toHaveBeenCalledWith(
      "abra",
      expect.objectContaining({
        metadata: expect.objectContaining({
          name: "abra-runtime-sa",
        }),
      })
    );
  });

  it("fails durably when runtime configuration reconciliation fails", async () => {
    const resourceClient = createResourceClient({
      ensureConfigMap: vi.fn(async () => {
        throw new Error("config access denied");
      }),
    });

    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-create-config-fail",
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });

    const created = await adapter.create(createInput());
    const failed = await adapter.getStatus(created.operationId);

    expect(failed?.status).toBe("failed");
    expect(failed?.error).toEqual(
      expect.objectContaining({
        code: "AKS_API_ERROR",
        message:
          "Failed to reconcile ConfigMap abra-account-1-deployment-1-config: config access denied",
      })
    );
    expect(resourceClient.deleteStatefulSet).not.toHaveBeenCalled();
    expect(resourceClient.deleteService).not.toHaveBeenCalled();
  });

  it("fails durably when Kubernetes bootstrap is unavailable during queued status polling", async () => {
    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-create-bootstrap-fail",
      loadKubernetesClient: vi.fn(async () => {
        throw new Error("Azure Workload Identity is not configured for Kubernetes bootstrap.");
      }),
    });

    const created = await adapter.create(createInput());
    const failed = await adapter.getStatus(created.operationId);

    expect(failed?.status).toBe("failed");
    expect(failed?.completedAt).toBe("2026-04-24T12:01:00.000Z");
    expect(failed?.pollAfterMs).toBe(0);
    expect(failed?.error).toEqual(
      expect.objectContaining({
        code: "AKS_API_ERROR",
        message: "Azure Workload Identity is not configured for Kubernetes bootstrap.",
      })
    );
    expect(failed?.runtimeMetadata).toEqual(
      expect.objectContaining({
        aks: expect.objectContaining({
          namespace: "abra",
          statefulSetName: "abra-account-1-deployment-1",
        }),
        createFlow: expect.objectContaining({
          phase: "failed",
        }),
      })
    );
    expect(failed?.steps.at(-1)).toEqual(
      expect.objectContaining({
        status: "failed",
        summary: "AKS create flow failed.",
      })
    );
  });

  it("reuses persisted AKS resource names when polling a legacy create operation", async () => {
    const resourceClient = createResourceClient();

    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-create-legacy-names",
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });

    const created = await adapter.create(
      createInput({
        target: {
          accountId: "fjyqatlmasrvefkf0g6lgajz9gv2",
          agentId: null,
          deploymentId: "9ba066b6-8348-4e00-abd3-52e7fcc7e04c",
        },
      })
    );

    const legacyNames = {
      namespace: "abra",
      configMapName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c-config",
      secretName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c-secrets",
      statefulSetName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c",
      pvcName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c-data",
      serviceName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c-svc",
      configRevision: 1,
    };

    await store.update({
      ...created,
      runtimeMetadata: {
        ...created.runtimeMetadata,
        aks: {
          ...created.runtimeMetadata?.aks,
          ...legacyNames,
        },
      },
    });

    await adapter.getStatus(created.operationId);

    expect(resourceClient.ensureConfigMap).toHaveBeenCalledWith(
      "abra",
      expect.objectContaining({
        metadata: expect.objectContaining({
          name: legacyNames.configMapName,
        }),
      })
    );
    expect(resourceClient.ensureSecret).toHaveBeenCalledWith(
      "abra",
      expect.objectContaining({
        metadata: expect.objectContaining({
          name: legacyNames.secretName,
        }),
      })
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

  it("prefers payload.image over AKS_RUNTIME_IMAGE and ABRA_RUNTIME_IMAGE", async () => {
    const originalAksImage = process.env.AKS_RUNTIME_IMAGE;
    const originalAbraImage = process.env.ABRA_RUNTIME_IMAGE;

    process.env.AKS_RUNTIME_IMAGE = "ghcr.io/abra/runtime:aks";
    process.env.ABRA_RUNTIME_IMAGE = "ghcr.io/abra/runtime:legacy";

    try {
      const adapter = new AksOrchestrationAdapter({
        operationStore: store as never,
        now: nextTimestamp,
        createOperationId: () => "op-create-5",
      });

      const operation = await adapter.create(
        createInput({
          payload: {
            name: "Abra runtime",
            image: "ghcr.io/abra/runtime:payload",
          },
        })
      );

      expect(operation.payload.image).toBe("ghcr.io/abra/runtime:payload");
    } finally {
      if (originalAksImage === undefined) {
        delete process.env.AKS_RUNTIME_IMAGE;
      } else {
        process.env.AKS_RUNTIME_IMAGE = originalAksImage;
      }

      if (originalAbraImage === undefined) {
        delete process.env.ABRA_RUNTIME_IMAGE;
      } else {
        process.env.ABRA_RUNTIME_IMAGE = originalAbraImage;
      }
    }
  });

  it("increments config revision and patches the StatefulSet during update", async () => {
    process.env.AZURE_FOUNDRY_API_KEY = "test-azure-key";
    const resourceClient = createResourceClient({
      ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
      ensureService: vi.fn(async () => "existing" as const),
      ensureStatefulSet: vi.fn(async () => "existing" as const),
    });

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
      "Config revision 5 reconciled and StatefulSet rollout triggered with image ghcr.io/abra/runtime:latest.",
    ]);
    expect(resourceClient.patchConfigMap).toHaveBeenCalledWith(
      "abra",
      "abra-account-1-deployment-1-config",
      expect.objectContaining({
        data: expect.objectContaining({
          "openclaw.json": expect.any(String),
          "config.yaml": expect.stringContaining("provider: azure-foundry"),
        }),
      })
    );
    expect(resourceClient.patchSecret).toHaveBeenCalledWith(
      "abra",
      "abra-account-1-deployment-1-secrets",
      expect.objectContaining({
        stringData: expect.objectContaining({
          env: expect.stringContaining("AZURE_FOUNDRY_API_KEY=test-azure-key"),
          AZURE_FOUNDRY_API_KEY: "test-azure-key",
        }),
      })
    );
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
            spec: {
              containers: [
                expect.objectContaining({
                  name: "openclaw",
                  image: "ghcr.io/abra/runtime:latest",
                  command: undefined,
                  args: ["gateway", "run"],
                  env: expect.arrayContaining([
                    expect.objectContaining({
                      name: "AZURE_FOUNDRY_API_KEY",
                      valueFrom: {
                        secretKeyRef: {
                          name: "abra-account-1-deployment-1-secrets",
                          key: "AZURE_FOUNDRY_API_KEY",
                        },
                      },
                    }),
                  ]),
                }),
              ],
            },
          },
        },
      })
    );
  });

  it("does not persist Telegram bot tokens from agentConfig payloads", async () => {
    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-create-redacted",
    });

    const operation = await adapter.create(
      createInput({
        payload: {
          name: "Abra runtime",
          image: "ghcr.io/abra/runtime:latest",
          agentConfig: {
            telegramBotToken: "123456:SECRET",
            telegramHomeChannel: "388259993",
            telegramAllowedUsers: "388259993",
          },
        },
      })
    );
    const persisted = await store.getStatus("op-create-redacted");

    expect(operation.payload.agentConfig).toBeUndefined();
    expect(operation.payload.agentConfigRef).toBe("account-current");
    expect(JSON.stringify(operation.payload)).not.toContain("SECRET");
    expect(JSON.stringify(persisted?.payload)).not.toContain("SECRET");
    expect(persisted?.payload.agentConfig).toBeUndefined();
    expect(persisted?.payload.agentConfigRef).toBe("account-current");
  });

  it("patches the StatefulSet for restart without deleting the PVC", async () => {
    const resourceClient = createResourceClient({
      ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
      ensureService: vi.fn(async () => "existing" as const),
      ensureStatefulSet: vi.fn(async () => "existing" as const),
    });

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

    const resourceClient = createResourceClient({
      ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
      ensureService: vi.fn(async () => "existing" as const),
      ensureStatefulSet: vi.fn(async () => "existing" as const),
    });

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
      expect(resourceClient.deleteConfigMap).toHaveBeenCalledWith(
        "abra",
        "abra-account-1-deployment-1-config"
      );
      expect(resourceClient.deleteSecret).toHaveBeenCalledWith(
        "abra",
        "abra-account-1-deployment-1-secrets"
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

  it("does not persist Telegram bot tokens from destroy payloads", async () => {
    const resourceClient = createResourceClient();
    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-destroy-redacted",
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });

    const operation = await adapter.destroy(
      createInput({
        requestId: "request-destroy-redacted",
        payload: {
          name: "Abra runtime",
          agentConfig: {
            telegramBotToken: "123456:SECRET",
            telegramHomeChannel: "388259993",
            telegramAllowedUsers: "388259993",
          },
        },
      })
    );
    const persisted = await store.getStatus("op-destroy-redacted");

    expect(operation.payload.agentConfig).toBeUndefined();
    expect(operation.payload.agentConfigRef).toBe("account-current");
    expect(JSON.stringify(operation.payload)).not.toContain("SECRET");
    expect(JSON.stringify(persisted?.payload)).not.toContain("SECRET");
    expect(persisted?.payload.agentConfig).toBeUndefined();
    expect(persisted?.payload.agentConfigRef).toBe("account-current");
  });

  it("deletes the PVC during destroy when retention is disabled", async () => {
    const previousRetention = process.env.AKS_PVC_RETENTION_DAYS;
    process.env.AKS_PVC_RETENTION_DAYS = "0";

    const resourceClient = createResourceClient({
      ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
      ensureService: vi.fn(async () => "existing" as const),
      ensureStatefulSet: vi.fn(async () => "existing" as const),
    });

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
      expect(resourceClient.deleteConfigMap).toHaveBeenCalledWith(
        "abra",
        "abra-account-1-deployment-1-config"
      );
      expect(resourceClient.deleteSecret).toHaveBeenCalledWith(
        "abra",
        "abra-account-1-deployment-1-secrets"
      );
    } finally {
      if (previousRetention === undefined) {
        delete process.env.AKS_PVC_RETENTION_DAYS;
      } else {
        process.env.AKS_PVC_RETENTION_DAYS = previousRetention;
      }
    }
  });

  it("reuses persisted AKS resource names from payload during destroy", async () => {
    const resourceClient = createResourceClient({
      ensurePersistentVolumeClaim: vi.fn(async () => "existing" as const),
      ensureService: vi.fn(async () => "existing" as const),
      ensureStatefulSet: vi.fn(async () => "existing" as const),
    });

    const adapter = new AksOrchestrationAdapter({
      operationStore: store as never,
      now: nextTimestamp,
      createOperationId: () => "op-destroy-legacy-1",
      loadKubernetesClient: vi.fn(async () => ({}) as never),
      createResourceClient: vi.fn(() => resourceClient),
    });

    await adapter.destroy(
      createInput({
        requestId: "request-destroy-legacy-1",
        target: {
          accountId: "fjyqatlmasrvefkf0g6lgajz9gv2",
          agentId: null,
          deploymentId: "abra-instance",
        },
        payload: {
          name: "Abra runtime",
          aksNames: {
            namespace: "abra",
            configMapName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c-config",
            secretName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c-secrets",
            statefulSetName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c",
            pvcName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c-data",
            serviceName: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c-svc",
          },
        },
      })
    );

    expect(resourceClient.deleteStatefulSet).toHaveBeenCalledWith(
      "abra",
      "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c"
    );
    expect(resourceClient.deleteService).toHaveBeenCalledWith(
      "abra",
      "abra-fjyqatlmasrvefkf0g6lgajz9gv2-9ba066b6-8348-4e00-abd3-52e7fcc7e04c-svc"
    );
  });
});
