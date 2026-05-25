import { beforeEach, describe, expect, it, vi } from "vitest";

const getStatusMock = vi.fn();
const getStoredStatusMock = vi.fn();
const getPlatformAccountMock = vi.fn();
const requireApiAuthMock = vi.fn();
const unauthenticatedResponseMock = vi.fn(() =>
  Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 })
);
const permissionDeniedResponseMock = vi.fn(() =>
  Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 })
);

vi.mock("@/lib/orchestration", () => ({
  getOrchestrationAdapter: () => ({
    name: "aks",
    getStatus: getStatusMock,
  }),
}));

vi.mock("@/lib/orchestration/firestore-operation-store", () => ({
  firestoreOperationStore: {
    getStatus: getStoredStatusMock,
  },
}));

vi.mock("@/lib/platform-account", () => ({
  getPlatformAccount: getPlatformAccountMock,
}));

vi.mock("@/lib/auth", () => ({
  requireApiAuth: requireApiAuthMock,
  unauthenticatedResponse: unauthenticatedResponseMock,
  permissionDeniedResponse: permissionDeniedResponseMock,
}));

describe("orchestration operation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStoredStatusMock.mockResolvedValue(null);
    getPlatformAccountMock.mockResolvedValue({ id: "account-1" });
  });

  it("returns the durable stored operation when it belongs to the user account scope", async () => {
    requireApiAuthMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    getStoredStatusMock.mockResolvedValue({
      operationId: "op-1",
      adapter: "mock",
      action: "create",
      requestId: "req-1",
      target: {
        accountId: "account-1",
        agentId: null,
        deploymentId: "deploy-1",
      },
      payload: {},
      status: "queued",
      createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
      completedAt: null,
      pollAfterMs: 1000,
      steps: [],
      error: null,
      result: null,
    });

    const { GET } = await import("@/app/api/orchestration/operations/[operationId]/route");
    const response = await GET(new Request("http://localhost:3000/api/orchestration/operations/op-1"), {
      params: Promise.resolve({ operationId: "op-1" }),
    });

    expect(response.status).toBe(200);
    expect(getStatusMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      operationId: "op-1",
      target: {
        accountId: "account-1",
      },
      status: "queued",
    });
  });

  it("returns a structured 500 when AKS status polling throws", async () => {
    requireApiAuthMock.mockResolvedValue({
      user: { id: "user-1" },
    });
    getStatusMock.mockRejectedValue(
      new Error("Azure Workload Identity is not configured for Kubernetes bootstrap.")
    );

    const { GET } = await import("@/app/api/orchestration/operations/[operationId]/route");
    const response = await GET(new Request("http://localhost:3000/api/orchestration/operations/op-1"), {
      params: Promise.resolve({ operationId: "op-1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "ORCHESTRATION_OPERATION_STATUS_FAILED",
        message: "Azure Workload Identity is not configured for Kubernetes bootstrap.",
      },
    });
  });
});
