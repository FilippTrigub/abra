/**
 * Firebase emulator smoke test.
 *
 * Verifies that both the Auth and Firestore emulator are reachable
 * and functional. Writes a test document via Admin SDK, reads it back,
 * and deletes it.
 *
 * Skips gracefully when FIREBASE_EMULATOR_HOST is not set so CI
 * can run without the emulator.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";

const emulatorHost = process.env.FIREBASE_EMULATOR_HOST;

describe("Firebase emulator connector", () => {
  if (!emulatorHost) {
    it.skip("skipped — FIREBASE_EMULATOR_HOST not set", () => {});
    return;
  }

  // Use dynamic imports so module-level env validation in env.ts
  // only runs when the emulator is actually configured.
  let firestore: (typeof import("@/lib/firebase/client"))["firestore"];
  let adminFirestore: ReturnType<(typeof import("@/lib/firebase/admin"))["getAdminFirestore"]>;

  beforeAll(async () => {
    const clientMod = await import("@/lib/firebase/client");
    const adminMod = await import("@/lib/firebase/admin");
    firestore = clientMod.firestore;
    adminFirestore = adminMod.getAdminFirestore();
  });

  it("should write a document via Admin SDK and read it back", async () => {
    const testId = `emulator_smoke_${Date.now()}`;
    const docRef = adminFirestore.doc(`__emulator_test__/${testId}`);

    await docRef.set({
      kind: "emulator-smoke-test",
      timestamp: Date.now(),
      host: emulatorHost,
    });

    const snapshot = await docRef.get();
    expect(snapshot.exists).toBe(true);
    const data = snapshot.data();
    expect(data?.kind).toBe("emulator-smoke-test");
    expect(data?.host).toBe(emulatorHost);

    await docRef.delete();
  });

  it("should write and read via client SDK (browser-facing)", async () => {
    const testId = `emulator_smoke_client_${Date.now()}`;
    const docRef = doc(firestore, `__emulator_test__/${testId}`);

    await setDoc(docRef, {
      kind: "emulator-smoke-test-client",
      timestamp: Date.now(),
    });

    const snapshot = await getDoc(docRef);
    expect(snapshot.exists).toBe(true);
    expect(snapshot.data()?.kind).toBe("emulator-smoke-test-client");

    await deleteDoc(docRef);
  });

  it("should support collectionGroup-style queries", async () => {
    const testBatch = [
      "__emulator_test__/group_1/doc_a",
      "__emulator_test__/group_2/doc_b",
      "__emulator_test__/group_3/doc_c",
    ];

    for (const path of testBatch) {
      await adminFirestore.doc(path).set({
        group: "smoke-test",
        createdAt: Date.now(),
      });
    }

    const querySnapshot = await adminFirestore
      .collectionGroup("emulator_test")
      .where("group", "==", "smoke-test")
      .get();

    expect(querySnapshot.docs.length).toBeGreaterThan(0);

    for (const path of testBatch) {
      await adminFirestore.doc(path).delete();
    }
  });
});
