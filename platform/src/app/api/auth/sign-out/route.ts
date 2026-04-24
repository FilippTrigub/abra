import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/firebase/session";

async function clearSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    try {
      const decodedToken = await verifySessionCookie(sessionCookie);
      await getAdminAuth().revokeRefreshTokens(decodedToken.uid);
    } catch {
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);

  return NextResponse.json({ ok: true });
}

export async function POST() {
  return clearSession();
}

export async function DELETE() {
  return clearSession();
}
