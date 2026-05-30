"use server";

import { requireApiAuth } from "@/lib/auth";
import { loadAgentConfig, saveAgentConfig } from "./service";

export async function loadUserAgentConfig(): Promise<{ configured: boolean; token: string | null }> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return { configured: false, token: null };
  }

  const config = await loadAgentConfig(authResult.user.id);
  return config
    ? { configured: true, token: config.telegramBotToken }
    : { configured: false, token: null };
}

export async function saveUserAgentConfig(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return { success: false, error: "Sign in to save configuration." };
  }

  const trimmed = token.trim();
  if (!trimmed) {
    return { success: false, error: "Bot token cannot be empty." };
  }

  await saveAgentConfig(authResult.user.id, { telegramBotToken: trimmed });
  return { success: true };
}
