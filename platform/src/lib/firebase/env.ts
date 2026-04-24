/**
 * Firebase environment variable validation.
 *
 * Reads and validates all required Firebase environment variables at module load time.
 * Throws descriptive errors if any required variable is missing.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads a required environment variable. Throws if missing or empty.
 * Provides runtime validation + TypeScript type narrowing in one call.
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required Firebase env var: ${name}. See platform/.env.example for all required variables.`,
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Required env vars — validated at module load time
// ---------------------------------------------------------------------------

/** Browser-facing env vars — safe to expose in client bundles (NEXT_PUBLIC_*). */
function getRequiredPublicEnv(name: string): string {
  return getRequiredEnv(name);
}

/** Optional env vars. */
const FIREBASE_SESSION_EXPIRY_MS = process.env.FIREBASE_SESSION_EXPIRY_MS
  ? parseInt(process.env.FIREBASE_SESSION_EXPIRY_MS, 10)
  : 432000000; // default: 5 days

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** Typed Firebase configuration object for browser SDK. */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/** Decoded Firebase session cookie / ID token claims. */
export interface DecodedIdToken {
  uid: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  auth_time: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  sub: string;
  [claim: string]: unknown;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when running in dev mode (Firebase emulator is configured).
 */
export function isDevMode(): boolean {
  return Boolean(getFirebaseEmulatorHost());
}

/**
 * Returns a typed FirebaseConfig object for browser SDK initialization.
 */
export function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: getRequiredPublicEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
  };
}

export function getFirebaseAdminConfig(): FirebaseAdminConfig {
  return {
    projectId: getRequiredEnv("FIREBASE_PROJECT_ID"),
    clientEmail: getRequiredEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: getRequiredEnv("FIREBASE_PRIVATE_KEY"),
  };
}

export function getFirebaseEmulatorHost() {
  return process.env.FIREBASE_EMULATOR_HOST;
}

/** Session cookie TTL in milliseconds. Defaults to 5 days (432000000). */
export const DEFAULT_SESSION_EXPIRY_MS: number = FIREBASE_SESSION_EXPIRY_MS;
