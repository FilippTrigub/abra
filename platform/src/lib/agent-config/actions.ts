"use server";

import { requireApiAuth } from "@/lib/auth";
import { loadAgentConfig, saveAgentConfig } from "./service";

export async function loadUserAgentConfig(): Promise<{
  configured: boolean;
  token: string | null;
  homeChannel: string | null;
}> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return { configured: false, token: null, homeChannel: null };
  }

  const config = await loadAgentConfig(authResult.user.id);
  return config
    ? {
        configured: true,
        token: config.telegramBotToken,
        homeChannel: config.telegramHomeChannel,
      }
    : { configured: false, token: null, homeChannel: null };
}

export async function saveUserAgentConfig(
  token: string,
  homeChannel: string,
): Promise<{ success: boolean; error?: string }> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return { success: false, error: "Sign in to save configuration." };
  }

  const trimmed = token.trim();
  const trimmedHomeChannel = homeChannel.trim();
  if (!trimmed) {
    return { success: false, error: "Bot token cannot be empty." };
  }
  if (!trimmedHomeChannel) {
    return { success: false, error: "Home channel cannot be empty." };
  }

  await saveAgentConfig(authResult.user.id, {
    telegramBotToken: trimmed,
    telegramHomeChannel: trimmedHomeChannel,
  });
  return { success: true };
}
