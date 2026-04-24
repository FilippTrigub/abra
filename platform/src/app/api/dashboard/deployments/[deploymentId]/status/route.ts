import { requireApiAuth, unauthenticatedResponse } from "@/lib/auth";
import { syncDeploymentStatusForUser } from "@/lib/deployments";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deploymentId: string }> },
) {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  const { deploymentId } = await params;
  try {
    const deployment = await syncDeploymentStatusForUser(authResult.user.id, deploymentId);

    if (!deployment) {
      return NextResponse.json(
        {
          error: {
            code: "DEPLOYMENT_NOT_FOUND",
            message: `No deployment request found for id "${deploymentId}".`,
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json(deployment);
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "DEPLOYMENT_STATUS_SYNC_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Unable to sync deployment status.",
        },
      },
      { status: 500 },
    );
  }
}
