/**
 * Kubernetes client bootstrap for AKS orchestration.
 *
 * Provides in-cluster configuration loading via @kubernetes/client-node
 * with Azure Workload Identity support for Azure resource access.
 *
 * Authentication Strategy:
 * - Explicit kubeconfig: Uses KUBECONFIG or KUBECONFIG_B64 when provided
 * - In-cluster: Uses mounted service account token automatically
 * - Local dev: Falls back to kubeconfig path from KUBECONFIG env var
 * - Azure resources: Uses Azure Workload Identity via environment variables
 *
 * Does NOT require a checked-in kubeconfig file.
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { KubeConfig } from "@kubernetes/client-node";

const inlineKubeconfigPaths = new Map<string, string>();

async function ensureKubeconfigPathFromEnv(): Promise<void> {
  if (process.env.KUBECONFIG) {
    return;
  }

  const inlineKubeconfig = process.env.KUBECONFIG_B64;
  if (!inlineKubeconfig) {
    return;
  }

  const kubeconfigContent = Buffer.from(inlineKubeconfig, "base64").toString("utf8").trim();
  if (!kubeconfigContent) {
    throw new Error("KUBECONFIG_B64 decoded to empty kubeconfig content.");
  }

  const kubeconfigHash = createHash("sha256").update(kubeconfigContent).digest("hex");
  const existingPath = inlineKubeconfigPaths.get(kubeconfigHash);
  if (existingPath) {
    process.env.KUBECONFIG = existingPath;
    return;
  }

  const kubeconfigDirectory = path.join(os.tmpdir(), "abra-kubeconfig");
  await fs.mkdir(kubeconfigDirectory, { recursive: true });

  const kubeconfigPath = path.join(kubeconfigDirectory, `${kubeconfigHash}.yaml`);
  await fs.writeFile(kubeconfigPath, kubeconfigContent, { mode: 0o600 });

  inlineKubeconfigPaths.set(kubeconfigHash, kubeconfigPath);
  process.env.KUBECONFIG = kubeconfigPath;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** AKS connection configuration derived from environment. */
export interface AkSConnectionConfig {
  /** Kubernetes API server URL (from cluster config or env) */
  apiUrl: string;
  /** Cluster name for logging/metadata */
  clusterName?: string;
  /** Namespace for Abra runtimes */
  runtimeNamespace: string;
  /** Whether auth was loaded from in-cluster service account */
  isInCluster: boolean;
}

/** Kubernetes client wrapper for AKS operations. */
export interface AkSKubernetesClient {
  /** The underlying KubeConfig instance */
  kubeConfig: KubeConfig;
  /** Connection configuration */
  config: AkSConnectionConfig;
  /** Indicates auth was loaded from in-cluster service account */
  isInCluster: boolean;
}

/** Azure Workload Identity configuration. */
export interface AzureWorkloadIdentityConfig {
  /** Tenant ID for Azure AD */
  tenantId: string;
  /** Client ID (service principal) */
  clientId: string;
  /** Indicates whether all required env vars are present */
  isConfigured: boolean;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Loads Kubernetes client configuration from default sources.
 *
 * Prioritizes explicit kubeconfig config over in-cluster config so hosted
 * runtimes can override ambient cluster auth when needed.
 * Does NOT require a checked-in kubeconfig.
 *
 * @returns Kubernetes client with resolved configuration
 * @throws Error if no valid config source is available
 */
export async function loadKubernetesClient(): Promise<AkSKubernetesClient> {
  const kubeConfig = new KubeConfig();
  await ensureKubeconfigPathFromEnv();

  if (process.env.KUBECONFIG) {
    return loadKubeconfigClient(kubeConfig);
  }

  // Try in-cluster config first (when running in AKS pod)
  try {
    kubeConfig.loadFromCluster();
    const currentContext = kubeConfig.getCurrentContext();
    if (currentContext) {
      return {
        kubeConfig,
        config: {
          apiUrl: currentContext,
          runtimeNamespace: getRuntimeNamespace(),
          isInCluster: true,
        },
        isInCluster: true,
      };
    }
  } catch {
    // Fall through to kubeconfig fallback
  }

  // Fall back to KUBECONFIG env var or default kubeconfig path
  try {
    return loadKubeconfigClient(kubeConfig);
  } catch (error) {
    throw new Error(
      `Failed to load Kubernetes config: ${error instanceof Error ? error.message : "Unknown error"}. ` +
        "Either run in-cluster (service account token) or set KUBECONFIG environment variable."
    );
  }
}

function loadKubeconfigClient(kubeConfig: KubeConfig): AkSKubernetesClient {
  kubeConfig.loadFromDefault();
  const currentCluster = kubeConfig.getCurrentCluster();
  if (!currentCluster) {
    throw new Error(
      "No active cluster found in kubeconfig. Set KUBECONFIG or run in-cluster."
    );
  }

  return {
    kubeConfig,
    config: {
      apiUrl: currentCluster.server,
      clusterName: currentCluster.name,
      runtimeNamespace: getRuntimeNamespace(),
      isInCluster: false,
    },
    isInCluster: false,
  };
}

/**
 * Validates Azure Workload Identity environment configuration.
 *
 * Azure Workload Identity requires these env vars for Azure resource access:
 * - AZURE_TENANT_ID: Azure AD tenant ID
 * - AZURE_CLIENT_ID: Service principal client ID
 * - AZURE_FEDERATED_TOKEN_FILE: Mounted service account token path
 *
 * This is separate from Kubernetes auth and is used for:
 * - Azure Key Vault access
 * - Azure Managed Identity operations
 * - Other Azure resource management
 *
 * @returns Azure Workload Identity configuration status
 */
export function getAzureWorkloadIdentityConfig(): AzureWorkloadIdentityConfig {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const federatedTokenFile = process.env.AZURE_FEDERATED_TOKEN_FILE;

  const isConfigured = !!(tenantId && clientId && federatedTokenFile);

  return {
    tenantId: tenantId || "",
    clientId: clientId || "",
    isConfigured,
  };
}

/**
 * Validates that all required Azure Workload Identity env vars are present.
 *
 * @throws Error if any required variable is missing
 */
export function validateAzureWorkloadIdentity(): void {
  const config = getAzureWorkloadIdentityConfig();

  if (!config.isConfigured) {
    const missing: string[] = [];
    if (!config.tenantId) missing.push("AZURE_TENANT_ID");
    if (!config.clientId) missing.push("AZURE_CLIENT_ID");
    if (!process.env.AZURE_FEDERATED_TOKEN_FILE) missing.push("AZURE_FEDERATED_TOKEN_FILE");

    throw new Error(
      `Missing Azure Workload Identity environment variables: ${missing.join(", ")}. ` +
        "See platform/.env.example for required variables."
    );
  }
}

/**
 * Gets the runtime namespace for Abra agent deployments.
 *
 * Priority:
 * 1. AKS_RUNTIME_NAMESPACE env var
 * 2. "abra" default namespace
 */
function getRuntimeNamespace(): string {
  return process.env.AKS_RUNTIME_NAMESPACE || "abra";
}

/**
 * Checks if running in-cluster (AKS pod with service account).
 */
export function isInClusterEnvironment(): boolean {
  return (
    process.env.KUBERNETES_SERVICE_HOST !== undefined &&
    process.env.KUBERNETES_SERVICE_PORT !== undefined
  );
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Error thrown when Kubernetes client bootstrap fails.
 */
export class KubernetesBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KubernetesBootstrapError";
  }
}

/**
 * Error thrown when Azure Workload Identity is not configured.
 */
export class AzureWorkloadIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AzureWorkloadIdentityError";
  }
}
