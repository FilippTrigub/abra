import { dispatchOrchestrationAction } from "@/lib/orchestration";
import type {
  MockOperationOutcome,
  OrchestrationAction,
  OrchestrationOperationInput,
} from "@/lib/orchestration";
import { getUser } from "@/lib/auth/supabase-client";
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

export async function POST(request: Request) {
  const { user, error: authError } = await getUser();

  if (authError || !user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "You must be signed in to dispatch orchestration operations.",
        },
      },
      { status: 401 },
    );
  }

  try {
    const rawBody = (await request.json()) as RouteRequestBody;
    const { action, input } = toOperationInput(rawBody);
    const operation = await dispatchOrchestrationAction(action, input);

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
