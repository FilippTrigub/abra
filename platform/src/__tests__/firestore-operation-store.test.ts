import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
      })),
    })),
  })),
}));

import { firestoreOperationStore } from "@/lib/orchestration/firestore-operation-store";
import type { OrchestrationOperation } from "@/lib/orchestration/types";
import { getAdminFirestore } from "@/lib/firebase/admin";

const mockFirestore = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
    })),
  })),
};

vi.mocked(getAdminFirestore).mockReturnValue(
  mockFirestore as unknown as ReturnType<typeof getAdminFirestore>,
);

describe("FirestoreOperationStore - Durable Operation Persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseOperation: OrchestrationOperation = {
    operationId: "op-123",
    adapter: "mock",
    action: "create",
    requestId: "req-456",
    target: {
      accountId: "acc-789",
      agentId: null,
      deploymentId: "deploy-101",
    },
    payload: {
      name: "test deployment",
    },
    status: "queued",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    completedAt: null,
    pollAfterMs: 1500,
    steps: [
      {
        status: "queued",
        at: new Date("2026-01-01T00:00:00Z").toISOString(),
        summary: "Operation queued",
      },
    ],
    error: null,
    result: null,
  };

  describe("create", () => {
    it("should persist a new operation to Firestore", async () => {
      const set = vi.fn().mockResolvedValue(undefined);
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn(() => ({ set })),
      });

      const result = await firestoreOperationStore.create(baseOperation);

      expect(result.operationId).toBe("op-123");
      expect(result.status).toBe("queued");
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: "op-123",
          adapter: "mock",
          action: "create",
          requestId: "req-456",
          target: expect.objectContaining({ accountId: "acc-789" }),
        }),
      );
    });
  });

  describe("getStatus", () => {
    it("should return the operation when it exists", async () => {
      const docRef = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => baseOperation,
        }),
      };
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn(() => docRef),
      });

      const result = await firestoreOperationStore.getStatus("op-123");

      expect(result).not.toBeNull();
      expect(result?.operationId).toBe("op-123");
      expect(result?.status).toBe("queued");
      expect(result?.requestId).toBe("req-456");
    });

    it("should return null when operation does not exist", async () => {
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: false }),
        })),
      });

      const result = await firestoreOperationStore.getStatus("non-existent");

      expect(result).toBeNull();
    });

    it("should return null when document has no data", async () => {
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => null }),
        })),
      });

      const result = await firestoreOperationStore.getStatus("no-data");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update an existing operation", async () => {
      const updatedOperation: OrchestrationOperation = {
        ...baseOperation,
        status: "running",
        updatedAt: new Date("2026-01-01T00:01:00Z").toISOString(),
        steps: [
          ...baseOperation.steps,
          {
            status: "running",
            at: new Date("2026-01-01T00:01:00Z").toISOString(),
            summary: "Operation is processing",
          },
        ],
      };

      const set = vi.fn().mockResolvedValue(undefined);
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn(() => ({ set })),
      });

      const result = await firestoreOperationStore.update(updatedOperation);

      expect(result.status).toBe("running");
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "running",
        }),
        { merge: true },
      );
    });

    it("should merge updates without overwriting unrelated fields", async () => {
      const set = vi.fn().mockResolvedValue(undefined);
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn(() => ({ set })),
      });

      await firestoreOperationStore.update({
        ...baseOperation,
        status: "succeeded",
        error: null,
        result: {
          message: "Done",
          resourceHandle: "resource-1",
          metadata: {
            aks: {
              namespace: "default",
              statefulSetName: "agent",
              pvcName: "home",
              serviceName: "svc",
            },
          },
        },
      });

      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "succeeded",
          result: expect.objectContaining({
            metadata: expect.objectContaining({
              aks: expect.objectContaining({
                namespace: "default",
              }),
            }),
          }),
        }),
        { merge: true },
      );
    });
  });

  describe("runtimeMetadata persistence", () => {
    it("should persist AkRuntimeMetadata inline", async () => {
      const operationWithMetadata: OrchestrationOperation = {
        ...baseOperation,
        status: "running",
        runtimeMetadata: {
          aks: {
            namespace: "abra-runtime",
            statefulSetName: "abra-agent-op-123",
            pvcName: "home-op-123",
            serviceName: "gateway-op-123",
            configRevision: 1,
          },
        },
      };

      const set = vi.fn().mockResolvedValue(undefined);
      mockFirestore.collection.mockReturnValue({
        doc: vi.fn(() => ({ set })),
      });

      await firestoreOperationStore.create(operationWithMetadata);

      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          runtimeMetadata: expect.objectContaining({
            aks: expect.objectContaining({
              namespace: "abra-runtime",
              statefulSetName: "abra-agent-op-123",
            }),
          }),
        }),
      );
    });

    it("should round-trip runtimeMetadata through read", async () => {
      const operationWithMetadata: OrchestrationOperation = {
        ...baseOperation,
        status: "running",
        runtimeMetadata: {
          aks: {
            namespace: "abra-runtime",
            statefulSetName: "abra-agent-op-123",
            pvcName: "home-op-123",
            serviceName: "gateway-op-123",
          },
        },
      };

      mockFirestore.collection.mockReturnValue({
        doc: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => operationWithMetadata,
          }),
        })),
      });

      const result = await firestoreOperationStore.getStatus("op-123");

      expect(result?.runtimeMetadata).toBeDefined();
      expect(result?.runtimeMetadata?.aks).toBeDefined();
      expect(result?.runtimeMetadata?.aks?.namespace).toBe("abra-runtime");
      expect(result?.runtimeMetadata?.aks?.statefulSetName).toBe("abra-agent-op-123");
    });
  });
});
