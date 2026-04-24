import { getOrchestrationAdapter } from "@/lib/orchestration";
import { requireApiAuth, unauthenticatedResponse, permissionDeniedResponse } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ operationId: string }> },
) {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  const { operationId } = await params;
  const adapter = getOrchestrationAdapter();
  const operation = await adapter.getStatus(operationId);

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
  if (operation.target.accountId !== authResult.user.id) {
    return permissionDeniedResponse();
  }

  return NextResponse.json(operation);
}
