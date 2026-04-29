/**
 * Re-exports auth utilities for convenience.
 * The main entry point is `firebase-auth.ts` — this module
 * exists so callers can do `import { getUser } from "@/lib/auth"`
 * instead of the deeper path.
 */
export { getUser } from "./firebase-auth";
export type { AuthenticatedUser } from "./firebase-auth";
export {
  requireAuth,
  requireApiAuth,
  requireOwnership,
  checkOwnershipJson,
  unauthenticatedResponse,
  permissionDeniedResponse,
} from "./session";
