import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCookieStore = {
  delete: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(() => []),
  set: vi.fn(),
};

const mockCreateServerClient = vi.fn();
const mockGetUser = vi.fn();
const mockVerifySessionCookie = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
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

describe("auth helper compatibility shim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieStore.getAll.mockReturnValue([]);
  });

  it("createSupabaseServerClient is deprecated and returns a placeholder", async () => {
    const { createSupabaseServerClient } = await import("@/lib/auth/supabase-client");
    const client = await createSupabaseServerClient();

    expect(client).toHaveProperty("auth");
    expect(client).toHaveProperty("from");
    expect(mockCreateServerClient).not.toHaveBeenCalled();
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

    const { getUser } = await import("@/lib/auth/supabase-client");
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

    const { getUser } = await import("@/lib/auth/supabase-client");
    const result = await getUser();

    expect(result).toEqual({ user: null, error: "No user found" });
    expect(mockVerifySessionCookie).not.toHaveBeenCalled();
  });

  it("surfaces verification failures as auth errors", async () => {
    mockCookieStore.get.mockReturnValue({ name: "__session", value: "broken-session" });
    mockVerifySessionCookie.mockRejectedValue(new Error("Session revoked"));

    const { getUser } = await import("@/lib/auth/supabase-client");
    const result = await getUser();

    expect(result).toEqual({ user: null, error: "Session revoked" });
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
