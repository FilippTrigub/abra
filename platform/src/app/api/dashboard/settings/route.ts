import { NextResponse } from "next/server";

import { requireApiAuth, unauthenticatedResponse } from "@/lib/auth";
import { loadSettings as dbLoadSettings, saveSettings as dbSaveSettings, revertSettings as dbRevertSettings } from "@/lib/settings/service";
import type { SettingsUpdatePayload } from "@/lib/settings/schema";

export async function GET() {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  const response = await dbLoadSettings(authResult.user.id);
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  let body: SettingsUpdatePayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.key || body.value === undefined) {
    return NextResponse.json(
      { error: "Missing key or value" },
      { status: 400 },
    );
  }

  const result = await dbSaveSettings(authResult.user.id, body);
  return NextResponse.json(result);
}

export async function PUT() {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  const result = await dbRevertSettings(authResult.user.id);
  return NextResponse.json(result);
}
