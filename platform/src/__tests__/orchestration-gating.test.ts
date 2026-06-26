import { beforeEach, describe, expect, it, vi } from "vitest";

const dispatchOrchestrationActionMock = vi.hoisted(() => vi.fn());
const getPlatformAccountMock = vi.hoisted(() => vi.fn());
const getAdminFirestoreMock = vi.hoisted(() => vi.fn());
const requireApiAuthMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const loadAgentConfigMock = vi.hoisted(() => vi.fn());
const createDeploymentRecordMock = vi.hoisted(() => vi.fn());
const dispatchDeploymentRequestMock = vi.hoisted(() => vi.fn());
const destroyCurrentDeploymentForUserMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => void | Promise<void>) => void callback()),
  NextResponse: Response,
}));

vi.mock("@/lib/orchestration", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orchestration")>()),
  dispatchOrchestrationAction: dispatchOrchestrationActionMock,
}));

vi.mock("@/lib/platform-account", () => ({
  getPlatformAccount: getPlatformAccountMock,
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

vi.mock("@/lib/auth", () => ({
  requireApiAuth: requireApiAuthMock,
  unauthenticatedResponse: () => Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }),
}));

vi.mock("@/lib/auth/firebase-auth", () => ({
  getUser: getUserMock,
}));

vi.mock("@/lib/agent-config/service", () => ({
  loadAgentConfig: loadAgentConfigMock,
}));

vi.mock("@/lib/deployments", () => ({
  createDeploymentRecord: createDeploymentRecordMock,
  dispatchDeploymentRequest: dispatchDeploymentRequestMock,
  destroyCurrentDeploymentForUser: destroyCurrentDeploymentForUserMock,
}));

interface FirestoreMockOptions {
  failReads?: boolean;
}

function createFirestoreMock(docs = new Map<string, Record<string, unknown>>(), options: FirestoreMockOptions = {}) {
  const get = vi.fn(async function get(this: { path: string }) {
    if (options.failReads) {
      throw new Error("Firestore read failed");
    }

    return {
      data: () => docs.get(this.path),
    };
  });
  const doc = vi.fn((path: string) => ({ path, get }));

  return { doc, get };
}

function operationRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/orchestration/operations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("shared orchestration gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    getPlatformAccountMock.mockResolvedValue({ id: "account-1" });
    getAdminFirestoreMock.mockReturnValue(createFirestoreMock());
    requireApiAuthMock.mockResolvedValue({ user: { id: "user-1" } });
    getUserMock.mockResolvedValue({ user: { id: "user-1" }, error: null });
    loadAgentConfigMock.mockResolvedValue({
      telegramBotToken: "telegram-secret",
      telegramHomeChannel: "@abra-home",
      telegramAllowedUsers: "@abra-home",
    });
  });

  it("denies direct orchestration API spoofing for another account before dispatch", async () => {
    const { POST } = await import("@/app/api/orchestration/operations/route");

    const response = await POST(operationRequest({
      action: "create",
      requestId: "req-1",
      accountId: "account-2",
      deploymentId: "abra-instance",
      payload: {},
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "account_scope_mismatch",
        message: "The requested account does not belong to the authenticated principal.",
      },
    });
    expect(dispatchOrchestrationActionMock).not.toHaveBeenCalled();
  });

  it("canonicalizes allowed API account scopes to the verified platform account", async () => {
    dispatchOrchestrationActionMock.mockResolvedValue({ operationId: "op-1" });
    const { POST } = await import("@/app/api/orchestration/operations/route");

    const response = await POST(operationRequest({
      action: "update",
      requestId: "req-1",
      accountId: "user-1",
      deploymentId: "abra-instance",
      payload: { runtimeEnvVersionId: "ver_1" },
    }));

    expect(response.status).toBe(202);
    expect(dispatchOrchestrationActionMock).toHaveBeenCalledWith("update", expect.objectContaining({
      target: expect.objectContaining({ accountId: "account-1" }),
    }));
  });

  it("denies dashboard create before queuing when the account is manually blocked", async () => {
    const firestore = createFirestoreMock(new Map([
      ["accounts/account-1/moderation/current", {
        blocked: true,
        reason: "operator_hold",
        publicReason: "Operator review in progress.",
      }],
    ]));
    getAdminFirestoreMock.mockReturnValue(firestore);
    const { submitDeploymentRequest } = await import("@/app/(dashboard)/dashboard/actions");

    const result = await submitDeploymentRequest(
      { status: "idle", message: null, warning: null, deployment: null },
      new FormData(),
    );

    expect(result).toMatchObject({
      status: "error",
      message: "This account is manually blocked from starting or changing runtimes.",
    });
    expect(createDeploymentRecordMock).not.toHaveBeenCalled();
    expect(dispatchDeploymentRequestMock).not.toHaveBeenCalled();
  });

  it("denies API update before dispatch when the verified account is manually blocked", async () => {
    getAdminFirestoreMock.mockReturnValue(createFirestoreMock(new Map([
      ["accounts/account-1/moderation/current", {
        blocked: true,
        reason: "abuse",
        publicReason: "Account paused.",
      }],
    ])));
    const { POST } = await import("@/app/api/orchestration/operations/route");

    const response = await POST(operationRequest({
      action: "update",
      requestId: "req-1",
      accountId: "account-1",
      deploymentId: "abra-instance",
      payload: { runtimeEnvVersionId: "ver_1" },
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "manual_block",
        message: "This account is manually blocked from starting or changing runtimes.",
      },
    });
    expect(dispatchOrchestrationActionMock).not.toHaveBeenCalled();
  });

  it("allows destroy for a verified owner without reading block or billing state", async () => {
    getAdminFirestoreMock.mockReturnValue(createFirestoreMock(new Map(), { failReads: true }));
    const { evaluateOrchestrationGate } = await import("@/lib/orchestration/gate");

    await expect(evaluateOrchestrationGate({
      authUserId: "user-1",
      operation: "destroy",
      requestedAccountId: "account-1",
    })).resolves.toMatchObject({
      allowed: true,
      accountId: "account-1",
      reasonCode: null,
    });
  });

  it("fails closed when local billing, quota, or block state cannot be read", async () => {
    getAdminFirestoreMock.mockReturnValue(createFirestoreMock(new Map(), { failReads: true }));
    const { evaluateOrchestrationGate } = await import("@/lib/orchestration/gate");

    await expect(evaluateOrchestrationGate({
      authUserId: "user-1",
      operation: "create",
      requestedAccountId: "account-1",
    })).resolves.toMatchObject({
      allowed: false,
      accountId: "account-1",
      reasonCode: "billing_state_unavailable",
      status: 503,
    });
  });

  it("denies free runtime admission at quota with an upgrade message", async () => {
    getAdminFirestoreMock.mockReturnValue(createFirestoreMock(new Map([
      ["accounts/account-1/summaries/billing", { tier: "free" }],
      ["accounts/account-1/quota/windows/2026-W26/current", { used: 25 }],
    ])));
    const { evaluateOrchestrationGate } = await import("@/lib/orchestration/gate");

    await expect(evaluateOrchestrationGate({
      authUserId: "user-1",
      operation: "admission",
      requestedAccountId: "account-1",
      now: "2026-06-25T12:00:00.000Z",
    })).resolves.toMatchObject({
      allowed: false,
      reasonCode: "quota_exhausted",
      status: 402,
      message: "You've reached your Free message limit. Upgrade to Growth to keep processing managed messages.",
    });
  });

  it("denies growth runtime admission at quota with a follow-up offer message", async () => {
    getAdminFirestoreMock.mockReturnValue(createFirestoreMock(new Map([
      ["accounts/account-1/summaries/billing", { tier: "growth" }],
      ["accounts/account-1/quota/windows/2026-W26/current", { used: 100 }],
    ])));
    const { evaluateOrchestrationGate } = await import("@/lib/orchestration/gate");

    await expect(evaluateOrchestrationGate({
      authUserId: "user-1",
      operation: "admission",
      requestedAccountId: "account-1",
      now: "2026-06-25T12:00:00.000Z",
    })).resolves.toMatchObject({
      allowed: false,
      reasonCode: "quota_exhausted",
      status: 402,
      message: "You've reached your Growth message limit. I will reach out within 24 hours with an offer.",
    });
  });
});
