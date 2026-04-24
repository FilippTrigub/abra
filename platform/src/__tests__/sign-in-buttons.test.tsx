import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSetPersistence = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockClientSignOut = vi.fn();

class MockGoogleAuthProvider {}
class MockGithubAuthProvider {}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/firebase/client", () => ({
  auth: { name: "firebase-auth-instance" },
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: MockGoogleAuthProvider,
  GithubAuthProvider: MockGithubAuthProvider,
  inMemoryPersistence: { kind: "in-memory" },
  setPersistence: mockSetPersistence,
  signInWithPopup: mockSignInWithPopup,
  signOut: mockClientSignOut,
}));

describe("SignInButtons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the existing provider labels", async () => {
    const { SignInButtons } = await import("@/app/(auth)/sign-in/sign-in-buttons");

    render(<SignInButtons />);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeTruthy();
  });

  it("posts the Firebase ID token to the session route and navigates to the dashboard", async () => {
    const getIdToken = vi.fn().mockResolvedValue("firebase-id-token");
    mockSignInWithPopup.mockResolvedValue({
      user: { getIdToken },
    });
    mockClientSignOut.mockResolvedValue(undefined);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { SignInButtons } = await import("@/app/(auth)/sign-in/sign-in-buttons");

    render(<SignInButtons />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(mockSetPersistence).toHaveBeenCalled();
      expect(mockSignInWithPopup).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken: "firebase-id-token" }),
      });
      expect(mockClientSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
