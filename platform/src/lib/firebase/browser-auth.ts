import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

import type { FirebaseConfig } from "./env";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function getFirebaseAuth(config: FirebaseConfig): Auth {
  if (!app) {
    app = initializeApp(config);
  }

  if (!auth) {
    auth = getAuth(app);
  }

  return auth;
}
