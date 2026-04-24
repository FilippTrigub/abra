import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerError = searchParams.get("error");
  const code = searchParams.get("code");

  if (providerError) {
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_callback_failed", request.url),
    );
  }

  if (code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_callback_not_supported", request.url),
    );
  }

  return NextResponse.redirect(
    new URL("/sign-in?error=missing_oauth_code", request.url),
  );
}
