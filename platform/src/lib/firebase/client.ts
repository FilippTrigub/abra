/**
 * Browser-only Firebase initialization.
 *
 * Initializes the Firebase app using NEXT_PUBLIC_FIREBASE_* env vars exported
 * to the browser. Exports initialized auth, firestore, and app instances.
 *
 * This file must NOT import firebase-admin (server-only).
 * Use firebase/admin.ts for server-side initialization.
 */

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { connectAuthEmulator } from "firebase/auth";

import { getFirebaseConfig, isDevMode, FIREBASE_EMULATOR_HOST } from "./env";

let app: ReturnType<typeof initializeApp>;

if (getApps().length === 0) {
  const config = getFirebaseConfig();
  app = initializeApp(config);
} else {
  app = getApps()[0];
}

/** Firebase Auth instance. */
export const auth = getAuth(app);

/** Firestore instance. */
export const firestore = getFirestore(app);

/** The initialized Firebase app instance. */
export { app };

if (isDevMode() && FIREBASE_EMULATOR_HOST) {
  connectAuthEmulator(auth, `http://${FIREBASE_EMULATOR_HOST}:9099`);
}

export default app;
