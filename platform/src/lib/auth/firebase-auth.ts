import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/firebase/session";
import { getDevBypassUser, isDevAuthBypassEnabled } from "./dev-bypass";

export interface AuthenticatedUser {
  id: string;
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  user_metadata: {
    name?: string;
    avatar_url?: string;
    email?: string;
    email_verified?: boolean;
  };
  last_sign_in_at?: string;
}

function mapFirebaseUser(
  decodedToken: Awaited<ReturnType<typeof verifySessionCookie>>,
  firebaseUser: Awaited<ReturnType<ReturnType<typeof getAdminAuth>["getUser"]>>,
): AuthenticatedUser {
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? decodedToken.email ?? null,
    emailVerified: firebaseUser.emailVerified ?? Boolean(decodedToken.email_verified),
    displayName: firebaseUser.displayName ?? (typeof decodedToken.name === "string" ? decodedToken.name : null),
    photoURL: firebaseUser.photoURL ?? null,
    user_metadata: {
      avatar_url: firebaseUser.photoURL ?? undefined,
      email: firebaseUser.email ?? decodedToken.email,
      email_verified: firebaseUser.emailVerified ?? decodedToken.email_verified,
      name:
        firebaseUser.displayName ??
        (typeof decodedToken.name === "string" ? decodedToken.name : undefined),
    },
    last_sign_in_at: firebaseUser.metadata.lastSignInTime ?? undefined,
  };
}

export async function getUser(): Promise<{ user: AuthenticatedUser | null; error: string | null }> {
  if (isDevAuthBypassEnabled()) {
    return { user: getDevBypassUser(), error: null };
  }

  try {
    const cookieStore = await import("next/headers").then((m) => m.cookies());
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return { user: null, error: "No user found" };
    }

    const decodedToken = await verifySessionCookie(sessionCookie);
    const firebaseUser = await getAdminAuth().getUser(decodedToken.uid);

    return { user: mapFirebaseUser(decodedToken, firebaseUser), error: null };
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error.message : "Auth not configured",
    };
  }
}
