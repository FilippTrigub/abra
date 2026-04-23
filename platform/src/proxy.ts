import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export default async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const { data: { user } } = await supabase.auth.getUser();

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
