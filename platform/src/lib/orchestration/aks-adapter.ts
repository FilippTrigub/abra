import { AppsV1Api, CoreV1Api, type V1Pod, type V1StatefulSet } from "@kubernetes/client-node";

import {
  getAzureWorkloadIdentityConfig,
  loadKubernetesClient,
  type AkSKubernetesClient,
} from "./aks-k8s-bootstrap";
import { firestoreOperationStore } from "./firestore-operation-store";
import {
  generateKubernetesManifests,
  type ManifestInput,
  type ManifestNameOverrides,
} from "./manifest-generator";
import type {
  AkRuntimeMetadata,
  AdapterMetadata,
  OrchestrationAdapter,
  OrchestrationOperation,
  OrchestrationOperationInput,
  OrchestrationOperationStatus,
} from "./types";

const AKS_POLL_AFTER_MS = {
  queued: 500,
  running: 1500,
  terminal: 0,
} as const;

const DEFAULT_CONFIG_REVISION = 1;

type CreateFlowPhase =
  | "create_created"
  | "storage_reconciled"
  | "service_reconciled"
  | "workload_reconciled"
  | "waiting_for_readiness"
  | "runtime_ready"
  | "failed";

interface CreateFlowMetadata {
  phase: CreateFlowPhase;
  order: ["storage", "service", "workload"];
  createdResources?: {
    configMap?: boolean;
    secret?: boolean;
    service?: boolean;
    workload?: boolean;
  };
}

interface PodReadiness {
  found: boolean;
  ready: boolean;
  phase?: string;
  message?: string;
  fatalReason?: string;
}

interface AksRuntimeResourceClient {
  ensureNamespace(name: string): Promise<"created" | "existing">;
  ensureServiceAccount(namespace: string, manifest: unknown): Promise<"created" | "existing">;
  ensureConfigMap(namespace: string, manifest: unknown): Promise<"created" | "existing">;
  ensureSecret(namespace: string, manifest: unknown): Promise<"created" | "existing">;
  patchConfigMap(namespace: string, name: string, patch: Record<string, unknown>): Promise<void>;
  patchSecret(namespace: string, name: string, patch: Record<string, unknown>): Promise<void>;
  ensurePersistentVolumeClaim(namespace: string, manifest: unknown): Promise<"created" | "existing">;
  ensureService(namespace: string, manifest: unknown): Promise<"created" | "existing">;
  ensureStatefulSet(namespace: string, manifest: unknown): Promise<"created" | "existing">;
  readStatefulSet(namespace: string, name: string): Promise<V1StatefulSet | null>;
  readPodReadiness(operation: OrchestrationOperation): Promise<PodReadiness>;
  patchStatefulSet(namespace: string, name: string, patch: Record<string, unknown>): Promise<void>;
  deleteStatefulSet(namespace: string, name: string): Promise<void>;
  deleteService(namespace: string, name: string): Promise<void>;
  deleteConfigMap(namespace: string, name: string): Promise<void>;
  deleteSecret(namespace: string, name: string): Promise<void>;
  deletePersistentVolumeClaim(namespace: string, name: string): Promise<void>;
}

interface AksAdapterDependencies {
  loadKubernetesClient: typeof loadKubernetesClient;
  operationStore: typeof firestoreOperationStore;
  createResourceClient: (client: AkSKubernetesClient) => AksRuntimeResourceClient;
  now: () => string;
  createOperationId: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readAgentConfig(payload: Record<string, unknown>): ManifestInput["agentConfig"] | undefined {
  const raw = payload.agentConfig;
  if (!isRecord(raw)) return undefined;
  const telegramBotToken = readOptionalString(raw.telegramBotToken);
  const telegramHomeChannel = readOptionalString(raw.telegramHomeChannel);
  if (!telegramBotToken || !telegramHomeChannel) return undefined;
  const telegramAllowedUsers = readOptionalString(raw.telegramAllowedUsers) ?? telegramHomeChannel;
  return { telegramBotToken, telegramHomeChannel, telegramAllowedUsers };
}

function readRuntimeEnv(payload: Record<string, unknown>): ManifestInput["runtimeEnv"] | undefined {
  const raw = payload.runtimeEnv;
  if (!isRecord(raw)) return undefined;

  const runtimeEnv = Object.entries(raw).reduce<Record<string, string>>(
    (values, [key, value]) => {
      if (typeof value === "string") {
        values[key] = value;
      }
      return values;
    },
    {},
  );

  return Object.keys(runtimeEnv).length > 0 ? runtimeEnv : undefined;
}

function sanitizePayloadForPersistence(payload: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(payload.agentConfig) && !isRecord(payload.runtimeEnv)) return payload;

  const { agentConfig: _agentConfig, runtimeEnv: _runtimeEnv, ...safePayload } = payload;
  void _agentConfig;
  void _runtimeEnv;
  return {
    ...safePayload,
    ...(isRecord(payload.agentConfig) ? { agentConfigRef: "account-current" } : {}),
    ...(isRecord(payload.runtimeEnv) ? { runtimeEnvRef: "account-current" } : {}),
  };
}

function buildManifestInput(input: {
  accountId: string;
  deploymentId: string;
  payload: Record<string, unknown>;
  image: string;
  configRevision: number;
  nameOverrides?: ManifestNameOverrides;
  agentConfig?: ManifestInput["agentConfig"];
  runtimeEnv?: ManifestInput["runtimeEnv"];
}): ManifestInput {
  const serviceAccountName = readOptionalString(input.payload.serviceAccountName) ?? undefined;
  const useServiceAccount = readOptionalBoolean(input.payload.useServiceAccount);
  const agentConfig = input.agentConfig ?? readAgentConfig(input.payload);
  const azureFoundryApiKey = readOptionalString(process.env.AZURE_FOUNDRY_API_KEY);
  const payloadRuntimeEnv = input.runtimeEnv ?? readRuntimeEnv(input.payload);
  const runtimeEnv = {
    ...(azureFoundryApiKey ? { azureFoundryApiKey } : {}),
    ...(payloadRuntimeEnv ?? {}),
  };

  return {
    accountId: input.accountId,
    deploymentId: input.deploymentId,
    image: input.image,
    configRevision: input.configRevision,
    ...(input.nameOverrides ? { nameOverrides: input.nameOverrides } : {}),
    ...(serviceAccountName ? { serviceAccountName } : {}),
    ...(useServiceAccount !== undefined ? { useServiceAccount } : {}),
    ...(agentConfig ? { agentConfig } : {}),
    ...(Object.keys(runtimeEnv).length > 0 ? { runtimeEnv } : {}),
  };
}

async function resolveAgentConfigForOperation(
  accountId: string,
  payload: Record<string, unknown>,
): Promise<ManifestInput["agentConfig"] | undefined> {
  const payloadAgentConfig = readAgentConfig(payload);
  if (payloadAgentConfig && payloadAgentConfig.telegramBotToken !== "[redacted]") {
    return payloadAgentConfig;
  }

  if (payload.agentConfigRef === "account-current") {
    const { loadAgentConfig } = await import("@/lib/agent-config/service");
    const storedAgentConfig = await loadAgentConfig(accountId);
    return storedAgentConfig ?? undefined;
  }

  return undefined;
}

async function resolveRuntimeEnvForOperation(
  accountId: string,
  payload: Record<string, unknown>,
): Promise<ManifestInput["runtimeEnv"] | undefined> {
  const payloadRuntimeEnv = readRuntimeEnv(payload);
  if (payloadRuntimeEnv) {
    return payloadRuntimeEnv;
  }

  if (payload.runtimeEnvRef === "account-current") {
    const { decryptRuntimeEnvForOrchestration } = await import("@/lib/runtime-env/service");
    const storedRuntimeEnv = await decryptRuntimeEnvForOrchestration(accountId);
    return storedRuntimeEnv ?? undefined;
  }

  return undefined;
}

function readPersistedAksNames(payload: Record<string, unknown>): ManifestNameOverrides | undefined {
  const raw = payload.aksNames;
  if (!isRecord(raw)) {
    return undefined;
  }

  const statefulSetName = readOptionalString(raw.statefulSetName);
  const serviceName = readOptionalString(raw.serviceName);
  const pvcName = readOptionalString(raw.pvcName);

  if (!statefulSetName || !serviceName || !pvcName) {
    return undefined;
  }

  return {
    namespace: readOptionalString(raw.namespace) ?? undefined,
    configMapName: readOptionalString(raw.configMapName) ?? undefined,
    secretName: readOptionalString(raw.secretName) ?? undefined,
    serviceAccountName: readOptionalString(raw.serviceAccountName) ?? undefined,
    statefulSetName,
    serviceName,
    pvcName,
    podName: readOptionalString(raw.podName) ?? undefined,
  };
}

function getNameOverridesFromMetadata(aksMetadata: AkRuntimeMetadata | undefined): ManifestNameOverrides | undefined {
  if (!aksMetadata?.statefulSetName || !aksMetadata.serviceName || !aksMetadata.pvcName) {
    return undefined;
  }

  return {
    namespace: aksMetadata.namespace,
    configMapName: aksMetadata.configMapName,
    secretName: aksMetadata.secretName,
    serviceAccountName: aksMetadata.serviceAccountName,
    statefulSetName: aksMetadata.statefulSetName,
    serviceName: aksMetadata.serviceName,
    pvcName: aksMetadata.pvcName,
    podName: aksMetadata.podName,
  };
}

function resolveRuntimeImage(payload: Record<string, unknown>): string {
  const payloadImage = readOptionalString(payload.image);
  if (payloadImage) {
    return payloadImage;
  }

  const envImage = readOptionalString(process.env.AKS_RUNTIME_IMAGE)
    ?? readOptionalString(process.env.ABRA_RUNTIME_IMAGE);

  if (envImage) {
    return envImage;
  }

  throw new Error(
    "AKS create requires a runtime image. Provide payload.image or set AKS_RUNTIME_IMAGE."
  );
}

function buildResourceHandle(metadata: { namespace: string; statefulSetName: string }): string {
  return `aks-runtime/${metadata.namespace}/${metadata.statefulSetName}`;
}

function buildGatewayRoute(metadata: {
  namespace: string;
  serviceName: string;
}): string {
  return `http://${metadata.serviceName}.${metadata.namespace}.svc.cluster.local:18789`;
}

function resolveConfigRevision(payload: Record<string, unknown>): number {
  const revision = payload.configRevision;
  return Number.isInteger(revision) && typeof revision === "number" && revision >= 1
    ? revision
    : DEFAULT_CONFIG_REVISION;
}

function resolvePvcRetentionDays(): number {
  const rawValue = readOptionalString(process.env.AKS_PVC_RETENTION_DAYS);
  if (!rawValue) {
    return 7;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || Number.isNaN(parsedValue)) {
    return 7;
  }

  return Math.max(0, parsedValue);
}

function addDays(isoTimestamp: string, days: number): string {
  const date = new Date(isoTimestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function appendStep(
  operation: OrchestrationOperation,
  status: OrchestrationOperationStatus,
  at: string,
  summary: string,
) {
  const lastStep = operation.steps.at(-1);

  if (lastStep && lastStep.status === status && lastStep.summary === summary) {
    return operation.steps;
  }

  return [...operation.steps, { status, at, summary }];
}

function wrapReconcileError(resourceKind: string, resourceName: string, error: unknown): Error {
  const classified = classifyKubernetesError(error);
  const wrappedError = new Error(
    `Failed to reconcile ${resourceKind} ${resourceName}: ${classified.message}`
  ) as Error & { code?: string };
  wrappedError.code = classified.code;
  return wrappedError;
}

function isTerminal(operation: OrchestrationOperation): boolean {
  return operation.status === "succeeded" || operation.status === "failed";
}

function getCreateFlowMetadata(operation: OrchestrationOperation): CreateFlowMetadata | null {
  const metadata = operation.runtimeMetadata;
  if (!metadata || !isRecord(metadata.createFlow)) {
    return null;
  }

  const phase = metadata.createFlow.phase;
  const order = metadata.createFlow.order;

  if (
    typeof phase !== "string" ||
    !Array.isArray(order) ||
    order.length !== 3 ||
    order[0] !== "storage" ||
    order[1] !== "service" ||
    order[2] !== "workload"
  ) {
    return null;
  }

  const createdResources = isRecord(metadata.createFlow.createdResources)
    ? {
        configMap: metadata.createFlow.createdResources.configMap === true,
        secret: metadata.createFlow.createdResources.secret === true,
        service: metadata.createFlow.createdResources.service === true,
        workload: metadata.createFlow.createdResources.workload === true,
      }
    : undefined;

  return {
    phase: phase as CreateFlowPhase,
    order: ["storage", "service", "workload"],
    createdResources,
  };
}

function updateRuntimeMetadata(
  operation: OrchestrationOperation,
  phase: CreateFlowPhase,
  additions?: {
    podName?: string;
    gatewayRoute?: string;
    createdResources?: {
      configMap?: boolean;
      secret?: boolean;
      service?: boolean;
      workload?: boolean;
    };
  },
): AdapterMetadata {
  const existing = operation.runtimeMetadata ?? {};
  const aks = existing.aks;

  if (!aks) {
    throw new Error("AKS runtime metadata is missing from the durable operation record.");
  }

  return {
    ...existing,
    aks: {
      ...aks,
      podName: additions?.podName ?? aks.podName,
      gatewayRoute: additions?.gatewayRoute ?? aks.gatewayRoute,
    },
    createFlow: {
      phase,
      order: ["storage", "service", "workload"],
      createdResources: {
        configMap:
          additions?.createdResources?.configMap
          ?? getCreateFlowMetadata(operation)?.createdResources?.configMap
          ?? false,
        secret:
          additions?.createdResources?.secret
          ?? getCreateFlowMetadata(operation)?.createdResources?.secret
          ?? false,
        service:
          additions?.createdResources?.service
          ?? getCreateFlowMetadata(operation)?.createdResources?.service
          ?? false,
        workload:
          additions?.createdResources?.workload
          ?? getCreateFlowMetadata(operation)?.createdResources?.workload
          ?? false,
      },
    },
  };
}

function classifyKubernetesError(error: unknown): { code: string; message: string; notFound: boolean } {
  if (isRecord(error)) {
    const message = readOptionalString(error.message) ?? "Unknown Kubernetes API error.";
    const code = typeof error.code === "number"
      ? String(error.code)
      : readOptionalString(error.code)
        ?? (typeof error.statusCode === "number" ? String(error.statusCode) : "AKS_API_ERROR");
    const notFound = code === "404" || code === "NotFound" || readOptionalString(error.reason) === "NotFound";

    return { code, message, notFound };
  }

  if (error instanceof Error) {
    return {
      code: "AKS_API_ERROR",
      message: error.message,
      notFound: false,
    };
  }

  return {
    code: "AKS_API_ERROR",
    message: "Unknown Kubernetes API error.",
    notFound: false,
  };
}

function getPodReadyCondition(pod: V1Pod): boolean {
  const conditions = pod.status?.conditions ?? [];
  return conditions.some((condition) => condition.type === "Ready" && condition.status === "True");
}

function getFatalPodReason(pod: V1Pod): string | null {
  const containerStatuses = [
    ...(pod.status?.initContainerStatuses ?? []),
    ...(pod.status?.containerStatuses ?? []),
  ];

  for (const status of containerStatuses) {
    const waitingReason = status.state?.waiting?.reason;
    if (
      waitingReason === "ImagePullBackOff" ||
      waitingReason === "ErrImagePull" ||
      waitingReason === "CreateContainerConfigError" ||
      waitingReason === "CrashLoopBackOff"
    ) {
      return waitingReason;
    }

    const terminatedReason = status.state?.terminated?.reason;
    if (terminatedReason && status.state?.terminated?.exitCode !== 0) {
      return terminatedReason;
    }
  }

  if (pod.status?.phase === "Failed") {
    return pod.status.reason ?? "PodFailed";
  }

  return null;
}

function createDefaultResourceClient(client: AkSKubernetesClient): AksRuntimeResourceClient {
  const coreApi = client.kubeConfig.makeApiClient(CoreV1Api);
  const appsApi = client.kubeConfig.makeApiClient(AppsV1Api);

  return {
    async ensureNamespace(name) {
      try {
        await coreApi.readNamespace({ name });
        return "existing";
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }

      await coreApi.createNamespace({
        body: {
          apiVersion: "v1",
          kind: "Namespace",
          metadata: { name },
        } as never,
      });
      return "created";
    },

    async ensureServiceAccount(namespace, manifest) {
      const name = (manifest as { metadata?: { name?: string } }).metadata?.name;
      if (!name) {
        throw new Error("ServiceAccount manifest metadata.name is required.");
      }

      try {
        await coreApi.readNamespacedServiceAccount({ name, namespace });
        return "existing";
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }

      await coreApi.createNamespacedServiceAccount({
        namespace,
        body: manifest as never,
      });
      return "created";
    },

    async ensureConfigMap(namespace, manifest) {
      const name = (manifest as { metadata?: { name?: string } }).metadata?.name;
      if (!name) {
        throw new Error("ConfigMap manifest metadata.name is required.");
      }

      try {
        await coreApi.readNamespacedConfigMap({ name, namespace });
        return "existing";
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }

      await coreApi.createNamespacedConfigMap({
        namespace,
        body: manifest as never,
      });
      return "created";
    },

    async ensureSecret(namespace, manifest) {
      const name = (manifest as { metadata?: { name?: string } }).metadata?.name;
      if (!name) {
        throw new Error("Secret manifest metadata.name is required.");
      }

      try {
        await coreApi.readNamespacedSecret({ name, namespace });
        return "existing";
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }

      await coreApi.createNamespacedSecret({
        namespace,
        body: manifest as never,
      });
      return "created";
    },

    async patchConfigMap(namespace, name, patch) {
      await coreApi.patchNamespacedConfigMap({
        name,
        namespace,
        body: patch as never,
      });
    },

    async patchSecret(namespace, name, patch) {
      await coreApi.patchNamespacedSecret({
        name,
        namespace,
        body: patch as never,
      });
    },

    async ensurePersistentVolumeClaim(namespace, manifest) {
      const name = (manifest as { metadata?: { name?: string } }).metadata?.name;
      if (!name) {
        throw new Error("PVC manifest metadata.name is required.");
      }

      try {
        await coreApi.readNamespacedPersistentVolumeClaim({ name, namespace });
        return "existing";
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }

      await coreApi.createNamespacedPersistentVolumeClaim({
        namespace,
        body: manifest as never,
      });
      return "created";
    },

    async ensureService(namespace, manifest) {
      const name = (manifest as { metadata?: { name?: string } }).metadata?.name;
      if (!name) {
        throw new Error("Service manifest metadata.name is required.");
      }

      try {
        await coreApi.readNamespacedService({ name, namespace });
        return "existing";
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }

      await coreApi.createNamespacedService({
        namespace,
        body: manifest as never,
      });
      return "created";
    },

    async ensureStatefulSet(namespace, manifest) {
      const name = (manifest as { metadata?: { name?: string } }).metadata?.name;
      if (!name) {
        throw new Error("StatefulSet manifest metadata.name is required.");
      }

      try {
        await appsApi.readNamespacedStatefulSet({ name, namespace });
        return "existing";
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }

      await appsApi.createNamespacedStatefulSet({
        namespace,
        body: manifest as never,
      });
      return "created";
    },

    async readStatefulSet(namespace, name) {
      try {
        return await appsApi.readNamespacedStatefulSet({ name, namespace });
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (classified.notFound) {
          return null;
        }
        throw error;
      }
    },

    async readPodReadiness(operation) {
      const aks = operation.runtimeMetadata?.aks;
      if (!aks?.namespace || !aks.podName) {
        return {
          found: false,
          ready: false,
          message: "Runtime pod metadata is not available yet.",
        };
      }

      const podList = await coreApi.listNamespacedPod({
        namespace: aks.namespace,
        labelSelector: "app=abra",
      });

      const pod = podList.items.find((candidate) => candidate.metadata?.name === aks.podName);

      if (!pod) {
        return {
          found: false,
          ready: false,
          message: "Runtime pod has not been created yet.",
        };
      }

      const fatalReason = getFatalPodReason(pod);
      return {
        found: true,
        ready: getPodReadyCondition(pod),
        phase: pod.status?.phase,
        message: pod.status?.message,
        fatalReason: fatalReason ?? undefined,
      };
    },

    async patchStatefulSet(namespace, name, patch) {
      await appsApi.patchNamespacedStatefulSet({
        name,
        namespace,
        body: patch as never,
      });
    },

    async deleteStatefulSet(namespace, name) {
      try {
        await appsApi.deleteNamespacedStatefulSet({ name, namespace });
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }
    },

    async deleteService(namespace, name) {
      try {
        await coreApi.deleteNamespacedService({ name, namespace });
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }
    },

    async deleteConfigMap(namespace, name) {
      try {
        await coreApi.deleteNamespacedConfigMap({ name, namespace });
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }
    },

    async deleteSecret(namespace, name) {
      try {
        await coreApi.deleteNamespacedSecret({ name, namespace });
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }
    },

    async deletePersistentVolumeClaim(namespace, name) {
      try {
        await coreApi.deleteNamespacedPersistentVolumeClaim({ name, namespace });
      } catch (error) {
        const classified = classifyKubernetesError(error);
        if (!classified.notFound) {
          throw error;
        }
      }
    },
  };
}

export class AksOperationNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AksOperationNotReadyError";
  }
}

export class AksOrchestrationAdapter implements OrchestrationAdapter {
  readonly name = "aks";

  private readonly dependencies: AksAdapterDependencies;

  constructor(dependencies: Partial<AksAdapterDependencies> = {}) {
    this.dependencies = {
      loadKubernetesClient: dependencies.loadKubernetesClient ?? loadKubernetesClient,
      operationStore: dependencies.operationStore ?? firestoreOperationStore,
      createResourceClient: dependencies.createResourceClient ?? createDefaultResourceClient,
      now: dependencies.now ?? (() => new Date().toISOString()),
      createOperationId: dependencies.createOperationId ?? (() => crypto.randomUUID()),
    };
  }

  async create(input: OrchestrationOperationInput): Promise<OrchestrationOperation> {
    const accountId = readRequiredString(input.target.accountId, "target.accountId");
    const deploymentId = readRequiredString(input.target.deploymentId, "target.deploymentId");
    const payload = isRecord(input.payload) ? { ...input.payload } : {};
    const image = resolveRuntimeImage(payload);
    const agentConfig = readAgentConfig(payload);
    const manifests = generateKubernetesManifests(buildManifestInput({
      accountId,
      deploymentId,
      payload,
      image,
      configRevision: DEFAULT_CONFIG_REVISION,
      nameOverrides: readPersistedAksNames(payload),
      agentConfig,
    }));
    const now = this.dependencies.now();
    const resourceHandle = buildResourceHandle(manifests.names);

    const operation: OrchestrationOperation = {
      operationId: this.dependencies.createOperationId(),
      adapter: this.name,
      action: "create",
      requestId: readRequiredString(input.requestId, "requestId"),
      target: {
        accountId,
        agentId: input.target.agentId,
        deploymentId,
      },
      payload: sanitizePayloadForPersistence({
        ...payload,
        image,
      }),
      status: "queued",
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      pollAfterMs: AKS_POLL_AFTER_MS.queued,
      steps: [
        {
          status: "queued",
          at: now,
          summary: "AKS create request persisted. Storage reconciliation will start on the next poll.",
        },
      ],
      error: null,
      result: {
        message: "AKS runtime creation queued.",
        resourceHandle,
        metadata: {
          aks: {
            namespace: manifests.names.namespace,
            configMapName: manifests.names.configMapName,
            secretName: manifests.names.secretName,
            serviceAccountName: manifests.names.serviceAccountName,
            statefulSetName: manifests.names.statefulSetName,
            pvcName: manifests.names.pvcName,
            serviceName: manifests.names.serviceName,
            configRevision: DEFAULT_CONFIG_REVISION,
          },
        },
      },
      runtimeMetadata: {
        aks: {
          namespace: manifests.names.namespace,
          configMapName: manifests.names.configMapName,
          secretName: manifests.names.secretName,
          serviceAccountName: manifests.names.serviceAccountName,
          statefulSetName: manifests.names.statefulSetName,
          pvcName: manifests.names.pvcName,
          serviceName: manifests.names.serviceName,
          configRevision: DEFAULT_CONFIG_REVISION,
        },
        createFlow: {
          phase: "create_created",
          order: ["storage", "service", "workload"],
          createdResources: {
            configMap: false,
            secret: false,
            service: false,
            workload: false,
          },
        },
      },
    };

    await this.dependencies.operationStore.create(operation);
    return operation;
  }

  async update(input: OrchestrationOperationInput): Promise<OrchestrationOperation> {
    const deploymentId = readRequiredString(input.target.deploymentId, "target.deploymentId");
    const payload = isRecord(input.payload) ? { ...input.payload } : {};
    const accountId = readRequiredString(input.target.accountId, "target.accountId");
    const image = resolveRuntimeImage(payload);
    const nextRevision = resolveConfigRevision(payload) + 1;
    const agentConfig = readAgentConfig(payload);
    const manifests = generateKubernetesManifests(buildManifestInput({
      accountId,
      deploymentId,
      payload,
      image,
      configRevision: nextRevision,
      nameOverrides: readPersistedAksNames(payload),
      agentConfig,
    }));
    const operation = await this.createActionOperation({
      input,
      payload: sanitizePayloadForPersistence({
        ...payload,
        image,
        configRevision: nextRevision,
      }),
      action: "update",
      resultMessage: "AKS runtime update queued.",
      stepSummary:
        "AKS update request persisted. Config revision reconciliation will start immediately.",
      aksMetadata: {
        namespace: manifests.names.namespace,
        configMapName: manifests.names.configMapName,
        secretName: manifests.names.secretName,
        serviceAccountName: manifests.names.serviceAccountName,
        statefulSetName: manifests.names.statefulSetName,
        pvcName: manifests.names.pvcName,
        serviceName: manifests.names.serviceName,
        configRevision: nextRevision,
      },
      runtimeMetadata: {
        actionPhase: "update_requested",
      },
    });

    try {
      const client = this.dependencies.createResourceClient(
        await this.dependencies.loadKubernetesClient()
      );

      const runningOperation = await this.persistSimpleActionUpdate(operation, {
        status: "running",
        summary: `Reconciling StatefulSet for config revision ${nextRevision}.`,
        runtimeMetadata: {
          actionPhase: "update_reconciling",
        },
      });

      await client.patchConfigMap(manifests.names.namespace, manifests.names.configMapName, {
        data: manifests.configMap.data,
      });
      await client.patchSecret(manifests.names.namespace, manifests.names.secretName, {
        stringData: manifests.secret.stringData,
      });

      const runtimeContainer = manifests.statefulset.spec.template.spec.containers[0];
      await client.patchStatefulSet(manifests.names.namespace, manifests.names.statefulSetName, {
        spec: {
          template: {
            metadata: {
              annotations: {
                "abra.io/config-revision": String(nextRevision),
                "abra.io/restarted-at": runningOperation.updatedAt,
              },
            },
            spec: {
              containers: [
                {
                  name: runtimeContainer.name,
                  image: runtimeContainer.image,
                  imagePullPolicy: runtimeContainer.imagePullPolicy,
                  command: runtimeContainer.command,
                  args: runtimeContainer.args,
                  env: runtimeContainer.env,
                },
              ],
            },
          },
        },
      });

      return this.persistSimpleActionUpdate(runningOperation, {
        status: "succeeded",
        summary: `Config revision ${nextRevision} reconciled and StatefulSet rollout triggered with image ${image}.`,
        completed: true,
        resultMessage: "AKS configuration update applied.",
        runtimeMetadata: {
          actionPhase: "update_reconciled",
        },
      });
    } catch (error) {
      const classified = classifyKubernetesError(error);
      return this.failSimpleActionOperation(
        operation,
        classified.message,
        classified.code,
        "AKS_UPDATE_RECONCILE_FAILED",
      );
    }
  }

  async restart(input: OrchestrationOperationInput): Promise<OrchestrationOperation> {
    const deploymentId = readRequiredString(input.target.deploymentId, "target.deploymentId");
    const payload = isRecord(input.payload) ? { ...input.payload } : {};
    const accountId = readRequiredString(input.target.accountId, "target.accountId");
    const image = resolveRuntimeImage(payload);
    const currentRevision = resolveConfigRevision(payload);
    const agentConfig = readAgentConfig(payload);
    const manifests = generateKubernetesManifests(buildManifestInput({
      accountId,
      deploymentId,
      payload,
      image,
      configRevision: currentRevision,
      nameOverrides: readPersistedAksNames(payload),
      agentConfig,
    }));
    const operation = await this.createActionOperation({
      input,
      payload: sanitizePayloadForPersistence({
        ...payload,
        image,
        configRevision: currentRevision,
      }),
      action: "restart",
      resultMessage: "AKS runtime restart queued.",
      stepSummary: "AKS restart request persisted. StatefulSet restart will start immediately.",
      aksMetadata: {
        namespace: manifests.names.namespace,
        configMapName: manifests.names.configMapName,
        secretName: manifests.names.secretName,
        serviceAccountName: manifests.names.serviceAccountName,
        statefulSetName: manifests.names.statefulSetName,
        pvcName: manifests.names.pvcName,
        serviceName: manifests.names.serviceName,
        configRevision: currentRevision,
      },
      runtimeMetadata: {
        actionPhase: "restart_requested",
      },
    });

    try {
      const client = this.dependencies.createResourceClient(
        await this.dependencies.loadKubernetesClient()
      );

      const runningOperation = await this.persistSimpleActionUpdate(operation, {
        status: "running",
        summary: "Triggering StatefulSet rolling restart while preserving the persistent home directory.",
        runtimeMetadata: {
          actionPhase: "restart_reconciling",
        },
      });

      await client.patchStatefulSet(manifests.names.namespace, manifests.names.statefulSetName, {
        spec: {
          template: {
            metadata: {
              annotations: {
                "kubectl.kubernetes.io/restartedAt": runningOperation.updatedAt,
              },
            },
          },
        },
      });

      return this.persistSimpleActionUpdate(runningOperation, {
        status: "succeeded",
        summary: "StatefulSet rolling restart triggered with PVC preserved.",
        completed: true,
        resultMessage: "AKS runtime restarted.",
        runtimeMetadata: {
          actionPhase: "restart_reconciled",
          pvcRetained: true,
        },
      });
    } catch (error) {
      const classified = classifyKubernetesError(error);
      return this.failSimpleActionOperation(
        operation,
        classified.message,
        classified.code,
        "AKS_RESTART_RECONCILE_FAILED",
      );
    }
  }

  async destroy(input: OrchestrationOperationInput): Promise<OrchestrationOperation> {
    const deploymentId = readRequiredString(input.target.deploymentId, "target.deploymentId");
    const payload = isRecord(input.payload) ? { ...input.payload } : {};
    const accountId = readRequiredString(input.target.accountId, "target.accountId");
    const image = readOptionalString(payload.image)
      ?? readOptionalString(process.env.AKS_RUNTIME_IMAGE)
      ?? readOptionalString(process.env.ABRA_RUNTIME_IMAGE)
      ?? "destroy-placeholder";
    const currentRevision = resolveConfigRevision(payload);
    const manifests = generateKubernetesManifests(buildManifestInput({
      accountId,
      deploymentId,
      payload,
      image,
      configRevision: currentRevision,
      nameOverrides: readPersistedAksNames(payload),
    }));
    const retentionDays = resolvePvcRetentionDays();
    const operation = await this.createActionOperation({
      input,
      payload: sanitizePayloadForPersistence({
        ...payload,
        configRevision: currentRevision,
      }),
      action: "destroy",
      resultMessage: "AKS runtime destroy queued.",
      stepSummary: "AKS destroy request persisted. Compute cleanup will start immediately.",
      aksMetadata: {
        namespace: manifests.names.namespace,
        configMapName: manifests.names.configMapName,
        secretName: manifests.names.secretName,
        serviceAccountName: manifests.names.serviceAccountName,
        statefulSetName: manifests.names.statefulSetName,
        pvcName: manifests.names.pvcName,
        serviceName: manifests.names.serviceName,
        configRevision: currentRevision,
      },
      runtimeMetadata: {
        actionPhase: "destroy_requested",
        pvcRetentionDays: retentionDays,
      },
    });

    try {
      const client = this.dependencies.createResourceClient(
        await this.dependencies.loadKubernetesClient()
      );

      const runningOperation = await this.persistSimpleActionUpdate(operation, {
        status: "running",
        summary: "Removing runtime compute resources and applying PVC retention policy.",
        runtimeMetadata: {
          actionPhase: "destroy_reconciling",
        },
      });

      await client.deleteStatefulSet(manifests.names.namespace, manifests.names.statefulSetName);
      await client.deleteService(manifests.names.namespace, manifests.names.serviceName);
      await client.deleteConfigMap(manifests.names.namespace, manifests.names.configMapName);
      await client.deleteSecret(manifests.names.namespace, manifests.names.secretName);

      let summary = `Runtime compute resources removed. PVC retained for ${retentionDays} day${retentionDays === 1 ? "" : "s"}.`;
      let resultMessage = "AKS runtime destroyed. Persistent storage retained.";
      const runtimeMetadata: Record<string, unknown> = {
        actionPhase: "destroy_reconciled",
        pvcRetentionDays: retentionDays,
        pvcRetained: retentionDays > 0,
      };

      if (retentionDays === 0) {
        await client.deletePersistentVolumeClaim(manifests.names.namespace, manifests.names.pvcName);
        summary = "Runtime compute resources removed and PVC deleted immediately by policy.";
        resultMessage = "AKS runtime destroyed and persistent storage deleted.";
      } else {
        runtimeMetadata.pvcDeleteAfter = addDays(runningOperation.updatedAt, retentionDays);
      }

      return this.persistSimpleActionUpdate(runningOperation, {
        status: "succeeded",
        summary,
        completed: true,
        resultMessage,
        runtimeMetadata,
      });
    } catch (error) {
      const classified = classifyKubernetesError(error);
      return this.failSimpleActionOperation(
        operation,
        classified.message,
        classified.code,
        "AKS_DESTROY_RECONCILE_FAILED",
      );
    }
  }

  async getStatus(operationId: string): Promise<OrchestrationOperation | null> {
    const operation = await this.dependencies.operationStore.getStatus(operationId);
    if (!operation) {
      return null;
    }

    if (
      operation.adapter !== this.name ||
      operation.action !== "create" ||
      isTerminal(operation)
    ) {
      return operation;
    }

    const flow = getCreateFlowMetadata(operation);
    if (!flow) {
      return operation;
    }

    let client: AksRuntimeResourceClient | undefined;

    try {
      const payload = isRecord(operation.payload) ? operation.payload : {};
      const image = resolveRuntimeImage(payload);
      const deploymentId = readRequiredString(operation.target.deploymentId, "target.deploymentId");
      const agentConfig = await resolveAgentConfigForOperation(operation.target.accountId, payload);
      const runtimeEnv = await resolveRuntimeEnvForOperation(operation.target.accountId, payload);
      const manifests = generateKubernetesManifests(buildManifestInput({
        accountId: operation.target.accountId,
        deploymentId,
        payload,
        image,
        configRevision: operation.runtimeMetadata?.aks?.configRevision ?? DEFAULT_CONFIG_REVISION,
        nameOverrides: getNameOverridesFromMetadata(operation.runtimeMetadata?.aks),
        agentConfig,
        runtimeEnv,
      }));
      client = this.dependencies.createResourceClient(
        await this.dependencies.loadKubernetesClient()
      );
      const createdResources = getCreateFlowMetadata(operation)?.createdResources;

      switch (flow.phase) {
        case "create_created": {
          let configMapResult: "created" | "existing" = "existing";
          let secretResult: "created" | "existing" = "existing";

          try {
            await client.ensureNamespace(manifests.names.namespace);
          } catch (error) {
            throw wrapReconcileError("Namespace", manifests.names.namespace, error);
          }

          if (manifests.serviceAccount && manifests.names.serviceAccountName) {
            try {
              await client.ensureServiceAccount(manifests.names.namespace, manifests.serviceAccount);
            } catch (error) {
              throw wrapReconcileError("ServiceAccount", manifests.names.serviceAccountName, error);
            }
          }

          try {
            configMapResult = await client.ensureConfigMap(manifests.names.namespace, manifests.configMap);
          } catch (error) {
            throw wrapReconcileError("ConfigMap", manifests.names.configMapName, error);
          }

          try {
            secretResult = await client.ensureSecret(manifests.names.namespace, manifests.secret);
          } catch (error) {
            throw wrapReconcileError("Secret", manifests.names.secretName, error);
          }

          try {
            await client.ensurePersistentVolumeClaim(manifests.names.namespace, manifests.pvc);
          } catch (error) {
            throw wrapReconcileError("PersistentVolumeClaim", manifests.names.pvcName, error);
          }

          return this.persistOperationUpdate(operation, {
            status: "running",
            phase: "storage_reconciled",
            pollAfterMs: AKS_POLL_AFTER_MS.running,
            summary: "Runtime namespace, configuration, and persistent storage reconciled.",
            createdResources: {
              configMap: configMapResult === "created",
              secret: secretResult === "created",
              service: createdResources?.service ?? false,
              workload: createdResources?.workload ?? false,
            },
          });
        }

        case "storage_reconciled": {
          const serviceResult = await client.ensureService(manifests.names.namespace, manifests.service);
          return this.persistOperationUpdate(operation, {
            status: "running",
            phase: "service_reconciled",
            pollAfterMs: AKS_POLL_AFTER_MS.running,
            summary: "Runtime service reconciled and ready for workload binding.",
            createdResources: {
              configMap: createdResources?.configMap ?? false,
              secret: createdResources?.secret ?? false,
              service: serviceResult === "created",
              workload: createdResources?.workload ?? false,
            },
          });
        }

        case "service_reconciled": {
          const workloadResult = await client.ensureStatefulSet(
            manifests.names.namespace,
            manifests.statefulset
          );

          return this.persistOperationUpdate(operation, {
            status: "running",
            phase: "workload_reconciled",
            pollAfterMs: AKS_POLL_AFTER_MS.running,
            summary: "Runtime workload reconciled. Waiting for hydration and readiness.",
            podName: manifests.names.podName,
            createdResources: {
              configMap: createdResources?.configMap ?? false,
              secret: createdResources?.secret ?? false,
              service: createdResources?.service ?? false,
              workload: workloadResult === "created",
            },
          });
        }

        case "workload_reconciled":
        case "waiting_for_readiness": {
          const statefulSet = await client.readStatefulSet(
            manifests.names.namespace,
            manifests.names.statefulSetName
          );

          if (!statefulSet) {
            throw new Error("StatefulSet disappeared before the runtime became ready.");
          }

          const podReadiness = await client.readPodReadiness(operation);
          if (podReadiness.fatalReason) {
            return this.failOperation(
              operation,
              client,
              `Runtime failed before readiness: ${podReadiness.fatalReason}.`
            );
          }

          if ((statefulSet.status?.readyReplicas ?? 0) >= 1 && podReadiness.ready) {
            return this.persistOperationUpdate(operation, {
              status: "succeeded",
              phase: "runtime_ready",
              pollAfterMs: AKS_POLL_AFTER_MS.terminal,
              summary: "Runtime readiness confirmed through StatefulSet and pod conditions.",
              gatewayRoute: buildGatewayRoute(manifests.names),
              completed: true,
            });
          }

          return this.persistOperationUpdate(operation, {
            status: "running",
            phase: "waiting_for_readiness",
            pollAfterMs: AKS_POLL_AFTER_MS.running,
            summary:
              podReadiness.message
              ?? `Waiting for hydrated runtime readiness (pod phase: ${podReadiness.phase ?? "pending"}).`,
            podName: manifests.names.podName,
          });
        }

        case "runtime_ready":
        case "failed":
          return operation;
      }
    } catch (error) {
      const classified = classifyKubernetesError(error);
      return this.failOperation(operation, client, classified.message, classified.code);
    }
  }

  private async persistOperationUpdate(
    operation: OrchestrationOperation,
    update: {
      status: OrchestrationOperationStatus;
      phase: CreateFlowPhase;
      pollAfterMs: number;
      summary: string;
      podName?: string;
      gatewayRoute?: string;
      completed?: boolean;
      createdResources?: {
        configMap?: boolean;
        secret?: boolean;
        service?: boolean;
        workload?: boolean;
      };
    },
  ) {
    const now = this.dependencies.now();
    const runtimeMetadata = updateRuntimeMetadata(operation, update.phase, {
      podName: update.podName,
      gatewayRoute: update.gatewayRoute,
      createdResources: update.createdResources,
    });
    const aksMetadata = runtimeMetadata.aks;

    if (!aksMetadata) {
      throw new Error("AKS runtime metadata is required when updating a create operation.");
    }

    const updatedOperation: OrchestrationOperation = {
      ...operation,
      status: update.status,
      updatedAt: now,
      completedAt: update.completed ? now : null,
      pollAfterMs: update.pollAfterMs,
      steps: appendStep(operation, update.status, now, update.summary),
      error: null,
      result: operation.result
        ? {
            ...operation.result,
            message:
              update.status === "succeeded"
                ? "AKS runtime is ready."
                : operation.result.message,
            metadata: {
              ...(operation.result.metadata ?? {}),
              aks: {
                ...aksMetadata,
              },
            },
          }
        : operation.result,
      runtimeMetadata,
    };

    await this.dependencies.operationStore.update(updatedOperation);
    return updatedOperation;
  }

  private async createActionOperation({
    input,
    payload,
    action,
    resultMessage,
    stepSummary,
    aksMetadata,
    runtimeMetadata,
  }: {
    input: OrchestrationOperationInput;
    payload: Record<string, unknown>;
    action: "update" | "restart" | "destroy";
    resultMessage: string;
    stepSummary: string;
    aksMetadata: NonNullable<AdapterMetadata["aks"]>;
    runtimeMetadata?: Record<string, unknown>;
  }) {
    const now = this.dependencies.now();
    const operation: OrchestrationOperation = {
      operationId: this.dependencies.createOperationId(),
      adapter: this.name,
      action,
      requestId: readRequiredString(input.requestId, "requestId"),
      target: {
        accountId: readRequiredString(input.target.accountId, "target.accountId"),
        agentId: input.target.agentId,
        deploymentId: readRequiredString(input.target.deploymentId, "target.deploymentId"),
      },
      payload,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      pollAfterMs: AKS_POLL_AFTER_MS.queued,
      steps: [
        {
          status: "queued",
          at: now,
          summary: stepSummary,
        },
      ],
      error: null,
      result: {
        message: resultMessage,
        resourceHandle: buildResourceHandle(aksMetadata),
        metadata: {
          aks: {
            ...aksMetadata,
          },
        },
      },
      runtimeMetadata: {
        aks: {
          ...aksMetadata,
        },
        ...(runtimeMetadata ?? {}),
      },
    };

    await this.dependencies.operationStore.create(operation);
    return operation;
  }

  private async persistSimpleActionUpdate(
    operation: OrchestrationOperation,
    update: {
      status: OrchestrationOperationStatus;
      summary: string;
      completed?: boolean;
      resultMessage?: string;
      runtimeMetadata?: Record<string, unknown>;
    },
  ) {
    const now = this.dependencies.now();
    const runtimeMetadata = {
      ...(operation.runtimeMetadata ?? {}),
      ...(update.runtimeMetadata ?? {}),
      aks: operation.runtimeMetadata?.aks
        ? { ...operation.runtimeMetadata.aks }
        : operation.result?.metadata?.aks
          ? { ...operation.result.metadata.aks }
          : undefined,
    };

    const updatedOperation: OrchestrationOperation = {
      ...operation,
      status: update.status,
      updatedAt: now,
      completedAt: update.completed ? now : null,
      pollAfterMs: update.completed ? AKS_POLL_AFTER_MS.terminal : AKS_POLL_AFTER_MS.running,
      steps: appendStep(operation, update.status, now, update.summary),
      error: null,
      result: operation.result
        ? {
            ...operation.result,
            message: update.resultMessage ?? operation.result.message,
            metadata: {
              ...(operation.result.metadata ?? {}),
              aks: runtimeMetadata.aks,
            },
          }
        : operation.result,
      runtimeMetadata,
    };

    await this.dependencies.operationStore.update(updatedOperation);
    return updatedOperation;
  }

  private async failSimpleActionOperation(
    operation: OrchestrationOperation,
    message: string,
    code: string,
    defaultCode: string,
  ) {
    const now = this.dependencies.now();
    const failedOperation: OrchestrationOperation = {
      ...operation,
      status: "failed",
      updatedAt: now,
      completedAt: now,
      pollAfterMs: AKS_POLL_AFTER_MS.terminal,
      steps: appendStep(operation, "failed", now, `${operation.action} flow failed.`),
      error: {
        code: code || defaultCode,
        message,
      },
      runtimeMetadata: {
        ...(operation.runtimeMetadata ?? {}),
        actionPhase: `${operation.action}_failed`,
      },
    };

    await this.dependencies.operationStore.update(failedOperation);
    return failedOperation;
  }

  private async failOperation(
    operation: OrchestrationOperation,
    client: AksRuntimeResourceClient | undefined,
    message: string,
    code: string = "AKS_CREATE_RECONCILE_FAILED",
  ) {
    const now = this.dependencies.now();
    const flow = getCreateFlowMetadata(operation);
    const runtimeMetadata = updateRuntimeMetadata(operation, "failed");
    let cleanupSuffix = "";

    if (client && runtimeMetadata.aks) {
      try {
        if (flow?.createdResources?.workload) {
          await client.deleteStatefulSet(runtimeMetadata.aks.namespace, runtimeMetadata.aks.statefulSetName);
        }

        if (flow?.createdResources?.service) {
          await client.deleteService(runtimeMetadata.aks.namespace, runtimeMetadata.aks.serviceName);
        }

        if (flow?.createdResources?.configMap && runtimeMetadata.aks.configMapName) {
          await client.deleteConfigMap(runtimeMetadata.aks.namespace, runtimeMetadata.aks.configMapName);
        }

        if (flow?.createdResources?.secret && runtimeMetadata.aks.secretName) {
          await client.deleteSecret(runtimeMetadata.aks.namespace, runtimeMetadata.aks.secretName);
        }
      } catch (cleanupError) {
        const classifiedCleanup = classifyKubernetesError(cleanupError);
        cleanupSuffix = ` Cleanup warning: ${classifiedCleanup.message}`;
      }
    }

    const failedOperation: OrchestrationOperation = {
      ...operation,
      status: "failed",
      updatedAt: now,
      completedAt: now,
      pollAfterMs: AKS_POLL_AFTER_MS.terminal,
      steps: appendStep(
        operation,
        "failed",
        now,
        `AKS create flow failed.${cleanupSuffix ? cleanupSuffix : ""}`
      ),
      error: {
        code,
        message: `${message}${cleanupSuffix}`,
      },
      runtimeMetadata,
    };

    await this.dependencies.operationStore.update(failedOperation);
    return failedOperation;
  }

  async getBootstrapStatus() {
    const k8sClient = await this.dependencies.loadKubernetesClient();
    const azureConfig = getAzureWorkloadIdentityConfig();

    return {
      kubernetes: {
        available: true,
        isInCluster: k8sClient.isInCluster,
        apiUrl: k8sClient.config.apiUrl,
        namespace: k8sClient.config.runtimeNamespace,
      },
      azureWorkloadIdentity: {
        configured: azureConfig.isConfigured,
        tenantId: azureConfig.tenantId || "[not set]",
        clientId: azureConfig.clientId || "[not set]",
      },
    };
  }
}
