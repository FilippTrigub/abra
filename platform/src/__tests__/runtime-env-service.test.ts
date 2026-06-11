import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: vi.fn(),
}));

import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  decryptRuntimeEnvForOrchestration,
  deleteRuntimeEnvKey,
  loadRuntimeEnvSummary,
  rollbackRuntimeEnvVersion,
  saveRuntimeEnvFields,
  saveRuntimeEnvImport,
} from "@/lib/runtime-env/service";
import type { RuntimeEnvVersionDocument } from "@/lib/runtime-env/types";

const TEST_KEY = Buffer.alloc(32, 17).toString("base64");
const AUTH_USER_ID = "user-runtime-env";

type StoredDoc = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createFirestoreMock() {
  const docs = new Map<string, StoredDoc>();
  const docCalls: string[] = [];

  const firestore = {
    doc: vi.fn((path: string) => {
      docCalls.push(path);
      return {
        get: vi.fn().mockResolvedValue({
          get exists() {
            return docs.has(path);
          },
          data: () => {
            const value = docs.get(path);
            return value ? clone(value) : undefined;
          },
        }),
        set: vi.fn().mockImplementation((data: StoredDoc, options?: { merge?: boolean }) => {
          const next = clone(data);
          if (options?.merge && docs.has(path)) {
            docs.set(path, { ...docs.get(path), ...next });
          } else {
            docs.set(path, next);
          }
          return Promise.resolve();
        }),
      };
    }),
  };

  return { firestore, docs, docCalls };
}

function createWriteContext() {
  const counters = { version: 0, event: 0 };
  return {
    now: new Date("2026-06-11T20:00:00.000Z"),
    createId: (kind: "version" | "event") => {
      counters[kind] += 1;
      return `${kind === "version" ? "ver" : "evt"}_test_${counters[kind]}`;
    },
  };
}

function currentPath() {
  return `accounts/${AUTH_USER_ID}/runtime-env/current`;
}

function versionPath(versionId: string) {
  return `${currentPath()}/versions/${versionId}`;
}

function auditPath(eventId: string) {
  return `${currentPath()}/audit/${eventId}`;
}

function expectValidDocumentPath(path: string) {
  expect(path.split("/").length % 2).toBe(0);
}

function expectValidDocumentPaths(paths: string[]) {
  for (const path of paths) {
    expectValidDocumentPath(path);
  }
}

describe("runtime env Firestore service", () => {
  let firestoreMock: ReturnType<typeof createFirestoreMock>;

  beforeEach(() => {
    vi.stubEnv("RUNTIME_ENV_ENCRYPTION_KEY", TEST_KEY);
    firestoreMock = createFirestoreMock();
    vi.mocked(getAdminFirestore).mockReturnValue(
      firestoreMock.firestore as unknown as ReturnType<typeof getAdminFirestore>,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test("saves fields as encrypted active config, immutable version, and audit metadata", async () => {
    const context = createWriteContext();
    const result = await saveRuntimeEnvFields(AUTH_USER_ID, {
      values: {
        BUFFER_API_KEY: "buf_plain_secret",
        TELEGRAM_HOME_CHANNEL: "@abra-home",
      },
    }, context);

    expect(result).toEqual(expect.objectContaining({
      success: true,
      versionId: "ver_test_1",
      eventId: "evt_test_1",
      errors: [],
    }));
    expect(firestoreMock.docCalls).toContain(currentPath());
    expect(firestoreMock.docCalls).toContain(versionPath("ver_test_1"));
    expect(firestoreMock.docCalls).toContain(auditPath("evt_test_1"));
    expectValidDocumentPaths(firestoreMock.docCalls);

    const active = firestoreMock.docs.get(currentPath());
    const version = firestoreMock.docs.get(versionPath("ver_test_1")) as unknown as RuntimeEnvVersionDocument;
    const audit = firestoreMock.docs.get(auditPath("evt_test_1"));
    const serializedActive = JSON.stringify(active);
    const serializedVersion = JSON.stringify(version);
    const serializedAudit = JSON.stringify(audit);
    const serializedSummary = JSON.stringify(result.summary);

    expect(active).toEqual(expect.objectContaining({
      versionId: "ver_test_1",
      values: expect.objectContaining({
        BUFFER_API_KEY: expect.objectContaining({
          encryptedValue: expect.stringMatching(/^enc:v1:aes-256-gcm:/),
          fingerprint: expect.stringMatching(/^hmac-sha256:[0-9a-f]{16}$/),
          source: "manual",
        }),
      }),
    }));
    expect(version).toEqual(expect.objectContaining({
      versionId: "ver_test_1",
      previousVersionId: null,
      action: "save",
      keys: ["BUFFER_API_KEY", "TELEGRAM_HOME_CHANNEL"],
      values: expect.objectContaining({ BUFFER_API_KEY: expect.any(Object) }),
    }));
    expect(audit).toEqual(expect.objectContaining({
      eventId: "evt_test_1",
      versionId: "ver_test_1",
      action: "save",
      keys: ["BUFFER_API_KEY", "TELEGRAM_HOME_CHANNEL"],
    }));
    expect(serializedActive).not.toContain("buf_plain_secret");
    expect(serializedActive).not.toContain("@abra-home");
    expect(serializedVersion).not.toContain("buf_plain_secret");
    expect(serializedAudit).not.toContain("buf_plain_secret");
    expect(serializedSummary).not.toContain("buf_plain_secret");
    expect(serializedSummary).not.toContain("@abra-home");
  });

  test("loads a redacted summary and decrypts active values only through the server orchestration method", async () => {
    const context = createWriteContext();
    await saveRuntimeEnvFields(AUTH_USER_ID, {
      values: {
        BUFFER_API_KEY: "buf_orchestration_secret",
        TELEGRAM_HOME_CHANNEL: "@summary-safe",
      },
    }, context);

    const summary = await loadRuntimeEnvSummary(AUTH_USER_ID);
    const decrypted = await decryptRuntimeEnvForOrchestration(AUTH_USER_ID);

    expect(summary.versionId).toBe("ver_test_1");
    expect(summary.values).toEqual([
      expect.objectContaining({ key: "BUFFER_API_KEY", configured: true, source: "manual" }),
      expect.objectContaining({ key: "TELEGRAM_HOME_CHANNEL", configured: true, source: "manual" }),
    ]);
    expect(JSON.stringify(summary)).not.toContain("buf_orchestration_secret");
    expect(JSON.stringify(summary)).not.toContain("@summary-safe");
    expect(decrypted).toEqual({
      BUFFER_API_KEY: "buf_orchestration_secret",
      TELEGRAM_HOME_CHANNEL: "@summary-safe",
    });
  });

  test("imports supported dotenv values, rejects unknown and reserved keys before persistence", async () => {
    const context = createWriteContext();
    const invalid = await saveRuntimeEnvImport(AUTH_USER_ID, {
      values: {
        RANDOM_SECRET: "raw-random-value",
        KUBECONFIG_B64: "reserved-value",
      },
    }, context);

    expect(invalid.success).toBe(false);
    expect(invalid.errors).toEqual(["Unsupported runtime env key: RANDOM_SECRET"]);
    expect(firestoreMock.docs.size).toBe(0);

    const valid = await saveRuntimeEnvImport(AUTH_USER_ID, {
      values: {
        FAL_API_KEY: "fal_plain_secret",
      },
    }, context);

    expect(valid.success).toBe(true);
    expect(valid.summary?.values).toEqual([
      expect.objectContaining({ key: "FAL_API_KEY", source: "import" }),
    ]);
    expect(JSON.stringify(firestoreMock.docs.get(currentPath()))).not.toContain("fal_plain_secret");
  });

  test("returns safe encryption configuration errors without persisting plaintext", async () => {
    const context = createWriteContext();
    vi.stubEnv("RUNTIME_ENV_ENCRYPTION_KEY", "");

    const result = await saveRuntimeEnvFields(AUTH_USER_ID, {
      values: {
        BUFFER_API_KEY: "buf_missing_encryption_secret",
      },
    }, context);

    expect(result).toEqual({
      success: false,
      summary: null,
      versionId: null,
      eventId: null,
      errors: ["Runtime environment encryption is not configured. Set RUNTIME_ENV_ENCRYPTION_KEY before saving runtime environment values."],
    });
    expect(firestoreMock.docs.size).toBe(0);
    expect(JSON.stringify(result)).not.toContain("buf_missing_encryption_secret");
  });

  test("deletes a key by creating a new active version and audit record", async () => {
    const context = createWriteContext();
    await saveRuntimeEnvFields(AUTH_USER_ID, {
      values: {
        BUFFER_API_KEY: "buf_to_delete",
        FAL_API_KEY: "fal_to_keep",
      },
    }, context);

    const result = await deleteRuntimeEnvKey(AUTH_USER_ID, { key: "BUFFER_API_KEY" }, context);
    const active = firestoreMock.docs.get(currentPath());
    const version = firestoreMock.docs.get(versionPath("ver_test_2"));
    const audit = firestoreMock.docs.get(auditPath("evt_test_2"));
    const decrypted = await decryptRuntimeEnvForOrchestration(AUTH_USER_ID);

    expect(result).toEqual(expect.objectContaining({
      success: true,
      versionId: "ver_test_2",
      eventId: "evt_test_2",
    }));
    expect(active).toEqual(expect.objectContaining({
      versionId: "ver_test_2",
      values: expect.not.objectContaining({ BUFFER_API_KEY: expect.anything() }),
    }));
    expect(version).toEqual(expect.objectContaining({
      previousVersionId: "ver_test_1",
      action: "delete",
      keys: ["BUFFER_API_KEY"],
    }));
    expect(audit).toEqual(expect.objectContaining({
      action: "delete",
      versionId: "ver_test_2",
      previousVersionId: "ver_test_1",
    }));
    expect(decrypted).toEqual({ FAL_API_KEY: "fal_to_keep" });
    expect(JSON.stringify(active)).not.toContain("buf_to_delete");
  });

  test("rolls back an old version snapshot into a new active version and audit record", async () => {
    const context = createWriteContext();
    await saveRuntimeEnvFields(AUTH_USER_ID, {
      values: {
        BUFFER_API_KEY: "buf_original",
      },
    }, context);
    await saveRuntimeEnvFields(AUTH_USER_ID, {
      values: {
        BUFFER_API_KEY: "buf_changed",
        FAL_API_KEY: "fal_added",
      },
    }, context);

    const result = await rollbackRuntimeEnvVersion(AUTH_USER_ID, { versionId: "ver_test_1" }, context);
    const active = firestoreMock.docs.get(currentPath());
    const version = firestoreMock.docs.get(versionPath("ver_test_3"));
    const audit = firestoreMock.docs.get(auditPath("evt_test_3"));
    const decrypted = await decryptRuntimeEnvForOrchestration(AUTH_USER_ID);

    expect(result).toEqual(expect.objectContaining({
      success: true,
      versionId: "ver_test_3",
      eventId: "evt_test_3",
    }));
    expect(active).toEqual(expect.objectContaining({
      versionId: "ver_test_3",
      values: expect.not.objectContaining({ FAL_API_KEY: expect.anything() }),
    }));
    expect(version).toEqual(expect.objectContaining({
      previousVersionId: "ver_test_2",
      action: "rollback",
      keys: ["BUFFER_API_KEY"],
    }));
    expect(audit).toEqual(expect.objectContaining({
      action: "rollback",
      versionId: "ver_test_3",
      previousVersionId: "ver_test_2",
    }));
    expect(decrypted).toEqual({ BUFFER_API_KEY: "buf_original" });
    expect(JSON.stringify(active)).not.toContain("buf_original");
    expect(JSON.stringify(active)).not.toContain("buf_changed");
    expect(JSON.stringify(result.summary)).not.toContain("buf_original");
  });
});
