import { describe, expect, it, vi } from "vitest";

describe("Firebase public env access", () => {
  it("reads NEXT_PUBLIC Firebase vars via static env access", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "api-key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "example.firebaseapp.com");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "project-id");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "bucket");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "sender-id");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "app-id");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID", "measurement-id");

    const { getFirebaseConfig } = await import("@/lib/firebase/env");

    expect(getFirebaseConfig()).toEqual({
      apiKey: "api-key",
      authDomain: "example.firebaseapp.com",
      projectId: "project-id",
      storageBucket: "bucket",
      messagingSenderId: "sender-id",
      appId: "app-id",
      measurementId: "measurement-id",
    });

    vi.unstubAllEnvs();
  });

  it("throws a descriptive error when a required public env var is missing", async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "example.firebaseapp.com");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "project-id");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "bucket");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "sender-id");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "app-id");

    const { getFirebaseConfig } = await import("@/lib/firebase/env");

    expect(() => getFirebaseConfig()).toThrow(
      "Missing required Firebase env var: NEXT_PUBLIC_FIREBASE_API_KEY",
    );

    vi.unstubAllEnvs();
  });
});
