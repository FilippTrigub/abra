import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { requireAuth, requireApiAuth, requireOwnership, checkOwnershipJson } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/supabase-client";

// Mock dependencies
vi.mock("next/navigation", () => {
  const original = vi.importActual("next/navigation");
  return {
    ...original,
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT: ${url}`);
    }),
  };
});

vi.mock("@/lib/auth/supabase-client", () => ({
  getUser: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((data: unknown, opts?: { status?: number; headers?: HeadersInit }) => {
      const headers = new Map<string, string>();
      if (opts?.headers && typeof opts.headers === "object") {
        for (const [key, value] of Object.entries(opts.headers)) {
          headers.set(key, String(value));
        }
      }
      return {
        status: opts?.status ?? 200,
        headers: {
          get: (name: string) => headers.get(name) ?? null,
        },
        _data: data,
      };
    }),
  },
}));

describe("T8 Auth Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireAuth", () => {
    it("should return user when authenticated", async () => {
      const mockUser = {
        id: "user123",
        uid: "user123",
        email: "test@example.com",
        emailVerified: true,
        displayName: "Test User",
        photoURL: null,
        user_metadata: { name: "Test User" },
      };

      vi.mocked(getUser).mockResolvedValue({ user: mockUser, error: null });

      const result = await requireAuth();

      expect(result).toEqual(mockUser);
      expect(redirect).not.toHaveBeenCalled();
    });

    it("should redirect when no user", async () => {
      vi.mocked(getUser).mockResolvedValue({ user: null, error: "No user found" });

      await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT: /sign-in");

      expect(redirect).toHaveBeenCalledWith("/sign-in");
    });

    it("should redirect when getUser throws error", async () => {
      vi.mocked(getUser).mockResolvedValue({ user: null, error: "Auth not configured" });

      await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT: /sign-in");

      expect(redirect).toHaveBeenCalledWith("/sign-in");
    });
  });

  describe("requireApiAuth", () => {
    it("should return user object when authenticated", async () => {
      const mockUser = {
        id: "user123",
        uid: "user123",
        email: "test@example.com",
        emailVerified: true,
        displayName: "Test User",
        photoURL: null,
        user_metadata: { name: "Test User" },
      };

      vi.mocked(getUser).mockResolvedValue({ user: mockUser, error: null });

      const result = await requireApiAuth();

      if ("error" in result) {
        throw new Error("Expected user, got error");
      }
      expect(result.user.id).toBe("user123");
    });

    it("should return error object when unauthenticated", async () => {
      vi.mocked(getUser).mockResolvedValue({ user: null, error: "No user found" });

      const result = await requireApiAuth();

      if ("user" in result) {
        throw new Error("Expected error, got user");
      }
      expect(result.error).toBe("Unauthorized");
    });
  });

  describe("requireOwnership", () => {
    it("should not throw when ownership matches", () => {
      expect(() => requireOwnership("user123", "user123")).not.toThrow();
    });

    it("should throw when ownership does not match", () => {
      expect(() => requireOwnership("user123", "user456")).toThrow();
    });

    it("should throw when resourceOwnerId is null", () => {
      expect(() => requireOwnership("user123", null)).toThrow();
    });

    it("should throw when resourceOwnerId is undefined", () => {
      expect(() => requireOwnership("user123", undefined)).toThrow();
    });
  });

  describe("checkOwnershipJson", () => {
    it("should return true when ownership matches", () => {
      expect(checkOwnershipJson("user123", "user123")).toBe(true);
    });

    it("should return false when ownership does not match", () => {
      expect(checkOwnershipJson("user123", "user456")).toBe(false);
    });

    it("should return false when resourceOwnerId is null", () => {
      expect(checkOwnershipJson("user123", null)).toBe(false);
    });
  });
});
