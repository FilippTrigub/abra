import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  createSessionCookie,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/firebase/session";

interface SessionRequestBody {
  idToken?: unknown;
}

export async function POST(request: Request) {
  let body: SessionRequestBody;

  try {
    body = (await request.json()) as SessionRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.idToken !== "string" || body.idToken.length === 0) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  try {
    const sessionCookie = await createSessionCookie(body.idToken);
    const cookieStore = await cookies();
    const cookieOptions = getSessionCookieOptions();

    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, cookieOptions);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to establish session",
      },
      { status: 401 },
    );
  }
}
