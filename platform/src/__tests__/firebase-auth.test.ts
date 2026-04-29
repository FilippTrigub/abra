import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCookieStore = {
  delete: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
};

const mockGetUser = vi.fn();
const mockVerifySessionCookie = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: () => ({
    getUser: mockGetUser,
  }),
}));

vi.mock("@/lib/firebase/session", () => ({
  SESSION_COOKIE_NAME: "__session",
  verifySessionCookie: mockVerifySessionCookie,
}));

describe("firebase auth helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns a Firebase-backed user with a stable id field", async () => {
    mockCookieStore.get.mockReturnValue({ name: "__session", value: "session-cookie" });
    mockVerifySessionCookie.mockResolvedValue({
      email: "user@example.com",
      email_verified: true,
      name: "Filipp",
      uid: "firebase-uid",
    });
    mockGetUser.mockResolvedValue({
      displayName: "Filipp",
      email: "user@example.com",
      emailVerified: true,
      metadata: {
        lastSignInTime: "2026-04-23T10:00:00.000Z",
      },
      photoURL: "https://example.com/avatar.png",
      uid: "firebase-uid",
    });

    const { getUser } = await import("@/lib/auth/firebase-auth");
    const result = await getUser();

    expect(result).toEqual({
      error: null,
      user: {
        displayName: "Filipp",
        email: "user@example.com",
        emailVerified: true,
        id: "firebase-uid",
        last_sign_in_at: "2026-04-23T10:00:00.000Z",
        photoURL: "https://example.com/avatar.png",
        uid: "firebase-uid",
        user_metadata: {
          avatar_url: "https://example.com/avatar.png",
          email: "user@example.com",
          email_verified: true,
          name: "Filipp",
        },
      },
    });
  });

  it("returns a null user when there is no session cookie", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const { getUser } = await import("@/lib/auth/firebase-auth");
    const result = await getUser();

    expect(result).toEqual({ user: null, error: "No user found" });
    expect(mockVerifySessionCookie).not.toHaveBeenCalled();
  });

  it("surfaces verification failures as auth errors", async () => {
    mockCookieStore.get.mockReturnValue({ name: "__session", value: "broken-session" });
    mockVerifySessionCookie.mockRejectedValue(new Error("Session revoked"));

    const { getUser } = await import("@/lib/auth/firebase-auth");
    const result = await getUser();

    expect(result).toEqual({ user: null, error: "Session revoked" });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns the dev bypass user when DEV_AUTH_BYPASS is enabled in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEV_AUTH_BYPASS", "true");

    const { getUser } = await import("@/lib/auth/firebase-auth");
    const result = await getUser();

    expect(result).toEqual({
      error: null,
      user: {
        id: "dev-auth-bypass-user",
        uid: "dev-auth-bypass-user",
        email: "dev-auth-bypass@local.abra",
        emailVerified: true,
        displayName: "Dev Bypass User",
        photoURL: null,
        user_metadata: {
          email: "dev-auth-bypass@local.abra",
          email_verified: true,
          name: "Dev Bypass User",
        },
        last_sign_in_at: "1970-01-01T00:00:00.000Z",
      },
    });
    expect(mockVerifySessionCookie).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
