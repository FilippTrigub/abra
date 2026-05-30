/**
 * Kubernetes manifest generator for AKS Abra runtimes.
 *
 * Generates deterministic Kubernetes manifests for:
 * - StatefulSet (OpenClaw runtime workload)
 * - Service (internal gateway routing)
 * - PersistentVolumeClaim (~/.openclaw persistence)
 *
 * The generator encodes the pre-start hydration assumption:
 * An init container hydrates ~/.openclaw before the main OpenClaw container starts.
 *
 * Uses naming helpers from naming-helpers.ts to ensure consistent resource naming.
 */

import {
  getStatefulSetName,
  getServiceName,
  getPvcName,
  getRuntimeNamespace,
} from "./naming-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input parameters for manifest generation.
 *
 * All fields are required and must be valid for successful generation.
 */
export interface ManifestInput {
  /** Account identifier (must be valid for naming) */
  accountId: string;
  /** Deployment identifier (must be valid for naming) */
  deploymentId: string;
  /** OpenClaw container image (required) */
  image: string;
  /** OpenClaw container image pull policy (default: IfNotPresent) */
  imagePullPolicy?: "Always" | "IfNotPresent" | "Never";
  /** Config revision number for this deployment (optional) */
  configRevision?: number;
  /** Resource limits for the OpenClaw container (optional) */
  resources?: {
    cpu?: string;
    memory?: string;
  };
  /** Whether to use a dedicated service account (default: false) */
  useServiceAccount?: boolean;
  /** Service account name (if useServiceAccount=true, default: abra-openclaw-sa) */
  serviceAccountName?: string;
  /** Optional persisted AKS resource names to reuse for reconciliation/migration safety */
  nameOverrides?: ManifestNameOverrides;
  /** User-supplied agent configuration injected into ConfigMap and Secret */
  agentConfig?: {
    telegramBotToken?: string;
  };
}

export interface ManifestNameOverrides {
  namespace?: string;
  configMapName?: string;
  secretName?: string;
  serviceAccountName?: string;
  statefulSetName?: string;
  serviceName?: string;
  pvcName?: string;
  podName?: string;
}

const DEFAULT_SERVICE_ACCOUNT_NAME = "abra-openclaw-sa";

/**
 * Kubernetes object base interface.
 */
interface KubernetesObject {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
}

/**
 * StatefulSet spec interface.
 */
interface StatefulSetSpec {
  serviceName: string;
  replicas: number;
  selector: {
    matchLabels: Record<string, string>;
  };
  template: {
    metadata: {
      labels: Record<string, string>;
    };
    spec: {
      serviceAccountName?: string;
      initContainers?: Array<{
        name: string;
        image: string;
        imagePullPolicy?: string;
        command?: string[];
        securityContext?: {
          runAsUser?: number;
          runAsGroup?: number;
        };
        volumeMounts?: Array<{
          name: string;
          mountPath: string;
          readOnly?: boolean;
        }>;
      }>;
      containers: Array<{
        name: string;
        image: string;
        imagePullPolicy?: string;
        volumeMounts?: Array<{
          name: string;
          mountPath: string;
          readOnly?: boolean;
        }>;
        resources?: {
          limits: Record<string, string>;
          requests: Record<string, string>;
        };
        readinessProbe?: {
          exec: { command: string[] };
          initialDelaySeconds: number;
          periodSeconds: number;
          timeoutSeconds: number;
          successThreshold: number;
          failureThreshold: number;
        };
        livenessProbe?: {
          exec: { command: string[] };
          initialDelaySeconds: number;
          periodSeconds: number;
          timeoutSeconds: number;
          successThreshold: number;
          failureThreshold: number;
        };
        env?: Array<{
          name: string;
          value: string;
        }>;
        command?: string[];
      }>;
      volumes?: Array<{
        name: string;
        persistentVolumeClaim?: {
          claimName: string;
        };
        configMap?: {
          name: string;
        };
        secret?: {
          secretName: string;
        };
      }>;
      restartPolicy: string;
    };
  };
}

/**
 * Service spec interface.
 */
interface ServiceSpec {
  type: string;
  ports: Array<{
    port: number;
    targetPort: number;
    protocol: string;
    name: string;
  }>;
  selector: Record<string, string>;
}

/**
 * PVC spec interface.
 */
interface PVCSpec {
  accessModes: string[];
  resources: {
    requests: {
      storage: string;
    };
  };
}

/**
 * Output of generateKubernetesManifests().
 *
 * Contains all generated manifests as plain objects ready for serialization.
 */
export interface KubernetesManifests {
  /** Namespace manifest for the runtime envelope */
  namespace: KubernetesObject;
  /** Optional ServiceAccount manifest when the runtime uses a dedicated identity */
  serviceAccount?: KubernetesObject;
  /** ConfigMap consumed by init-hydration */
  configMap: KubernetesObject & { data: Record<string, string> };
  /** Secret consumed by init-hydration */
  secret: KubernetesObject & { stringData: Record<string, string>; type: string };
  /** StatefulSet manifest for the Abra/OpenClaw runtime */
  statefulset: KubernetesObject & { spec: StatefulSetSpec };
  /** Service manifest for internal routing */
  service: KubernetesObject & { spec: ServiceSpec };
  /** PersistentVolumeClaim for ~/.openclaw */
  pvc: KubernetesObject & { spec: PVCSpec };
  /** Computed resource names (for verification/debugging) */
  names: {
    namespace: string;
    configMapName: string;
    secretName: string;
    serviceAccountName?: string;
    statefulSetName: string;
    serviceName: string;
    pvcName: string;
    podName: string;
  };
}

function getConfigMapName(accountId: string, deploymentId: string): string {
  return `${getStatefulSetName(accountId, deploymentId)}-config`;
}

function getSecretName(accountId: string, deploymentId: string): string {
  return `${getStatefulSetName(accountId, deploymentId)}-secrets`;
}

function resolveServiceAccountName(input: ManifestInput): string | undefined {
  if (input.useServiceAccount !== true && !input.serviceAccountName?.trim()) {
    return undefined;
  }

  return input.serviceAccountName?.trim() || DEFAULT_SERVICE_ACCOUNT_NAME;
}

function getPodNameForStatefulSetName(statefulSetName: string, ordinal: number = 0): string {
  return `${statefulSetName}-${ordinal}`;
}

/**
 * Validation error for manifest generation.
 */
export interface ManifestGenerationError extends Error {
  code: "INVALID_INPUT" | "NAMING_ERROR";
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates ManifestInput before generation.
 *
 * @param input The input to validate
 * @throws ManifestGenerationError if validation fails
 */
function validateInput(input: ManifestInput): void {
  if (!input.accountId || input.accountId.trim() === "") {
    throw {
      code: "INVALID_INPUT",
      field: "accountId",
      message: "accountId is required",
      name: "ManifestGenerationError",
    } as ManifestGenerationError;
  }

  if (!input.deploymentId || input.deploymentId.trim() === "") {
    throw {
      code: "INVALID_INPUT",
      field: "deploymentId",
      message: "deploymentId is required",
      name: "ManifestGenerationError",
    } as ManifestGenerationError;
  }

  if (!input.image || input.image.trim() === "") {
    throw {
      code: "INVALID_INPUT",
      field: "image",
      message: "image is required",
      name: "ManifestGenerationError",
    } as ManifestGenerationError;
  }
}

// ---------------------------------------------------------------------------
// StatefulSet Manifest Generator
// ---------------------------------------------------------------------------

function buildHydrationInitScript(): string {
  return [
    "set -eu",
    "echo 'Starting ~/.openclaw hydration...'",
    "mkdir -p /openclaw-home/.openclaw",
    "if [ -f /config/openclaw.json ]; then",
    "  cp /config/openclaw.json /openclaw-home/.openclaw/",
    "  echo 'Config loaded from /config/openclaw.json'",
    "else",
    "  echo 'Warning: No /config/openclaw.json found, using defaults'",
    "fi",
    "if [ -f /secrets/env ]; then",
    "  cp /secrets/env /openclaw-home/.openclaw/.env",
    "  echo 'Environment loaded from /secrets/env'",
    "fi",
    "chown -R 1000:1000 /openclaw-home/.openclaw",
    "chmod 700 /openclaw-home/.openclaw",
    "echo 'Hydration complete.'",
  ].join("\n");
}

/**
 * Generates a StatefulSet manifest for the Abra/OpenClaw runtime.
 *
 * The manifest includes:
 * - A main OpenClaw container
 * - An init container for pre-start hydration of ~/.openclaw
 * - A readiness probe to verify runtime health
 *
 * @param input The manifest input parameters
 * @returns The StatefulSet manifest object
 */
function generateStatefulSet(input: ManifestInput): KubernetesObject & {
  spec: StatefulSetSpec;
} {
  const { accountId, deploymentId, image, imagePullPolicy = "IfNotPresent" } = input;

  const statefulSetName = input.nameOverrides?.statefulSetName ?? getStatefulSetName(accountId, deploymentId);
  const pvcName = input.nameOverrides?.pvcName ?? getPvcName(accountId, deploymentId);
  const namespace = input.nameOverrides?.namespace ?? getRuntimeNamespace();
  const configMapName = input.nameOverrides?.configMapName ?? getConfigMapName(accountId, deploymentId);
  const secretName = input.nameOverrides?.secretName ?? getSecretName(accountId, deploymentId);
  const serviceAccountName = input.nameOverrides?.serviceAccountName ?? resolveServiceAccountName(input);
  const serviceName = input.nameOverrides?.serviceName ?? getServiceName(accountId, deploymentId);

  // Build container resources if provided
  type ContainerResources = {
    limits: { cpu?: string; memory?: string };
    requests: { cpu?: string; memory?: string };
  };

  let containerResources: ContainerResources | undefined = undefined;

  if (input.resources) {
    containerResources = {
      limits: {},
      requests: {},
    };
    if (input.resources.cpu) {
      containerResources.limits.cpu = input.resources.cpu;
      containerResources.requests.cpu = input.resources.cpu;
    }
    if (input.resources.memory) {
      containerResources.limits.memory = input.resources.memory;
      containerResources.requests.memory = input.resources.memory;
    }
  }

  // Build hydration init container command
  // This assumes the init container has access to configuration via ConfigMap/Secret
  const hydrationInitContainerCommand = ["/bin/sh", "-c", buildHydrationInitScript()];

  const manifest = {
    apiVersion: "apps/v1",
    kind: "StatefulSet",
    metadata: {
      name: statefulSetName,
      namespace: namespace,
      labels: {
        app: "abra",
        "abra.io/account-id": accountId,
        "abra.io/deployment-id": deploymentId,
      },
    },
    spec: {
      serviceName,
      replicas: 1,
      selector: {
        matchLabels: {
          app: "abra",
          "abra.io/deployment-id": deploymentId,
        },
      },
      template: {
        metadata: {
          labels: {
            app: "abra",
            "abra.io/account-id": accountId,
            "abra.io/deployment-id": deploymentId,
          },
        },
        spec: {
          ...(serviceAccountName ? { serviceAccountName } : {}),
          initContainers: [
            {
              name: "init-hydration",
              image: "busybox:latest",
              imagePullPolicy: "IfNotPresent",
              command: hydrationInitContainerCommand,
              securityContext: {
                runAsUser: 0,
                runAsGroup: 0,
              },
              volumeMounts: [
                {
                  name: "config-volume",
                  mountPath: "/config",
                  readOnly: true,
                },
                {
                  name: "secrets-volume",
                  mountPath: "/secrets",
                  readOnly: true,
                },
                {
                  name: "openclaw-home",
                  mountPath: "/openclaw-home",
                },
              ],
            },
          ],
          containers: [
            {
              name: "openclaw",
              image: image,
              imagePullPolicy: imagePullPolicy,
              volumeMounts: [
                {
                  name: "openclaw-home",
                  mountPath: "/openclaw-home",
                },
              ],
              resources: containerResources,
              readinessProbe: {
                exec: { command: ["curl", "-sf", "http://localhost:18789/health"] },
                initialDelaySeconds: 10,
                periodSeconds: 5,
                timeoutSeconds: 3,
                successThreshold: 1,
                failureThreshold: 3,
              },
              livenessProbe: {
                exec: { command: ["curl", "-sf", "http://localhost:18789/health"] },
                initialDelaySeconds: 30,
                periodSeconds: 10,
                timeoutSeconds: 5,
                successThreshold: 1,
                failureThreshold: 3,
              },
              env: [
                {
                  name: "OPENCLAW_HOME",
                  value: "/openclaw-home",
                },
              ],
            },
          ],
          volumes: [
            {
              name: "openclaw-home",
              persistentVolumeClaim: {
                claimName: pvcName,
              },
            },
            {
              name: "config-volume",
              configMap: {
                name: configMapName,
              },
            },
            {
              name: "secrets-volume",
              secret: {
                secretName: secretName,
              },
            },
          ],
          restartPolicy: "Always",
        },
      },
    },
  };

  return manifest;
}

function generateNamespace(input: ManifestInput): KubernetesObject {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name: input.nameOverrides?.namespace ?? getRuntimeNamespace(),
      labels: {
        app: "abra",
      },
    },
  };
}

function generateServiceAccount(input: ManifestInput): KubernetesObject | undefined {
  const serviceAccountName = input.nameOverrides?.serviceAccountName ?? resolveServiceAccountName(input);
  if (!serviceAccountName) {
    return undefined;
  }

  const { accountId, deploymentId } = input;
  return {
    apiVersion: "v1",
    kind: "ServiceAccount",
    metadata: {
      name: serviceAccountName,
      namespace: input.nameOverrides?.namespace ?? getRuntimeNamespace(),
      labels: {
        app: "abra",
        "abra.io/account-id": accountId,
        "abra.io/deployment-id": deploymentId,
      },
    },
  };
}

function buildOpenClawConfig(input: ManifestInput): string {
  const config: Record<string, unknown> = { gateway: { mode: "local" } };

  const token = input.agentConfig?.telegramBotToken?.trim();
  if (token) {
    config.channels = {
      telegram: {
        accounts: {
          default: {
            botToken: "${TELEGRAM_BOT_TOKEN}",
          },
        },
      },
    };
  }

  return JSON.stringify(config, null, 2);
}

function generateConfigMap(input: ManifestInput): KubernetesObject & { data: Record<string, string> } {
  const { accountId, deploymentId } = input;
  const namespace = input.nameOverrides?.namespace ?? getRuntimeNamespace();

  return {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name: input.nameOverrides?.configMapName ?? getConfigMapName(accountId, deploymentId),
      namespace,
      labels: {
        app: "abra",
        "abra.io/account-id": accountId,
        "abra.io/deployment-id": deploymentId,
      },
    },
    data: {
      "openclaw.json": buildOpenClawConfig(input) + "\n",
    },
  };
}

function buildEnvFileContent(input: ManifestInput): string {
  const lines: string[] = [];
  const token = input.agentConfig?.telegramBotToken?.trim();
  if (token) {
    lines.push(`TELEGRAM_BOT_TOKEN=${token}`);
  }
  return lines.join("\n");
}

function generateSecret(input: ManifestInput): KubernetesObject & {
  stringData: Record<string, string>;
  type: string;
} {
  const { accountId, deploymentId } = input;
  const namespace = input.nameOverrides?.namespace ?? getRuntimeNamespace();

  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: input.nameOverrides?.secretName ?? getSecretName(accountId, deploymentId),
      namespace,
      labels: {
        app: "abra",
        "abra.io/account-id": accountId,
        "abra.io/deployment-id": deploymentId,
      },
    },
    type: "Opaque",
    stringData: {
      env: buildEnvFileContent(input),
    },
  };
}

// ---------------------------------------------------------------------------
// Service Manifest Generator
// ---------------------------------------------------------------------------

/**
 * Generates a Service manifest for internal gateway routing.
 *
 * The Service is a ClusterIP service that routes traffic to the OpenClaw pod.
 *
 * @param input The manifest input parameters
 * @returns The Service manifest object
 */
function generateService(input: ManifestInput): KubernetesObject & {
  spec: ServiceSpec;
} {
  const { accountId, deploymentId } = input;
  const serviceName = input.nameOverrides?.serviceName ?? getServiceName(accountId, deploymentId);
  const namespace = input.nameOverrides?.namespace ?? getRuntimeNamespace();

  const manifest = {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: serviceName,
      namespace: namespace,
      labels: {
        app: "abra",
        "abra.io/account-id": accountId,
        "abra.io/deployment-id": deploymentId,
      },
    },
    spec: {
      type: "ClusterIP",
      ports: [
        {
          port: 18789,
          targetPort: 18789,
          protocol: "TCP",
          name: "http",
        },
      ],
      selector: {
        app: "abra",
        "abra.io/deployment-id": deploymentId,
      },
    },
  };

  return manifest;
}

// ---------------------------------------------------------------------------
// PVC Manifest Generator
// ---------------------------------------------------------------------------

/**
 * Generates a PersistentVolumeClaim manifest for ~/.openclaw.
 *
 * The PVC is bound to a StorageClass (determined by AKS defaults).
 * Size: 1Gi (configurable via input if needed).
 *
 * @param input The manifest input parameters
 * @returns The PVC manifest object
 */
function generatePVC(input: ManifestInput): KubernetesObject & {
  spec: PVCSpec;
} {
  const { accountId, deploymentId } = input;
  const pvcName = input.nameOverrides?.pvcName ?? getPvcName(accountId, deploymentId);
  const namespace = input.nameOverrides?.namespace ?? getRuntimeNamespace();

  const manifest = {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: {
      name: pvcName,
      namespace: namespace,
      labels: {
        app: "abra",
        "abra.io/account-id": accountId,
        "abra.io/deployment-id": deploymentId,
      },
    },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: {
        requests: {
          storage: "1Gi",
        },
      },
    },
  };

  return manifest;
}

// ---------------------------------------------------------------------------
// Main Orchestration Function
// ---------------------------------------------------------------------------

/**
 * Generates all Kubernetes manifests for an Abra/OpenClaw runtime.
 *
 * This is the main entry point for manifest generation. It:
 * 1. Validates the input parameters
 * 2. Generates StatefulSet, Service, and PVC manifests
 * 3. Returns a structured object with all manifests and computed names
 *
 * The generation is deterministic: the same input always produces the same output.
 *
 * @param input The manifest input parameters
 * @returns KubernetesManifests containing all generated manifests
 * @throws ManifestGenerationError if input validation fails
 */
export function generateKubernetesManifests(input: ManifestInput): KubernetesManifests {
  // Validate input first
  validateInput(input);

  const { accountId, deploymentId } = input;

  // Generate all manifests
  const namespace = generateNamespace(input);
  const serviceAccount = generateServiceAccount(input);
  const configMap = generateConfigMap(input);
  const secret = generateSecret(input);
  const statefulset = generateStatefulSet(input);
  const service = generateService(input);
  const pvc = generatePVC(input);

  // Compute resource names for reference
  const statefulSetName = input.nameOverrides?.statefulSetName ?? getStatefulSetName(accountId, deploymentId);
  const names = {
    namespace: input.nameOverrides?.namespace ?? getRuntimeNamespace(),
    configMapName: input.nameOverrides?.configMapName ?? getConfigMapName(accountId, deploymentId),
    secretName: input.nameOverrides?.secretName ?? getSecretName(accountId, deploymentId),
    serviceAccountName: input.nameOverrides?.serviceAccountName ?? resolveServiceAccountName(input),
    statefulSetName,
    serviceName: input.nameOverrides?.serviceName ?? getServiceName(accountId, deploymentId),
    pvcName: input.nameOverrides?.pvcName ?? getPvcName(accountId, deploymentId),
    podName: input.nameOverrides?.podName ?? getPodNameForStatefulSetName(statefulSetName),
  };

  return {
    namespace,
    serviceAccount,
    configMap,
    secret,
    statefulset,
    service,
    pvc,
    names,
  };
}

/**
 * Serializes KubernetesManifests to YAML strings.
 *
 * Uses a simple JSON serialization with indentation for portability.
 * In production, you may want to use a proper YAML library.
 *
 * @param manifests The manifests to serialize
 * @returns Object with YAML strings for each manifest
 */
export function serializeManifestsToYaml(manifests: KubernetesManifests): {
  statefulset: string;
  service: string;
  pvc: string;
} {
  // Simple YAML-like serialization (for deterministic output without external deps)
  const serializeObject = (obj: unknown, indent: number = 0): string => {
    const spaces = "  ".repeat(indent);
    if (obj === null || obj === undefined) {
      return "null";
    }
    if (typeof obj !== "object") {
      return String(obj);
    }
    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return "[]";
      }
      return obj
        .map((item) => `${spaces}- ${serializeObject(item, indent + 1)}`)
        .join("\n");
    }
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return "{}";
    }
    return entries
      .map(([key, value]) => {
        const valueStr = serializeObject(value, indent + 1);
        if (valueStr.includes("\n")) {
          return `${spaces}${key}:\n${valueStr}`;
        }
        return `${spaces}${key}: ${valueStr}`;
      })
      .join("\n");
  };

  return {
    statefulset: serializeObject(manifests.statefulset),
    service: serializeObject(manifests.service),
    pvc: serializeObject(manifests.pvc),
  };
}

/**
 * Validates manifest structure after generation.
 *
 * Performs basic checks to ensure the manifests have required fields.
 * This is useful for testing and debugging.
 *
 * @param manifests The manifests to validate
 * @returns true if valid, throws error if invalid
 */
export function validateGeneratedManifests(manifests: KubernetesManifests): void {
  const namespace = manifests.namespace;
  const configMap = manifests.configMap;
  const secret = manifests.secret;
  const statefulset = manifests.statefulset;
  const service = manifests.service;
  const pvc = manifests.pvc;

  if (namespace.apiVersion !== "v1") {
    throw new Error("Namespace apiVersion mismatch");
  }
  if (namespace.kind !== "Namespace") {
    throw new Error("Namespace kind mismatch");
  }
  if (!namespace.metadata?.name) {
    throw new Error("Namespace missing metadata.name");
  }

  if (configMap.apiVersion !== "v1") {
    throw new Error("ConfigMap apiVersion mismatch");
  }
  if (configMap.kind !== "ConfigMap") {
    throw new Error("ConfigMap kind mismatch");
  }
  if (!configMap.metadata?.name) {
    throw new Error("ConfigMap missing metadata.name");
  }
  if (!configMap.data || typeof configMap.data["openclaw.json"] !== "string") {
    throw new Error("ConfigMap missing data.openclaw.json");
  }

  if (secret.apiVersion !== "v1") {
    throw new Error("Secret apiVersion mismatch");
  }
  if (secret.kind !== "Secret") {
    throw new Error("Secret kind mismatch");
  }
  if (!secret.metadata?.name) {
    throw new Error("Secret missing metadata.name");
  }
  if (!secret.stringData || typeof secret.stringData.env !== "string") {
    throw new Error("Secret missing stringData.env");
  }

  // Check StatefulSet
  if (statefulset.apiVersion !== "apps/v1") {
    throw new Error("StatefulSet apiVersion mismatch");
  }
  if (statefulset.kind !== "StatefulSet") {
    throw new Error("StatefulSet kind mismatch");
  }
  if (!statefulset.metadata?.name) {
    throw new Error("StatefulSet missing metadata.name");
  }
  if (!statefulset.spec?.serviceName) {
    throw new Error("StatefulSet missing spec.serviceName");
  }

  // Check Service
  if (service.apiVersion !== "v1") {
    throw new Error("Service apiVersion mismatch");
  }
  if (service.kind !== "Service") {
    throw new Error("Service kind mismatch");
  }
  if (!service.metadata?.name) {
    throw new Error("Service missing metadata.name");
  }
  if (!service.spec?.selector) {
    throw new Error("Service missing spec.selector");
  }

  // Check PVC
  if (pvc.apiVersion !== "v1") {
    throw new Error("PVC apiVersion mismatch");
  }
  if (pvc.kind !== "PersistentVolumeClaim") {
    throw new Error("PVC kind mismatch");
  }
  if (!pvc.metadata?.name) {
    throw new Error("PVC missing metadata.name");
  }
  if (!pvc.spec?.accessModes) {
    throw new Error("PVC missing spec.accessModes");
  }

  // Check names consistency
  if (manifests.names.statefulSetName !== statefulset.metadata.name) {
    throw new Error("Names mismatch: statefulset");
  }
  if (manifests.names.serviceName !== service.metadata.name) {
    throw new Error("Names mismatch: service");
  }
  if (manifests.names.pvcName !== pvc.metadata.name) {
    throw new Error("Names mismatch: pvc");
  }
  if (manifests.names.configMapName !== configMap.metadata.name) {
    throw new Error("Names mismatch: configMap");
  }
  if (manifests.names.secretName !== secret.metadata.name) {
    throw new Error("Names mismatch: secret");
  }
}
