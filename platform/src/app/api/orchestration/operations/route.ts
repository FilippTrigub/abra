import { dispatchOrchestrationAction } from "@/lib/orchestration";
import type {
  MockOperationOutcome,
  OrchestrationAction,
  OrchestrationOperationInput,
} from "@/lib/orchestration";
import { requireApiAuth, unauthenticatedResponse } from "@/lib/auth";
import { evaluateOrchestrationGate, type OrchestrationGateDecision } from "@/lib/orchestration/gate";
import { NextResponse } from "next/server";

interface RouteRequestBody {
  action?: unknown;
  requestId?: unknown;
  accountId?: unknown;
  agentId?: unknown;
  deploymentId?: unknown;
  payload?: unknown;
  mockBehavior?: {
    outcome?: unknown;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAction(value: unknown): value is OrchestrationAction {
  return (
    value === "create" ||
    value === "update" ||
    value === "restart" ||
    value === "destroy"
  );
}

function isMockOutcome(value: unknown): value is MockOperationOutcome {
  return value === "succeeded" || value === "failed";
}

function validateString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value;
}

function optionalString(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return null;
  }

  return validateString(value, fieldName);
}

function toOperationInput(body: RouteRequestBody): {
  action: OrchestrationAction;
  input: OrchestrationOperationInput;
} {
  if (!isAction(body.action)) {
    throw new Error("action must be one of: create, update, restart, destroy.");
  }

  const payload = body.payload;
  if (payload !== undefined && !isRecord(payload)) {
    throw new Error("payload must be a JSON object when provided.");
  }

  const outcome = body.mockBehavior?.outcome;
  if (outcome !== undefined && !isMockOutcome(outcome)) {
    throw new Error('mockBehavior.outcome must be "succeeded" or "failed".');
  }

  return {
    action: body.action,
    input: {
      requestId: validateString(body.requestId, "requestId"),
      target: {
        accountId: validateString(body.accountId, "accountId"),
        agentId: optionalString(body.agentId, "agentId"),
        deploymentId: optionalString(body.deploymentId, "deploymentId"),
      },
      payload: payload ?? {},
      mockBehavior: outcome ? { outcome } : undefined,
    },
  };
}

function gateDeniedResponse(decision: OrchestrationGateDecision) {
  return NextResponse.json(
    {
      error: {
        code: decision.reasonCode,
        message: decision.message ?? "The orchestration operation is not allowed.",
      },
    },
    { status: decision.status },
  );
}

export async function POST(request: Request) {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  try {
    const rawBody = (await request.json()) as RouteRequestBody;
    const { action, input } = toOperationInput(rawBody);
    const gate = await evaluateOrchestrationGate({
      authUserId: authResult.user.id,
      operation: action,
      requestedAccountId: input.target.accountId,
    });

    if (!gate.allowed || !gate.accountId) {
      return gateDeniedResponse(gate);
    }

    const operation = await dispatchOrchestrationAction(action, {
      ...input,
      target: {
        ...input.target,
        accountId: gate.accountId,
      },
    });

    return NextResponse.json(operation, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";

    return NextResponse.json(
      {
        error: {
          code: "INVALID_ORCHESTRATION_REQUEST",
          message,
        },
      },
      { status: 400 },
    );
  }
}
