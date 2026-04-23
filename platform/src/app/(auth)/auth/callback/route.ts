import { createSupabaseServerClient } from "@/lib/auth/supabase-client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_oauth_code", request.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_exchange_failed", request.url),
    );
  }

  return NextResponse.redirect(new URL("/dashboard", new URL(request.url).origin));
}
