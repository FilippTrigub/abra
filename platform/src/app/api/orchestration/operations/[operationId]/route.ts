import { getOrchestrationAdapter } from "@/lib/orchestration";
import { getUser } from "@/lib/auth/supabase-client";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ operationId: string }> },
) {
  const { user, error: authError } = await getUser();

  if (authError || !user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "You must be signed in to view orchestration status.",
        },
      },
      { status: 401 },
    );
  }

  const { operationId } = await params;
  const adapter = getOrchestrationAdapter();
  const operation = await adapter.getStatus(operationId);

  if (!operation) {
    return NextResponse.json(
      {
        error: {
          code: "ORCHESTRATION_OPERATION_NOT_FOUND",
          message: `No orchestration operation found for id \"${operationId}\".`,
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json(operation);
}
