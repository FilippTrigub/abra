/**
 * Runtime naming helpers for AKS orchestration.
 *
 * Provides deterministic, Kubernetes-compliant naming for:
 * - Runtime namespace
 * - StatefulSet (workload)
 * - Service
 * - PersistentVolumeClaim
 * - Config revision identifiers
 *
 * Naming is derived from stable identifiers (accountId, deploymentId, operationId)
 * to ensure stability across restarts and idempotent reconciliation.
 */

import { createHash } from "node:crypto";

import { OrchestrationOperation } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum length for Kubernetes resource names (RFC 1123 subdomain) */
const MAX_NAME_LENGTH = 253;

/** Maximum length for Kubernetes DNS labels used by Service/StatefulSet names */
const MAX_DNS_LABEL_LENGTH = 63;

/** Longest suffix appended to the shared AKS runtime base name. */
const LONGEST_RUNTIME_SUFFIX = "-secrets";

/** Shared runtime base name budget so all derived AKS resource names stay <= 63 chars. */
const MAX_RUNTIME_BASE_NAME_LENGTH = MAX_DNS_LABEL_LENGTH - LONGEST_RUNTIME_SUFFIX.length;

/** Stable hash length for compacting long AKS names without collisions. */
const HASH_LENGTH = 8;

/** Prefix for all Abra runtime resources */
const ABRA_PREFIX = "abra";

/** Separator for name components */
const SEPARATOR = "-";

/**
 * Validates that a string is a valid Kubernetes name.
 *
 * Kubernetes names must:
 * - Consist of lowercase alphanumeric characters, '-' or '.'
 * - Start with an alphanumeric character
 * - End with an alphanumeric character
 * - Be no more than 253 characters (RFC 1123 subdomain)
 *
 * @param name The name to validate
 * @returns true if valid, false otherwise
 */
function isValidKubernetesName(name: string): boolean {
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return false;
  }
  // RFC 1123 subdomain: lowercase alphanumeric, '-', '.', start/end with alphanumeric
  const k8sNameRegex = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
  return k8sNameRegex.test(name);
}

/**
 * Sanitizes a string to be a valid Kubernetes name.
 *
 * - Converts to lowercase
 * - Replaces invalid characters with hyphens
 * - Ensures start/end with alphanumeric
 * - Truncates to MAX_NAME_LENGTH
 *
 * @param input The input string to sanitize
 * @returns Sanitized Kubernetes-compliant name
 */
function sanitizeKubernetesName(input: string): string {
  // Convert to lowercase
  let sanitized = input.toLowerCase();

  // Replace invalid characters (not lowercase alphanumeric, '-', or '.') with hyphens
  sanitized = sanitized.replace(/[^a-z0-9.-]/g, SEPARATOR);

  // Remove leading/trailing non-alphanumeric characters
  sanitized = sanitized.replace(/^[^a-z0-9]+/, "");
  sanitized = sanitized.replace(/[^a-z0-9]+$/, "");

  // Replace consecutive separators with single separator
  sanitized = sanitized.replace(/[-.]+/g, SEPARATOR);

  // Remove leading/trailing separators again
  sanitized = sanitized.replace(/^[-]+/, "");
  sanitized = sanitized.replace(/[-]+$/, "");

  // Truncate to max length if needed
  if (sanitized.length > MAX_NAME_LENGTH) {
    sanitized = sanitized.slice(0, MAX_NAME_LENGTH);
    // Ensure it still ends with alphanumeric
    while (sanitized.length > 0 && !/^[a-z0-9]$/.test(sanitized.slice(-1))) {
      sanitized = sanitized.slice(0, -1);
    }
  }

  return sanitized;
}

function trimTrailingNonAlphanumeric(value: string): string {
  let trimmed = value;

  while (trimmed.length > 0 && !/^[a-z0-9]$/.test(trimmed.slice(-1))) {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed;
}

function compactRuntimeBaseName(name: string): string {
  if (name.length <= MAX_RUNTIME_BASE_NAME_LENGTH) {
    return name;
  }

  const hash = createHash("sha256").update(name).digest("hex").slice(0, HASH_LENGTH);
  const readableBudget = MAX_RUNTIME_BASE_NAME_LENGTH - HASH_LENGTH - SEPARATOR.length;
  const readablePrefix = trimTrailingNonAlphanumeric(name.slice(0, readableBudget));

  return `${readablePrefix}${SEPARATOR}${hash}`;
}

function isValidDnsLabel(name: string): boolean {
  return name.length > 0
    && name.length <= MAX_DNS_LABEL_LENGTH
    && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name);
}

function buildRuntimeBaseName(accountId: string, deploymentId: string): string {
  const sanitizedAccount = sanitizeKubernetesName(accountId);
  const sanitizedDeployment = sanitizeKubernetesName(deploymentId);
  const baseName = `${ABRA_PREFIX}${SEPARATOR}${sanitizedAccount}${SEPARATOR}${sanitizedDeployment}`;

  const compactedName = compactRuntimeBaseName(baseName);
  if (!isValidDnsLabel(compactedName)) {
    throw new Error(`Invalid compacted AKS runtime name generated: ${compactedName}`);
  }

  return compactedName;
}

// ---------------------------------------------------------------------------
// Naming functions
// ---------------------------------------------------------------------------

/**
 * Computes the runtime namespace for an Abra deployment.
 *
 * Priority:
 * 1. AKS_RUNTIME_NAMESPACE environment variable (for custom deployments)
 * 2. "abra" default namespace
 *
 * @returns The runtime namespace name
 */
export function getRuntimeNamespace(): string {
  return process.env.AKS_RUNTIME_NAMESPACE || ABRA_PREFIX;
}

/**
 * Computes the StatefulSet (workload) name for a deployment.
 *
 * Format: `{prefix}-{account-id}-{deployment-id}`
 *
 * The naming is deterministic from accountId and deploymentId,
 * ensuring the same deployment always produces the same name.
 *
 * @param accountId The account identifier
 * @param deploymentId The deployment identifier
 * @returns The StatefulSet name
 * @throws Error if accountId or deploymentId is empty or invalid
 */
export function getStatefulSetName(accountId: string, deploymentId: string): string {
  if (!accountId || accountId.trim() === "") {
    throw new Error("accountId is required for StatefulSet naming");
  }
  if (!deploymentId || deploymentId.trim() === "") {
    throw new Error("deploymentId is required for StatefulSet naming");
  }

  const name = buildRuntimeBaseName(accountId, deploymentId);

  if (!isValidKubernetesName(name)) {
    throw new Error(`Invalid StatefulSet name generated: ${name}`);
  }

  return name;
}

/**
 * Computes the Service name for a deployment.
 *
 * Format: `{prefix}-{account-id}-{deployment-id}-svc`
 *
 * The Service name is derived from the StatefulSet name with an "-svc" suffix
 * to distinguish it from the workload while maintaining deterministic naming.
 *
 * @param accountId The account identifier
 * @param deploymentId The deployment identifier
 * @returns The Service name
 */
export function getServiceName(accountId: string, deploymentId: string): string {
  const statefulSetName = getStatefulSetName(accountId, deploymentId);
  return `${statefulSetName}-svc`;
}

/**
 * Computes the PersistentVolumeClaim (PVC) name for a deployment.
 *
 * Format: `{prefix}-{account-id}-{deployment-id}-data`
 *
 * The PVC name is derived from the StatefulSet name with a "-data" suffix
 * to follow Kubernetes StatefulSet PVC naming conventions.
 *
 * @param accountId The account identifier
 * @param deploymentId The deployment identifier
 * @returns The PVC name
 */
export function getPvcName(accountId: string, deploymentId: string): string {
  const statefulSetName = getStatefulSetName(accountId, deploymentId);
  return `${statefulSetName}-data`;
}

/**
 * Computes the config revision identifier for a deployment.
 *
 * The config revision is a monotonically increasing number that tracks
 * configuration changes for a given deployment. It is used to detect
 * when the desired `~/.openclaw` configuration needs to be reconciled.
 *
 * @param deploymentId The deployment identifier
 * @param revision The current config revision number
 * @returns The config revision identifier string
 */
export function getConfigRevisionId(deploymentId: string, revision: number): string {
  if (!deploymentId || deploymentId.trim() === "") {
    throw new Error("deploymentId is required for config revision identifier");
  }
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error("revision must be a non-negative integer");
  }

  const sanitizedDeployment = sanitizeKubernetesName(deploymentId);
  return `${sanitizedDeployment}-rev-${revision}`;
}

/**
 * Computes the pod name for a deployment.
 *
 * In a StatefulSet with replicas=1, the pod name follows the pattern:
 * `{statefulset-name}-{ordinal}`
 *
 * @param accountId The account identifier
 * @param deploymentId The deployment identifier
 * @param ordinal The ordinal index (usually 0 for replicas=1)
 * @returns The pod name
 */
export function getPodName(accountId: string, deploymentId: string, ordinal: number = 0): string {
  const statefulSetName = getStatefulSetName(accountId, deploymentId);
  return `${statefulSetName}-${ordinal}`;
}

// ---------------------------------------------------------------------------
// Operation-based naming helpers
// ---------------------------------------------------------------------------

/**
 * Computes resource names from an orchestration operation.
 *
 * Extracts accountId and deploymentId from the operation target and
 * generates all AKS resource names in one call.
 *
 * @param operation The orchestration operation
 * @returns Object containing namespace, statefulSetName, serviceName, pvcName, and podName
 * @throws Error if operation target lacks required fields
 */
export function getRuntimeNamesFromOperation(operation: OrchestrationOperation): {
  namespace: string;
  statefulSetName: string;
  serviceName: string;
  pvcName: string;
  podName: string;
} {
  const { accountId, deploymentId } = operation.target;

  if (!accountId) {
    throw new Error("Operation target missing accountId");
  }
  if (!deploymentId) {
    throw new Error("Operation target missing deploymentId");
  }

  return {
    namespace: getRuntimeNamespace(),
    statefulSetName: getStatefulSetName(accountId, deploymentId),
    serviceName: getServiceName(accountId, deploymentId),
    pvcName: getPvcName(accountId, deploymentId),
    podName: getPodName(accountId, deploymentId),
  };
}

/**
 * Validates that a deploymentId is suitable for AKS resource naming.
 *
 * Performs basic validation to catch common errors before generating names.
 *
 * @param deploymentId The deployment identifier to validate
 * @throws Error if deploymentId is invalid
 */
export function validateDeploymentIdForNaming(deploymentId: string): void {
  if (!deploymentId) {
    throw new Error("deploymentId cannot be empty");
  }
  if (typeof deploymentId !== "string") {
    throw new Error("deploymentId must be a string");
  }
  if (deploymentId.trim() === "") {
    throw new Error("deploymentId cannot be whitespace");
  }
  if (deploymentId.length > 100) {
    throw new Error(
      `deploymentId is too long (${deploymentId.length} chars, max 100 suggested)`
    );
  }
}

/**
 * Validates that an accountId is suitable for AKS resource naming.
 *
 * @param accountId The account identifier to validate
 * @throws Error if accountId is invalid
 */
export function validateAccountIdForNaming(accountId: string): void {
  if (!accountId) {
    throw new Error("accountId cannot be empty");
  }
  if (typeof accountId !== "string") {
    throw new Error("accountId must be a string");
  }
  if (accountId.trim() === "") {
    throw new Error("accountId cannot be whitespace");
  }
  if (accountId.length > 100) {
    throw new Error(
      `accountId is too long (${accountId.length} chars, max 100 suggested)`
    );
  }
}

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/**
 * Output of `getRuntimeNamesFromOperation` containing all AKS resource names.
 */
export interface RuntimeResourceNames {
  /** Kubernetes namespace for the runtime */
  namespace: string;
  /** StatefulSet (workload) name */
  statefulSetName: string;
  /** Service name for gateway routing */
  serviceName: string;
  /** PersistentVolumeClaim name for ~/.openclaw */
  pvcName: string;
  /** Pod name (StatefulSet with ordinal) */
  podName: string;
}

/**
 * Input for AKS naming helpers containing deployment identifiers.
 */
export interface NamingInput {
  /** Account identifier */
  accountId: string;
  /** Deployment identifier */
  deploymentId: string;
  /** Optional pod ordinal (default: 0) */
  ordinal?: number;
}
