import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(dashboard)/dashboard/actions", () => ({
  submitDeploymentRequest: vi.fn(),
}));

describe("DeploymentConsole", () => {
  it("renders with the shared initial form state", async () => {
    const { DeploymentConsole } = await import("@/app/(dashboard)/dashboard/deployment-console");

    render(
      <DeploymentConsole initialDeployments={[]} persistenceWarning={null} />,
    );

    expect(
      (screen.getByLabelText("Deployment name") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByLabelText("Environment") as HTMLSelectElement).value,
    ).toBe("preview");
    expect(
      (screen.getByLabelText("Branch / tag / version") as HTMLInputElement).value,
    ).toBe("main");
  });
});
