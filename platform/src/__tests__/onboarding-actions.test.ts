import { describe, expect, it, vi, beforeEach } from "vitest";

const requireApiAuth = vi.fn();
const loadAgentConfig = vi.fn();
const saveAgentConfig = vi.fn();
const saveRuntimeEnvFieldsAction = vi.fn();
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

vi.mock("@/lib/runtime-env/actions", () => ({
  saveRuntimeEnvFieldsAction,
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
    saveRuntimeEnvFieldsAction.mockResolvedValue({ success: true, error: null, errors: [] });
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
    expect(saveRuntimeEnvFieldsAction).toHaveBeenCalledWith({ values: { BUFFER_API_KEY: "buffer-token" } });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/onboarding");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
