export type OrchestrationAction = "create" | "update" | "restart" | "destroy";

export type OrchestrationOperationStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export type MockOperationOutcome = "succeeded" | "failed";

export interface OrchestrationTargetRef {
  accountId: string;
  agentId: string | null;
  deploymentId: string | null;
}

export interface OrchestrationOperationInput {
  requestId: string;
  target: OrchestrationTargetRef;
  payload: Record<string, unknown>;
  mockBehavior?: {
    outcome?: MockOperationOutcome;
  };
}

export interface OrchestrationOperationStep {
  status: OrchestrationOperationStatus;
  at: string;
  summary: string;
}

export interface OrchestrationOperationError {
  code: string;
  message: string;
}

export interface OrchestrationOperationResult {
  message: string;
  resourceHandle: string;
  /** Adapter-specific metadata (e.g., AKS runtime details) */
  metadata?: AdapterMetadata;
}

export interface OrchestrationOperation {
  operationId: string;
  adapter: string;
  action: OrchestrationAction;
  requestId: string;
  target: OrchestrationTargetRef;
  payload: Record<string, unknown>;
  status: OrchestrationOperationStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  pollAfterMs: number;
  steps: OrchestrationOperationStep[];
  error: OrchestrationOperationError | null;
  result: OrchestrationOperationResult | null;
  /** Adapter-specific runtime metadata for durable operation storage */
  runtimeMetadata?: AdapterMetadata;
}

export interface OrchestrationAdapter {
  readonly name: string;
  create(input: OrchestrationOperationInput): Promise<OrchestrationOperation>;
  update(input: OrchestrationOperationInput): Promise<OrchestrationOperation>;
  restart(input: OrchestrationOperationInput): Promise<OrchestrationOperation>;
  destroy(input: OrchestrationOperationInput): Promise<OrchestrationOperation>;
  getStatus(operationId: string): Promise<OrchestrationOperation | null>;
}

/**
 * AKS-specific runtime metadata for durable operation storage.
 * Represents the Kubernetes resources created for an Abra agent runtime.
 */
export interface AkRuntimeMetadata {
  /** Kubernetes namespace where the runtime is deployed */
  namespace: string;
  /** Name of the ConfigMap mounted for runtime configuration */
  configMapName?: string;
  /** Name of the Secret mounted for runtime environment */
  secretName?: string;
  /** Optional ServiceAccount name bound to the runtime pod */
  serviceAccountName?: string;
  /** Name of the StatefulSet workload */
  statefulSetName: string;
  /** Name of the PVC backing ~/.openclaw */
  pvcName: string;
  /** Name of the internal Service for gateway routing */
  serviceName: string;
  /** Config revision number for the deployed runtime */
  configRevision?: number;
  /** Pod name (set when runtime is running) */
  podName?: string;
  /** Gateway route handle for reaching the runtime */
  gatewayRoute?: string;
}

/**
 * Adapter-specific metadata that can be attached to operation results.
 * Used by real adapters (e.g., AKS) to provide resource handle details.
 */
export interface AdapterMetadata {
  /** Runtime metadata for AKS-backed deployments */
  aks?: AkRuntimeMetadata;
  /** Additional adapter-specific fields */
  [key: string]: unknown;
}
