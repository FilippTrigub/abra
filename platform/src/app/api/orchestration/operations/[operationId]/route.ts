import { getOrchestrationAdapter } from "@/lib/orchestration";
import { requireApiAuth, unauthenticatedResponse, permissionDeniedResponse } from "@/lib/auth";
import { firestoreOperationStore } from "@/lib/orchestration/firestore-operation-store";
import { getPlatformAccount } from "@/lib/platform-account";
import { NextResponse } from "next/server";

function isTerminalOperationStatus(status: "queued" | "running" | "succeeded" | "failed") {
  return status === "succeeded" || status === "failed";
}

async function resolveAuthorizedAccountScopes(authUserId: string) {
  const scopes = new Set<string>([authUserId]);
  const account = await getPlatformAccount(authUserId);

  if (account?.id) {
    scopes.add(account.id);
  }

  return scopes;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ operationId: string }> },
) {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  const { operationId } = await params;
  try {
    const authorizedAccountScopes = await resolveAuthorizedAccountScopes(authResult.user.id);
    const persistedOperation = await firestoreOperationStore.getStatus(operationId);

    if (
      persistedOperation &&
      !authorizedAccountScopes.has(persistedOperation.target.accountId)
    ) {
      return permissionDeniedResponse();
    }

    const adapter = getOrchestrationAdapter();
    const shouldRefreshLiveStatus =
      !persistedOperation ||
      (persistedOperation.adapter === adapter.name &&
        !isTerminalOperationStatus(persistedOperation.status));
    const operation = shouldRefreshLiveStatus
      ? (await adapter.getStatus(operationId)) ?? persistedOperation
      : persistedOperation;

    if (!operation) {
      return NextResponse.json(
        {
          error: {
            code: "ORCHESTRATION_OPERATION_NOT_FOUND",
            message: `No orchestration operation found for id "${operationId}".`,
          },
        },
        { status: 404 },
      );
    }

    // Ownership check: only the owner can view the operation
    if (!authorizedAccountScopes.has(operation.target.accountId)) {
      return permissionDeniedResponse();
    }

    return NextResponse.json(operation);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "ORCHESTRATION_OPERATION_STATUS_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load orchestration operation status.",
        },
      },
      { status: 500 },
    );
  }
}
