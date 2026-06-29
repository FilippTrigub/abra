import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardDeployment } from "@/lib/deployments";

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

const readyDeployment: DashboardDeployment = {
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
};

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
        initialDeployment={readyDeployment}
        persistenceWarning={null}
        telegramConfigured={true}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Abra runtime" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });

  it("clears the stop confirmation when the instance is already deleted", async () => {
    const { DeploymentConsole } = await import(
      "@/app/(dashboard)/dashboard/deployment-console"
    );

    const { rerender } = render(
      <DeploymentConsole
        initialDeployment={readyDeployment}
        persistenceWarning={null}
        telegramConfigured={true}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
    expect(screen.getByRole("button", { name: "Confirm stop" })).toBeTruthy();

    rerender(
      <DeploymentConsole
        initialDeployment={{
          ...readyDeployment,
          status: "deleted",
          updatedAt: "2026-01-01T00:02:00.000Z",
          orchestration: readyDeployment.orchestration
            ? {
                ...readyDeployment.orchestration,
                action: "destroy",
                lastKnownStatus: "deleted",
                lastSyncedAt: "2026-01-01T00:02:00.000Z",
              }
            : null,
        }}
        persistenceWarning={null}
        telegramConfigured={true}
      />,
    );

    expect(screen.queryByRole("button", { name: "Confirm stop" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });
});
