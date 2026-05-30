import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(dashboard)/dashboard/actions", () => ({
  deleteAbraInstance: vi.fn(),
  submitDeploymentRequest: vi.fn(),
}));

describe("DeploymentConsole", () => {
  it("renders with the shared initial form state", async () => {
    const { DeploymentConsole } = await import("@/app/(dashboard)/dashboard/deployment-console");

    render(
      <DeploymentConsole
        initialDeployment={null}
        deploymentHistory={[]}
        persistenceWarning={null}
      />,
    );

    expect(
      (screen.getByLabelText("Instance name") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText("Environment") as HTMLSelectElement).value,
    ).toBe("preview");
    expect(
      (screen.getByLabelText("Branch / tag / version") as HTMLInputElement).value,
    ).toBe("main");
  });

  it("shows a single ready instance with a delete control", async () => {
    const { DeploymentConsole } = await import("@/app/(dashboard)/dashboard/deployment-console");

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
        deploymentHistory={[]}
        persistenceWarning={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "Abra runtime" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete instance" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Deploy Abra" })).toBeNull();
  });
});
