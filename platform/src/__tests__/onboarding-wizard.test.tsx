import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const completeOnboarding = vi.fn();

vi.mock("@/app/(dashboard)/dashboard/onboarding/actions", () => ({
  completeOnboarding,
}));

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeOnboarding.mockResolvedValue({ status: "idle", message: "", fieldErrors: {} });
  });

  it("does not submit on the Buffer step from Enter or native requestSubmit", async () => {
    const { OnboardingWizard } = await import(
      "@/app/(dashboard)/dashboard/onboarding/onboarding-wizard"
    );

    render(
      <OnboardingWizard
        initialBrandProfile={{
          brandDescription:
            "North Star Advisory helps independent experts turn field notes into credible content with a calm voice.",
          markdown: "# Brand Profile",
          completedAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
        }}
        initialTelegramConfigured={true}
        initialTelegramHomeChannel="388259993"
        initialBufferConfigured={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buffer" }));
    const bufferInput = screen.getByPlaceholderText("Leave blank to keep current");
    fireEvent.keyDown(bufferInput, { key: "Enter", code: "Enter" });

    const form = bufferInput.closest("form");
    expect(form).not.toBeNull();
    form?.requestSubmit();

    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it("submits only when the final Confirm setup button is activated", async () => {
    const { OnboardingWizard } = await import(
      "@/app/(dashboard)/dashboard/onboarding/onboarding-wizard"
    );

    render(
      <OnboardingWizard
        initialBrandProfile={{
          brandDescription:
            "North Star Advisory helps independent experts turn field notes into credible content with a calm voice.",
          markdown: "# Brand Profile",
          completedAt: "2026-06-24T00:00:00.000Z",
          updatedAt: "2026-06-24T00:00:00.000Z",
        }}
        initialTelegramConfigured={true}
        initialTelegramHomeChannel="388259993"
        initialBufferConfigured={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buffer" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm setup" }));

    await waitFor(() => {
      expect(completeOnboarding).toHaveBeenCalledTimes(1);
    });

    const submittedFormData = completeOnboarding.mock.calls[0]?.[1] as FormData;
    expect(submittedFormData.get("confirmOnboarding")).toBe("yes");
  });
});
