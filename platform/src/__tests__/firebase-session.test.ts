import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCookieStore = {
  delete: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
};

const mockCreateSessionCookie = vi.fn();
const mockVerifySessionCookie = vi.fn();
const mockRevokeRefreshTokens = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock("@/lib/firebase/session", () => ({
  createSessionCookie: mockCreateSessionCookie,
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    maxAge: 432000,
    path: "/",
    sameSite: "lax",
    secure: false,
  })),
  SESSION_COOKIE_NAME: "__session",
  verifySessionCookie: mockVerifySessionCookie,
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({
    revokeRefreshTokens: mockRevokeRefreshTokens,
  }),
}));

describe("Firebase session routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("establishes a __session cookie from an ID token", async () => {
    mockCreateSessionCookie.mockResolvedValue("signed-session-cookie");

    const { POST } = await import("@/app/api/auth/session/route");
    const response = await POST(
      new Request("http://localhost:3000/api/auth/session", {
        body: JSON.stringify({ idToken: "firebase-id-token" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockCreateSessionCookie).toHaveBeenCalledWith("firebase-id-token");
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "__session",
      "signed-session-cookie",
      expect.objectContaining({
        httpOnly: true,
        maxAge: 432000,
        path: "/",
        sameSite: "lax",
      }),
    );
  });

  it("rejects malformed session requests", async () => {
    const { POST } = await import("@/app/api/auth/session/route");
    const response = await POST(
      new Request("http://localhost:3000/api/auth/session", {
        body: JSON.stringify({ nope: true }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing idToken" });
    expect(mockCreateSessionCookie).not.toHaveBeenCalled();
  });

  it("clears the cookie and revokes refresh tokens on sign-out", async () => {
    mockCookieStore.get.mockReturnValue({ name: "__session", value: "signed-session-cookie" });
    mockVerifySessionCookie.mockResolvedValue({ uid: "firebase-uid" });

    const { POST } = await import("@/app/api/auth/sign-out/route");
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockVerifySessionCookie).toHaveBeenCalledWith("signed-session-cookie");
    expect(mockRevokeRefreshTokens).toHaveBeenCalledWith("firebase-uid");
    expect(mockCookieStore.delete).toHaveBeenCalledWith("__session");
  });

  it("still clears the cookie when the session is invalid", async () => {
    mockCookieStore.get.mockReturnValue({ name: "__session", value: "broken-session" });
    mockVerifySessionCookie.mockRejectedValue(new Error("Session expired"));

    const { DELETE } = await import("@/app/api/auth/sign-out/route");
    const response = await DELETE();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("__session");
  });
});
