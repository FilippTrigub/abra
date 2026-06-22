import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/(dashboard)/dashboard/actions", () => ({
  deleteAbraInstance: vi.fn(),
  submitDeploymentRequest: vi.fn(),
}));

vi.mock("@/lib/agent-config/actions", () => ({
  loadUserAgentConfig: vi.fn(),
  saveUserAgentConfig: vi.fn(),
}));

describe("DeploymentConsole", () => {
  it("renders the deploy button when Telegram config is already saved", async () => {
    const { loadUserAgentConfig } = await import("@/lib/agent-config/actions");
    vi.mocked(loadUserAgentConfig).mockResolvedValue({
      configured: true,
      token: "bot123:token",
      homeChannel: "123456789",
    });

    const { DeploymentConsole } = await import(
      "@/app/(dashboard)/dashboard/deployment-console"
    );

    render(
      <DeploymentConsole
        initialDeployment={null}
        persistenceWarning={null}
      />,
    );

    expect(await screen.findByRole("button", { name: "Deploy Abra" })).toBeTruthy();
    expect(screen.queryByLabelText("Instance name")).toBeNull();
    expect(screen.queryByLabelText("Environment")).toBeNull();
    expect(screen.queryByLabelText("Branch / tag / version")).toBeNull();
  });

  it("shows a delete control for a ready instance", async () => {
    const { loadUserAgentConfig } = await import("@/lib/agent-config/actions");
    vi.mocked(loadUserAgentConfig).mockResolvedValue({
      configured: true,
      token: "bot123:token",
      homeChannel: "123456789",
    });

    const { DeploymentConsole } = await import(
      "@/app/(dashboard)/dashboard/deployment-console"
    );

    render(
      <DeploymentConsole
        initialDeployment={{
          id: "abra-instance",
          accountScope: "account-1",
          persistence: "database",
          status: "succeeded",
          errorMessage: null,
          resultUrl: "aks-runtime/abra/abra-account-1-abra-instance",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:01:00.000Z",
          request: {
            name: "Abra runtime",
            environment: "production",
            sourceRef: "main",
            notes: "",
          },
          orchestration: {
            requestId: "request-1",
            action: "create",
            operationId: "operation-1",
            adapter: "aks",
            pollAfterMs: 0,
            lastKnownStatus: "succeeded",
            lastSyncedAt: "2026-01-01T00:01:00.000Z",
          },
        }}
        persistenceWarning={null}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Abra runtime" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete instance" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Deploy Abra" })).toBeNull();
  });

  it("shows inline Telegram config form when no config is saved yet", async () => {
    const { loadUserAgentConfig } = await import("@/lib/agent-config/actions");
    vi.mocked(loadUserAgentConfig).mockResolvedValue({
      configured: false,
      token: null,
      homeChannel: null,
    });

    const { DeploymentConsole } = await import(
      "@/app/(dashboard)/dashboard/deployment-console"
    );

    render(
      <DeploymentConsole
        initialDeployment={null}
        persistenceWarning={null}
      />,
    );

    expect(await screen.findByPlaceholderText("123456:ABC-DEF...")).toBeTruthy();
    expect(screen.getByPlaceholderText("388259993")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Telegram config" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Deploy Abra" })).toBeNull();
  });
});
