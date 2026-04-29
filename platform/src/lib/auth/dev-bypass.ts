import type { AuthenticatedUser } from "./firebase-auth";

const DEV_AUTH_BYPASS_ENABLED =
  process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true";

const DEV_BYPASS_USER: AuthenticatedUser = {
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
  last_sign_in_at: new Date(0).toISOString(),
};

export function isDevAuthBypassEnabled(): boolean {
  return DEV_AUTH_BYPASS_ENABLED;
}

export function getDevBypassUser(): AuthenticatedUser {
  return DEV_BYPASS_USER;
}
