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

import { getFirebaseAdminConfig, getFirebaseEmulatorHost } from "./env";

function ensureAdminApp() {
  if (admin.apps.length > 0) {
    return;
  }

  const { projectId, clientEmail, privateKey } = getFirebaseAdminConfig();

  // Convert escaped newlines in private key to actual newline characters
  const normalizedPrivateKey = privateKey.replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: normalizedPrivateKey,
    }),
  });

  admin.firestore().settings({ ignoreUndefinedProperties: true });

  const emulatorHost = getFirebaseEmulatorHost();

  if (emulatorHost) {
    // Firestore emulator — no auth emulator for Admin SDK; custom token auth is required.
    admin.firestore().settings({
      host: emulatorHost,
      port: 8080,
      forceSSL: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Helper functions (preferred over direct exports for testability)
// ---------------------------------------------------------------------------

/**
 * Returns the Firebase Admin Auth instance.
 * Callers should use this instead of importing getAuth directly.
 */
export function getAdminAuth(): admin.auth.Auth {
  ensureAdminApp();
  return admin.auth();
}

/**
 * Returns the Firebase Admin Firestore instance.
 * Callers should use this instead of importing getFirestore directly.
 */
export function getAdminFirestore(): admin.firestore.Firestore {
  ensureAdminApp();
  return admin.firestore();
}

export default admin;
