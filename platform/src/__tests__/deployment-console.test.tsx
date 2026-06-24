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

describe("DeploymentConsole", () => {
  it("renders the Start button when Telegram is configured", async () => {
    const { DeploymentConsole } = await import(
      "@/app/(dashboard)/dashboard/deployment-console"
    );

    render(
      <DeploymentConsole
        initialDeployment={null}
        persistenceWarning={null}
        telegramConfigured={true}
      />,
    );

    const startButton = await screen.findByRole("button", { name: "Start" });
    expect(startButton).toBeTruthy();
    expect(startButton.getAttribute("disabled")).toBeNull();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.queryByText("Abra instance")).toBeNull();
  });

  it("disables Start and shows a setup hint when Telegram isn't configured", async () => {
    const { DeploymentConsole } = await import(
      "@/app/(dashboard)/dashboard/deployment-console"
    );

    render(
      <DeploymentConsole
        initialDeployment={null}
        persistenceWarning={null}
        telegramConfigured={false}
      />,
    );

    const startButton = await screen.findByRole("button", { name: "Start" });
    expect(startButton.getAttribute("disabled")).not.toBeNull();
    expect(
      screen.getByText("Set up Telegram in", { exact: false }),
    ).toBeTruthy();
  });

  it("shows a Stop control for a ready instance", async () => {
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
        telegramConfigured={true}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Abra runtime" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });
});
