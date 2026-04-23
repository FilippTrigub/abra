/**
 * Server-only Firebase Admin SDK initialization.
 *
 * Initializes the Admin SDK using FIREBASE_* env vars (service account
 * credentials). Exports helper functions for auth and Firestore access.
 *
 * IMPORTANT:
 *   - This file uses `import 'server-only'` to prevent bundling in client code.
 *   - Must NEVER be imported in client components or routes that reach the browser.
 *   - Private key env var needs .replace(/\\n/g, '\n') for proper newline handling.
 */

import "server-only";

import * as admin from "firebase-admin";

import { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_EMULATOR_HOST } from "./env";

// ---------------------------------------------------------------------------
// Singleton initialization with admin.apps.length guard
// ---------------------------------------------------------------------------

if (admin.apps.length === 0) {
  // Convert escaped newlines in private key to actual newline characters
  const normalizedPrivateKey = FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") ?? "";

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: normalizedPrivateKey,
    }),
  });
}

if (FIREBASE_EMULATOR_HOST) {
  // Firestore emulator — no auth emulator for Admin SDK; custom token auth is required.
  admin.firestore().settings({
    host: FIREBASE_EMULATOR_HOST,
    port: 8080,
    forceSSL: true,
  });
}

// ---------------------------------------------------------------------------
// Helper functions (preferred over direct exports for testability)
// ---------------------------------------------------------------------------

/**
 * Returns the Firebase Admin Auth instance.
 * Callers should use this instead of importing getAuth directly.
 */
export function getAdminAuth(): admin.auth.Auth {
  return admin.auth();
}

/**
 * Returns the Firebase Admin Firestore instance.
 * Callers should use this instead of importing getFirestore directly.
 */
export function getAdminFirestore(): admin.firestore.Firestore {
  return admin.firestore();
}

export default admin;
