import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
    })),
  })),
}));

vi.mock("@/lib/settings/definitions", () => ({
  SETTINGS_DEFINITIONS: [
    { key: "defaultEnvironment", defaultValue: "preview" as const },
    { key: "deploymentAutoPoll", defaultValue: true as const },
    { key: "deploymentPollInterval", defaultValue: 1500 as const },
    { key: "notificationsEnabled", defaultValue: true as const },
    { key: "brandAccentColor", defaultValue: "coral" as const },
    { key: "dashboardLocale", defaultValue: "en-US" as const },
  ],
  validateSetting: vi.fn(() => ({ valid: true, errors: [] })),
}));

import { loadSettings, saveSettings, revertSettings, getSettingsSnapshot } from "@/lib/settings/service";
import { getAdminFirestore } from "@/lib/firebase/admin";
import * as admin from "firebase-admin";

function createDocRef(overrides: {
  get?: ReturnType<typeof vi.fn>;
  set?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

const mockFirestore = {
  doc: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    update: vi.fn(),
  })),
};

vi.mocked(getAdminFirestore).mockReturnValue(
  mockFirestore as unknown as ReturnType<typeof getAdminFirestore>,
);

describe("settings service - Firestore migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadSettings", () => {
    it("should return settings from Firestore when doc exists", async () => {
      mockFirestore.doc.mockReturnValue(createDocRef({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            values: { defaultEnvironment: "staging" as const },
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
          }),
        }),
      }));

      const result = await loadSettings("user-123");

      expect(result.persistence).toBe("database");
      expect(result.snapshot.accountScope).toBe("user-123");
      expect(result.snapshot.values.defaultEnvironment).toBe("staging");
      expect(result.warning).toBeNull();
    });

    it("should create and return default settings when Firestore doc does not exist", async () => {
      const set = vi.fn().mockResolvedValue(undefined);
      mockFirestore.doc.mockReturnValue(createDocRef({
        get: vi.fn().mockResolvedValue({ exists: false }),
        set,
      }));

      const result = await loadSettings("user-456");

      expect(result.persistence).toBe("database");
      expect(result.snapshot.values.defaultEnvironment).toBe("preview");
      expect(result.warning).toBeNull();
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({ defaultEnvironment: "preview" }),
        }),
        { merge: true },
      );
    });

    it("should return defaults when Firestore throws an error", async () => {
      mockFirestore.doc.mockReturnValue(createDocRef({
        get: vi.fn().mockRejectedValue(new Error("Firestore error")),
      }));

      const result = await loadSettings("user-789");

      expect(result.persistence).toBe("memory");
      expect(result.warning).toBe("Firestore storage is unavailable. Showing in-memory defaults.");
    });
  });

  describe("saveSettings", () => {
    const fullValues = {
      defaultEnvironment: "preview" as const,
      deploymentAutoPoll: true as const,
      deploymentPollInterval: 1500 as const,
      notificationsEnabled: true as const,
      brandAccentColor: "coral" as const,
      dashboardLocale: "en-US" as const,
    } as const;

    it("should save a single key and merge with existing values", async () => {
      const mockDocRef = createDocRef({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ values: fullValues }),
        }),
        update: vi.fn().mockResolvedValue(undefined),
      });
      mockFirestore.doc.mockReturnValue(mockDocRef);

      const result = await saveSettings("user-123", { key: "deploymentAutoPoll", value: false });

      expect(result.success).toBe(true);
      expect(result.snapshot?.values.deploymentAutoPoll).toBe(false);
      expect(result.snapshot?.accountScope).toBe("user-123");
      expect(result.restartRequired).toBe(false);
      expect(result.warning).toBeNull();
    });

    it("should persist full snapshot when existing document is read", async () => {
      const mockDocRef = createDocRef({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ values: fullValues }),
        }),
        update: vi.fn().mockResolvedValue(undefined),
      });
      mockFirestore.doc.mockReturnValue(mockDocRef);

      const result = await saveSettings("user-123", { key: "brandAccentColor", value: "violet" });

      expect(result.snapshot?.values.brandAccentColor).toBe("violet");
      expect(result.snapshot?.values.defaultEnvironment).toBe("preview");
    });

    it("should trigger restartRequired when defaultEnvironment changes", async () => {
      const mockDocRef = createDocRef({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ values: fullValues }) }),
        update: vi.fn().mockResolvedValue(undefined),
      });
      mockFirestore.doc.mockReturnValue(mockDocRef);

      const result = await saveSettings("user-123", { key: "defaultEnvironment", value: "production" });

      expect(result.restartRequired).toBe(true);
    });

    it("should build defaults when existing document does not exist", async () => {
      mockFirestore.doc.mockReturnValue(createDocRef({
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn().mockResolvedValue(undefined),
      }));

      const result = await saveSettings("user-123", { key: "deploymentAutoPoll", value: false });

      expect(result.snapshot?.values.deploymentAutoPoll).toBe(false);
      expect(result.snapshot?.values.defaultEnvironment).toBe("preview");
      expect(result.snapshot?.values.brandAccentColor).toBe("coral");
    });

    it("should return local save warning when Firestore throws error", async () => {
      mockFirestore.doc.mockReturnValue(createDocRef({
        get: vi.fn().mockRejectedValue(new Error("Firestore error")),
        set: vi.fn().mockRejectedValue(new Error("Firestore error")),
        update: vi.fn().mockRejectedValue(new Error("Firestore error")),
      }));

      const result = await saveSettings("user-123", { key: "deploymentAutoPoll", value: false });

      expect(result.success).toBe(true);
      expect(result.snapshot).toBeNull();
      expect(result.warning).toBe("Firestore storage is unavailable. Changes are only reflected in memory.");
    });
  });

  describe("revertSettings", () => {
    it("should revert to default values", async () => {
      mockFirestore.doc.mockReturnValue(createDocRef({
        set: vi.fn().mockResolvedValue(undefined),
      }));

      const result = await revertSettings("user-123");

      expect(result.success).toBe(true);
      expect(result.snapshot?.values.defaultEnvironment).toBe("preview");
      expect(result.snapshot?.values.deploymentAutoPoll).toBe(true);
      expect(result.warning).toBeNull();
    });

    it("should return local revert warning when Firestore throws error", async () => {
      mockFirestore.doc.mockReturnValue(createDocRef({
        set: vi.fn().mockRejectedValue(new Error("Firestore error")),
      }));

      const result = await revertSettings("user-456");

      expect(result.success).toBe(true);
      expect(result.snapshot).toBeNull();
      expect(result.warning).toBe("Firestore storage is unavailable. Defaults were restored in memory.");
    });
  });

  describe("getSettingsSnapshot", () => {
    it("should return snapshot when Firestore doc exists", async () => {
      mockFirestore.doc.mockReturnValue(createDocRef({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            values: { defaultEnvironment: "staging" as const, brandAccentColor: "violet" as const },
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
          }),
        }),
      }));

      const result = await getSettingsSnapshot("user-123");

      expect(result).not.toBeNull();
      expect(result?.accountScope).toBe("user-123");
      expect(result?.values.defaultEnvironment).toBe("staging");
    });

    it("should return null when Firestore doc does not exist", async () => {
      mockFirestore.doc.mockReturnValue(createDocRef({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }));

      const result = await getSettingsSnapshot("user-456");

      expect(result).toBeNull();
    });

    it("should return null when Firestore throws an error", async () => {
      mockFirestore.doc.mockReturnValue(createDocRef({
        get: vi.fn().mockRejectedValue(new Error("Firestore error")),
      }));

      const result = await getSettingsSnapshot("user-789");

      expect(result).toBeNull();
    });
  });
});
