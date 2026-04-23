import { getUser } from "@/lib/auth/supabase-client";
import { syncDeploymentStatusForUser } from "@/lib/deployments";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ deploymentId: string }> },
) {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "You must be signed in to view deployment status.",
        },
      },
      { status: 401 },
    );
  }

  const { deploymentId } = await params;
  try {
    const deployment = await syncDeploymentStatusForUser(user.id, deploymentId);

    if (!deployment) {
      return NextResponse.json(
        {
          error: {
            code: "DEPLOYMENT_NOT_FOUND",
            message: `No deployment request found for id \"${deploymentId}\".`,
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
