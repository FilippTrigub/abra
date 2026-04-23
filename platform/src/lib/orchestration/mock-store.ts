import type {
  MockOperationOutcome,
  OrchestrationAction,
  OrchestrationOperation,
  OrchestrationOperationInput,
  OrchestrationOperationResult,
  OrchestrationOperationStatus,
  OrchestrationOperationStep,
} from "./types";

const MOCK_PHASES = {
  queuedMs: 800,
  runningMs: 1600,
} as const;

interface MockOperationRecord {
  operationId: string;
  action: OrchestrationAction;
  input: OrchestrationOperationInput;
  createdAtMs: number;
  outcome: MockOperationOutcome;
}

const operationStore = new Map<string, MockOperationRecord>();

function getTerminalStatus(
  outcome: MockOperationOutcome,
): OrchestrationOperationStatus {
  return outcome === "failed" ? "failed" : "succeeded";
}

function summarizeAction(action: OrchestrationAction) {
  switch (action) {
    case "create":
      return "provision deployment";
    case "update":
      return "apply configuration update";
    case "restart":
      return "restart runtime";
    case "destroy":
      return "tear down runtime";
  }
}

function buildResult(record: MockOperationRecord): OrchestrationOperationResult {
  const resourceId =
    record.input.target.agentId ?? record.input.target.deploymentId ?? record.operationId;

  switch (record.action) {
    case "create":
      return {
        message: "Mock deployment is ready.",
        resourceHandle: `mock-agent/${resourceId}`,
        metadata: {
          runtimeState: "ready",
        },
      };
    case "update":
      return {
        message: "Mock configuration update applied.",
        resourceHandle: `mock-agent/${resourceId}`,
        metadata: {
          runtimeState: "updated",
        },
      };
    case "restart":
      return {
        message: "Mock runtime restarted.",
        resourceHandle: `mock-agent/${resourceId}`,
        metadata: {
          runtimeState: "restarted",
        },
      };
    case "destroy":
      return {
        message: "Mock runtime destroyed.",
        resourceHandle: `mock-agent/${resourceId}`,
        metadata: {
          runtimeState: "deleted",
        },
      };
  }
}

function getOperationStatus(
  elapsedMs: number,
  outcome: MockOperationOutcome,
): OrchestrationOperationStatus {
  if (elapsedMs < MOCK_PHASES.queuedMs) {
    return "queued";
  }

  if (elapsedMs < MOCK_PHASES.runningMs) {
    return "running";
  }

  return getTerminalStatus(outcome);
}

function toIso(ms: number) {
  return new Date(ms).toISOString();
}

function buildSteps(
  record: MockOperationRecord,
  status: OrchestrationOperationStatus,
): OrchestrationOperationStep[] {
  const actionSummary = summarizeAction(record.action);
  const steps: OrchestrationOperationStep[] = [
    {
      status: "queued",
      at: toIso(record.createdAtMs),
      summary: `Mock adapter queued request to ${actionSummary}.`,
    },
  ];

  if (status === "running" || status === "succeeded" || status === "failed") {
    steps.push({
      status: "running",
      at: toIso(record.createdAtMs + MOCK_PHASES.queuedMs),
      summary: `Mock adapter is processing the request to ${actionSummary}.`,
    });
  }

  if (status === "succeeded") {
    steps.push({
      status: "succeeded",
      at: toIso(record.createdAtMs + MOCK_PHASES.runningMs),
      summary: `Mock adapter completed the request to ${actionSummary}.`,
    });
  }

  if (status === "failed") {
    steps.push({
      status: "failed",
      at: toIso(record.createdAtMs + MOCK_PHASES.runningMs),
      summary: `Mock adapter failed the request to ${actionSummary}.`,
    });
  }

  return steps;
}

function getUpdatedAt(record: MockOperationRecord, status: OrchestrationOperationStatus) {
  if (status === "queued") {
    return toIso(record.createdAtMs);
  }

  if (status === "running") {
    return toIso(record.createdAtMs + MOCK_PHASES.queuedMs);
  }

  return toIso(record.createdAtMs + MOCK_PHASES.runningMs);
}

function getPollAfterMs(elapsedMs: number, status: OrchestrationOperationStatus) {
  if (status === "queued") {
    return Math.max(0, MOCK_PHASES.queuedMs - elapsedMs);
  }

  if (status === "running") {
    return Math.max(0, MOCK_PHASES.runningMs - elapsedMs);
  }

  return 0;
}

export function createMockOperation(
  action: OrchestrationAction,
  input: OrchestrationOperationInput,
) {
  const operationId = crypto.randomUUID();
  const record: MockOperationRecord = {
    operationId,
    action,
    input,
    createdAtMs: Date.now(),
    outcome: input.mockBehavior?.outcome ?? "succeeded",
  };

  operationStore.set(operationId, record);
  return buildMockOperation(record);
}

export function readMockOperation(operationId: string) {
  const record = operationStore.get(operationId);

  if (!record) {
    return null;
  }

  return buildMockOperation(record);
}

function buildMockOperation(record: MockOperationRecord): OrchestrationOperation {
  const elapsedMs = Math.max(0, Date.now() - record.createdAtMs);
  const status = getOperationStatus(elapsedMs, record.outcome);
  const completedAt =
    status === "succeeded" || status === "failed"
      ? toIso(record.createdAtMs + MOCK_PHASES.runningMs)
      : null;

  return {
    operationId: record.operationId,
    adapter: "mock",
    action: record.action,
    requestId: record.input.requestId,
    target: record.input.target,
    payload: record.input.payload,
    status,
    createdAt: toIso(record.createdAtMs),
    updatedAt: getUpdatedAt(record, status),
    completedAt,
    pollAfterMs: getPollAfterMs(elapsedMs, status),
    steps: buildSteps(record, status),
    error:
      status === "failed"
        ? {
            code: "MOCK_OPERATION_FAILED",
            message:
              "Mock adapter was instructed to fail this operation for local verification.",
          }
        : null,
    result: status === "succeeded" ? buildResult(record) : null,
  };
}
