"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApiAuth } from "@/lib/auth";
import { loadAgentConfig, saveAgentConfig } from "@/lib/agent-config/service";
import { saveRuntimeEnvFieldsAction } from "@/lib/runtime-env/actions";
import { saveBrandProfile } from "@/lib/brand-profile/service";

export type OnboardingFormStatus = "idle" | "error" | "success";

export interface OnboardingFormState {
  status: OnboardingFormStatus;
  message: string;
  fieldErrors: Partial<Record<"brand" | "telegram" | "buffer", string>>;
}

export const initialOnboardingFormState: OnboardingFormState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function errorState(
  message: string,
  fieldErrors: OnboardingFormState["fieldErrors"] = {},
): OnboardingFormState {
  return { status: "error", message, fieldErrors };
}

export async function completeOnboarding(
  previousState: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  void previousState;

  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return errorState("Your session expired. Sign in again to finish onboarding.");
  }

  const brandDescription = formText(formData, "brandDescription");
  const telegramBotToken = formText(formData, "telegramBotToken");
  const telegramHomeChannel = formText(formData, "telegramHomeChannel");
  const telegramAllowedUsers = formText(formData, "telegramAllowedUsers") || telegramHomeChannel;
  const bufferApiKey = formText(formData, "bufferApiKey");

  const existingAgentConfig = await loadAgentConfig(authResult.user.id);
  const effectiveTelegramBotToken = telegramBotToken || existingAgentConfig?.telegramBotToken || "";
  const effectiveTelegramHomeChannel = telegramHomeChannel || existingAgentConfig?.telegramHomeChannel || "";
  const effectiveTelegramAllowedUsers = telegramAllowedUsers || existingAgentConfig?.telegramAllowedUsers || effectiveTelegramHomeChannel;

  const fieldErrors: OnboardingFormState["fieldErrors"] = {};
  if (brandDescription.length < 24) {
    fieldErrors.brand = "Describe your brand, audience, offer, and voice in a few sentences.";
  }
  if (!effectiveTelegramBotToken || !effectiveTelegramHomeChannel) {
    fieldErrors.telegram = "Add a Telegram bot token and home channel/chat ID before deploying Abra.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return errorState("Finish the required onboarding fields.", fieldErrors);
  }

  try {
    await saveBrandProfile(authResult.user.id, { brandDescription });

    await saveAgentConfig(authResult.user.id, {
      telegramBotToken: effectiveTelegramBotToken,
      telegramHomeChannel: effectiveTelegramHomeChannel,
      telegramAllowedUsers: effectiveTelegramAllowedUsers,
    });

    if (bufferApiKey) {
      const bufferResult = await saveRuntimeEnvFieldsAction({ values: { BUFFER_API_KEY: bufferApiKey } });
      if (!bufferResult.success) {
        return errorState(
          bufferResult.error?.message ?? bufferResult.errors[0] ?? "Could not save Buffer API key.",
          { buffer: "Buffer could not be saved. Check the key and try again." },
        );
      }
    }
  } catch {
    return errorState("Abra could not save onboarding right now. Try again in a moment.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/onboarding");
  redirect("/dashboard");
}
