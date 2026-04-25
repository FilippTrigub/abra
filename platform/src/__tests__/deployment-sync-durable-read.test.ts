import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock dependencies BEFORE importing deployments
vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      update: vi.fn(),
    })),
    collection: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ docs: [] }),
        })),
      })),
    })),
    FieldValue: {
      serverTimestamp: () => ({ serverTimestamp: true }),
    },
  })),
}));

vi.mock("@/lib/platform-account", () => ({
  getPlatformAccount: vi.fn(() =>
    Promise.resolve({
      id: "account-1",
      name: "Test Account",
    }),
  ),
}));

vi.mock("@/lib/orchestration/firestore-operation-store", () => ({
  firestoreOperationStore: {
    getStatus: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

import { getAdminFirestore } from "@/lib/firebase/admin";
import type { OrchestrationOperation } from "@/lib/orchestration/types";
import { syncDeploymentStatusForUser } from "@/lib/deployments";
import { firestoreOperationStore } from "@/lib/orchestration/firestore-operation-store";

// Mock Firestore instance that persists across tests
const mockFirestore = {
  doc: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  })),
  collection: vi.fn(),
  FieldValue: {
    serverTimestamp: () => ({ serverTimestamp: true }),
  },
};

vi.mocked(getAdminFirestore).mockReturnValue(mockFirestore as any);

describe("Deployment Sync - Durable Operation Reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (firestoreOperationStore.getStatus as any).mockReturnValue(Promise.resolve(null));
  });

  function setupMockFirestoreDoc(deploymentData: any) {
    mockFirestore.collection.mockReturnValue({
      orderBy: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ docs: [] }),
        })),
      })),
    } as any);

    mockFirestore.doc.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => deploymentData,
      }),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    } as any);
  }

  describe("syncDeploymentStatusForUser with mock adapter", () => {
    it("should read operation from durable store when available", async () => {
      const durableOperation: OrchestrationOperation = {
        operationId: "op-123",
        adapter: "mock",
        action: "create",
        requestId: "req-456",
        target: {
          accountId: "account-1",
          agentId: null,
          deploymentId: "deploy-1",
        },
        payload: {
          name: "Test Deployment",
          environment: "preview",
          sourceRef: "test-ref",
          notes: "",
        },
        status: "running",
        createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
        updatedAt: new Date("2026-01-01T00:01:00Z").toISOString(),
        completedAt: null,
        pollAfterMs: 1000,
        steps: [
          {
            status: "queued",
            at: new Date("2026-01-01T00:00:00Z").toISOString(),
            summary: "Queued",
          },
          {
            status: "running",
            at: new Date("2026-01-01T00:01:00Z").toISOString(),
            summary: "Processing",
          },
        ],
        error: null,
        result: null,
      };

      (firestoreOperationStore.getStatus as any).mockReturnValue(
        Promise.resolve(durableOperation),
      );

      setupMockFirestoreDoc({
        id: "deploy-1",
        account_id: "account-1",
        agent_id: null,
        requestPayload: {
          request: {
            name: "Test Deployment",
            environment: "preview",
            sourceRef: "test-ref",
            notes: "",
            mockOutcome: "succeeded",
          },
          orchestration: {
            requestId: "req-456",
            operationId: "op-123",
            adapter: "mock",
            pollAfterMs: 1000,
            lastKnownStatus: "queued",
            lastSyncedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
          },
        },
        status: "queued",
        errorMessage: null,
        resultUrl: null,
        createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
        updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      });

      const result = await syncDeploymentStatusForUser("user-1", "deploy-1");

      expect(firestoreOperationStore.getStatus).toHaveBeenCalledWith("op-123");
      expect(result?.status).toBe("running");
      expect(result?.orchestration?.lastKnownStatus).toBe("running");
      expect(result?.orchestration?.lastSyncedAt).toBe("2026-01-01T00:01:00.000Z");
    });

    it("should fall back to mock adapter when durable store has no operation", async () => {
      setupMockFirestoreDoc({
        id: "deploy-1",
        account_id: "account-1",
        agent_id: null,
        requestPayload: {
          request: {
            name: "Test Deployment",
            environment: "preview",
            sourceRef: "test-ref",
            notes: "",
            mockOutcome: "succeeded",
          },
          orchestration: {
            requestId: "req-456",
            operationId: "op-123",
            adapter: "mock",
            pollAfterMs: 1000,
            lastKnownStatus: "queued",
            lastSyncedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
          },
        },
        status: "queued",
        errorMessage: null,
        resultUrl: null,
        createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
        updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      });

      const result = await syncDeploymentStatusForUser("user-1", "deploy-1");

      expect(firestoreOperationStore.getStatus).toHaveBeenCalledWith("op-123");
      expect(result).not.toBeNull();
      // Should synthesize mock operation when durable store is empty
      expect(result?.status).toBe("succeeded");
    });

    it("should persist mock operation to durable store for future reads", async () => {
      (firestoreOperationStore.getStatus as any).mockReturnValue(
        Promise.resolve(null),
      );

      setupMockFirestoreDoc({
        id: "deploy-1",
        account_id: "account-1",
        agent_id: null,
        requestPayload: {
          request: {
            name: "Test Deployment",
            environment: "preview",
            sourceRef: "test-ref",
            notes: "",
            mockOutcome: "succeeded",
          },
          orchestration: {
            requestId: "req-456",
            operationId: "op-123",
            adapter: "mock",
            pollAfterMs: 1000,
            lastKnownStatus: "queued",
            lastSyncedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
          },
        },
        status: "queued",
        errorMessage: null,
        resultUrl: null,
        createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
        updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      });

      const result = await syncDeploymentStatusForUser("user-1", "deploy-1");

      expect(firestoreOperationStore.getStatus).toHaveBeenCalledWith("op-123");
      expect(result).not.toBeNull();
      expect(result?.resultUrl).toBe("mock-agent/op-123");
    });
  });

  describe("syncDeploymentStatusForUser with non-mock adapter", () => {
    it("should return failure when operation not found in durable store for non-mock adapter", async () => {
      (firestoreOperationStore.getStatus as any).mockReturnValue(
        Promise.resolve(null),
      );

      setupMockFirestoreDoc({
        id: "deploy-1",
        account_id: "account-1",
        agent_id: null,
        requestPayload: {
          request: {
            name: "Test Deployment",
            environment: "preview",
            sourceRef: "test-ref",
            notes: "",
            mockOutcome: "succeeded",
          },
          orchestration: {
            requestId: "req-456",
            operationId: "op-123",
            adapter: "aks",
            pollAfterMs: 5000,
            lastKnownStatus: "queued",
            lastSyncedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
          },
        },
        status: "queued",
        errorMessage: null,
        resultUrl: null,
        createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
        updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      });

      const result = await syncDeploymentStatusForUser("user-1", "deploy-1");

      expect(firestoreOperationStore.getStatus).toHaveBeenCalledWith("op-123");
      expect(result?.status).toBe("failed");
      expect(result?.errorMessage).toBe(
        "The orchestration status could not be found for this deployment request.",
      );
    });
  });
});
