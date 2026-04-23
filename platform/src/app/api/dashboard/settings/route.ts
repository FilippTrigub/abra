import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/supabase-client";
import { loadSettings as dbLoadSettings, saveSettings as dbSaveSettings, revertSettings as dbRevertSettings } from "@/lib/settings/service";
import type { SettingsUpdatePayload } from "@/lib/settings/schema";

export async function GET() {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const response = await dbLoadSettings(user.id);
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
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

  const result = await dbSaveSettings(user.id, body, undefined);
  return NextResponse.json(result);
}

export async function PUT() {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const result = await dbRevertSettings(user.id);
  return NextResponse.json(result);
}
