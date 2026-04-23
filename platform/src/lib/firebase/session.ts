/**
 * Server-side Firebase session cookie utilities.
 *
 * Provides functions to create, verify, and clear session cookies backed by
 * Firebase Admin SDK. The session cookie name is `__session`.
 *
 * IMPORTANT:
 *   - This file uses `import 'server-only'` to prevent bundling in client code.
 *   - Must NEVER be imported in client components or routes that reach the browser.
 */

import "server-only";

import { NextResponse } from "next/server";

import { getAdminAuth } from "./admin";
import { DecodedIdToken, DEFAULT_SESSION_EXPIRY_MS } from "./env";

// Session cookie name used by the application
const SESSION_COOKIE_NAME = "__session";

/**
 * Verifies a Firebase ID token and creates a session cookie.
 *
 * @param idToken — The ID token obtained from the client (e.g. via signInWithCredential).
 * @param expiresInMs — Session TTL in milliseconds. Defaults to 5 days.
 *   Must be between 5 minutes (300000) and 14 days (1209600000).
 * @returns The signed session cookie string.
 * @throws If token verification or cookie creation fails.
 */
export async function createSessionCookie(
  idToken: string,
  expiresInMs: number = DEFAULT_SESSION_EXPIRY_MS,
): Promise<string> {
  const decodedToken = await getAdminAuth().verifyIdToken(idToken);

  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: expiresInMs,
  });
}

/**
 * Verifies a Firebase session cookie and returns the decoded claims.
 *
 * @param cookie — The session cookie string from the request.
 * @returns The decoded ID token claims (DecodedIdToken).
 * @throws If the cookie is invalid or expired.
 */
export async function verifySessionCookie(
  cookie: string,
): Promise<DecodedIdToken> {
  // strict: true — also checks that the token has not been revoked
  const decoded = await getAdminAuth().verifyIdToken(cookie, true);
  return decoded as DecodedIdToken;
}

/**
 * Returns a NextResponse that clears the session cookie.
 *
 * Use this in middleware or route handlers to sign out the user:
 *   return clearSessionCookie();
 *
 * @returns A NextResponse with the `__session` cookie cleared (maxAge=0).
 */
export function clearSessionCookie(): NextResponse {
  return NextResponse.next({
    headers: new Headers({
      "Set-Cookie": `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    }),
  });
}

export { SESSION_COOKIE_NAME };
