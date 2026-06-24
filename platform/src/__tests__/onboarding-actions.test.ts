import { describe, expect, it, vi, beforeEach } from "vitest";

const requireApiAuth = vi.fn();
const loadAgentConfig = vi.fn();
const saveAgentConfig = vi.fn();
const saveRuntimeEnvFields = vi.fn();
const updateCurrentDeploymentRuntimeEnvForUser = vi.fn();
const saveBrandProfile = vi.fn();
const revalidatePath = vi.fn();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/auth", () => ({
  requireApiAuth,
}));

vi.mock("@/lib/agent-config/service", () => ({
  loadAgentConfig,
  saveAgentConfig,
}));

vi.mock("@/lib/runtime-env/service", () => ({
  saveRuntimeEnvFields,
}));

vi.mock("@/lib/deployments", () => ({
  updateCurrentDeploymentRuntimeEnvForUser,
}));

vi.mock("@/lib/brand-profile/service", () => ({
  saveBrandProfile,
}));

function buildFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe("onboarding actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiAuth.mockResolvedValue({ user: { id: "user-1" } });
    loadAgentConfig.mockResolvedValue(null);
    saveBrandProfile.mockResolvedValue({ markdown: "# Saved" });
    saveRuntimeEnvFields.mockResolvedValue({ success: true, versionId: "ver-1", errors: [] });
    updateCurrentDeploymentRuntimeEnvForUser.mockResolvedValue({ applied: false, status: "saved" });
  });

  it("rejects incomplete brand and Telegram setup before saving", async () => {
    const { completeOnboarding, initialOnboardingFormState } = await import(
      "@/app/(dashboard)/dashboard/onboarding/actions"
    );

    const result = await completeOnboarding(initialOnboardingFormState, buildFormData({}));

    expect(result.status).toBe("error");
    expect(result.fieldErrors.brand).toBeDefined();
    expect(result.fieldErrors.telegram).toBeDefined();
    expect(saveBrandProfile).not.toHaveBeenCalled();
    expect(saveAgentConfig).not.toHaveBeenCalled();
  });

  it("saves brand, Telegram, and Buffer values before redirecting to dashboard", async () => {
    const { completeOnboarding, initialOnboardingFormState } = await import(
      "@/app/(dashboard)/dashboard/onboarding/actions"
    );

    await expect(
      completeOnboarding(
        initialOnboardingFormState,
        buildFormData({
          brandDescription:
            "North Star Advisory helps independent experts turn field notes into credible content with a calm, specific voice.",
          telegramBotToken: "token-123",
          telegramHomeChannel: "388259993",
          telegramAllowedUsers: "388259993,123456",
          bufferApiKey: "buffer-token",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(saveBrandProfile).toHaveBeenCalledWith("user-1", {
      brandDescription:
        "North Star Advisory helps independent experts turn field notes into credible content with a calm, specific voice.",
    });
    expect(saveAgentConfig).toHaveBeenCalledWith("user-1", {
      telegramBotToken: "token-123",
      telegramHomeChannel: "388259993",
      telegramAllowedUsers: "388259993,123456",
    });
    expect(saveRuntimeEnvFields).toHaveBeenCalledWith("user-1", { values: { BUFFER_API_KEY: "buffer-token" } });
    expect(updateCurrentDeploymentRuntimeEnvForUser).toHaveBeenCalledWith("user-1", "ver-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/onboarding");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns a form error when existing Telegram setup cannot be loaded", async () => {
    loadAgentConfig.mockRejectedValue(new Error("firestore unavailable"));
    const { completeOnboarding, initialOnboardingFormState } = await import(
      "@/app/(dashboard)/dashboard/onboarding/actions"
    );

    const result = await completeOnboarding(
      initialOnboardingFormState,
      buildFormData({
        brandDescription:
          "North Star Advisory helps experts turn field notes into credible content with a calm, specific voice.",
        telegramBotToken: "token-123",
        telegramHomeChannel: "388259993",
      }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Abra could not load your existing Telegram setup. Try again in a moment.",
      fieldErrors: {},
    });
    expect(saveBrandProfile).not.toHaveBeenCalled();
    expect(saveRuntimeEnvFields).not.toHaveBeenCalled();
  });

  it("surfaces Buffer encryption/save errors without throwing a server action 500", async () => {
    saveRuntimeEnvFields.mockResolvedValue({
      success: false,
      versionId: null,
      errors: ["Runtime environment encryption is not configured."],
    });
    const { completeOnboarding, initialOnboardingFormState } = await import(
      "@/app/(dashboard)/dashboard/onboarding/actions"
    );

    const result = await completeOnboarding(
      initialOnboardingFormState,
      buildFormData({
        brandDescription:
          "North Star Advisory helps independent experts turn field notes into credible content with a calm, specific voice.",
        telegramBotToken: "token-123",
        telegramHomeChannel: "388259993",
        bufferApiKey: "buffer-token",
      }),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe("Runtime environment encryption is not configured.");
    expect(result.fieldErrors.buffer).toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
