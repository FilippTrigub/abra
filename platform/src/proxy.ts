import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/auth/supabase-client";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";

export default async function proxy(request: NextRequest) {
  if (isDevAuthBypassEnabled()) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  try {
    const { user } = await getUser();

    const isAuthPage = request.nextUrl.pathname.startsWith("/sign-in");
    const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

    if (!user && isDashboard) {
      const redirectUrl = new URL("/sign-in", request.url);
      redirectUrl.searchParams.set("from", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (user && isAuthPage) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  } catch {
    // Auth not configured — proceed without auth checks.
    // Per-route guards (dashboard layout) handle fallback.
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in"],
};
