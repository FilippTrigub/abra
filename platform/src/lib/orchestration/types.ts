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
  metadata?: Record<string, unknown>;
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
}

export interface OrchestrationAdapter {
  readonly name: string;
  create(input: OrchestrationOperationInput): Promise<OrchestrationOperation>;
  update(input: OrchestrationOperationInput): Promise<OrchestrationOperation>;
  restart(input: OrchestrationOperationInput): Promise<OrchestrationOperation>;
  destroy(input: OrchestrationOperationInput): Promise<OrchestrationOperation>;
  getStatus(operationId: string): Promise<OrchestrationOperation | null>;
}
