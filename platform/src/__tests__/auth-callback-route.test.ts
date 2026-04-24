import { describe, expect, it } from "vitest";

describe("auth callback route", () => {
  it("redirects provider errors back to sign-in with a controlled callback error", async () => {
    const { GET } = await import("@/app/(auth)/auth/callback/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/callback?error=access_denied&error_description=Cancelled",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?error=oauth_callback_failed",
    );
  });

  it("redirects legacy OAuth code callbacks back to sign-in without exchanging sessions", async () => {
    const { GET } = await import("@/app/(auth)/auth/callback/route");
    const response = await GET(
      new Request("http://localhost:3000/auth/callback?code=legacy-supabase-code"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?error=oauth_callback_not_supported",
    );
  });

  it("still handles malformed callback requests without query params", async () => {
    const { GET } = await import("@/app/(auth)/auth/callback/route");
    const response = await GET(new Request("http://localhost:3000/auth/callback"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?error=missing_oauth_code",
    );
  });
});
