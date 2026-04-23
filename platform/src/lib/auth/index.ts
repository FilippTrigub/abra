/**
 * Re-exports auth utilities for convenience.
 * The main entry point is `supabase-client.ts` — this module
 * exists so callers can do `import { getUser } from "@/lib/auth"`
 * instead of the deeper path.
 */
export { createSupabaseServerClient, getUser } from "./supabase-client";
export type { User } from "@supabase/supabase-js";
