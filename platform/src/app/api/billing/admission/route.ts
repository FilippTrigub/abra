import { NextResponse } from "next/server";

import { ManagedRuntimeAdmissionService } from "@/lib/billing/managed-admission";

interface AdmissionRequestBody {
  accountId?: unknown;
  deploymentId?: unknown;
  requestId?: unknown;
  channelMessageId?: unknown;
}

function readRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readBearerCredential(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  return authorization.startsWith(prefix) ? authorization.slice(prefix.length).trim() : null;
}

export async function POST(request: Request) {
  const credential = readBearerCredential(request);
  if (!credential) {
    return NextResponse.json(
      {
        allow: false,
        error: {
          code: "unauthorized",
          message: "Runtime admission credential is required.",
        },
      },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as AdmissionRequestBody;
    const decision = await new ManagedRuntimeAdmissionService().reserve({
      credential,
      accountId: readRequiredString(body.accountId, "accountId"),
      deploymentId: readRequiredString(body.deploymentId, "deploymentId"),
      requestId: readRequiredString(body.requestId, "requestId"),
      channelMessageId: readOptionalString(body.channelMessageId),
    });

    return NextResponse.json(
      {
        allow: decision.allow,
        reasonCode: decision.reasonCode,
        message: decision.message,
        eventId: decision.reservation?.eventId ?? null,
        duplicate: decision.reservation?.duplicate ?? false,
        used: decision.reservation?.used ?? null,
        limit: decision.reservation?.limit ?? null,
      },
      { status: decision.status },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid admission request.";
    return NextResponse.json(
      {
        allow: false,
        error: {
          code: "invalid_request",
          message,
        },
      },
      { status: 400 },
    );
  }
}
