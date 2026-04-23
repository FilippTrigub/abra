import { describe, it, expect } from "vitest";
import { createSupabaseServerClient, getUser } from "@/lib/auth/supabase-client";

describe("Supabase client module", () => {
  it("should export createSupabaseServerClient function", () => {
    expect(typeof createSupabaseServerClient).toBe("function");
  });

  it("should export getUser function", () => {
    expect(typeof getUser).toBe("function");
  });

  it("should load without throwing (module validation)", () => {
    expect(() => {
      require("@/lib/auth/supabase-client");
    }).not.toThrow();
  });
});
