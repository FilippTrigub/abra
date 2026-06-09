import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const loadAgentConfig = vi.fn();
const createDeploymentRecord = vi.fn();
const dispatchDeploymentRequest = vi.fn();
const destroyCurrentDeploymentForUser = vi.fn();

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => void | Promise<void>) => void callback()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/firebase-auth", () => ({
  getUser,
}));

vi.mock("@/lib/agent-config/service", () => ({
  loadAgentConfig,
}));

vi.mock("@/lib/deployments", () => ({
  createDeploymentRecord,
  dispatchDeploymentRequest,
  destroyCurrentDeploymentForUser,
}));

describe("dashboard deployment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ user: { id: "user-1" }, error: null });
  });

  it("blocks deployment before queuing when Telegram config is missing", async () => {
    loadAgentConfig.mockResolvedValue(null);

    const { submitDeploymentRequest } = await import("@/app/(dashboard)/dashboard/actions");
    const result = await submitDeploymentRequest(
      { status: "idle", message: null, warning: null, deployment: null },
      new FormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe("Add a Telegram bot token and allowed user list before deploying Abra.");
    expect(createDeploymentRecord).not.toHaveBeenCalled();
    expect(dispatchDeploymentRequest).not.toHaveBeenCalled();
  });
});
