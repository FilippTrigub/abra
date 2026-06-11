import { loadAgentConfig } from "@/lib/agent-config/service";
import type { AgentConfig } from "@/lib/agent-config/types";
import { decryptRuntimeEnvForOrchestration } from "./service";
import type { RuntimeEnvDecryptedMap } from "./types";

const TELEGRAM_RUNTIME_ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_HOME_CHANNEL",
  "TELEGRAM_ALLOWED_USERS",
] as const;

type TelegramRuntimeEnvKey = (typeof TELEGRAM_RUNTIME_ENV_KEYS)[number];

function isPresentRuntimeValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function getTelegramAgentConfigFallbacks(
  agentConfig: Partial<AgentConfig> | null | undefined,
): Partial<Record<TelegramRuntimeEnvKey, string>> {
  const token = agentConfig?.telegramBotToken?.trim();
  const homeChannel = agentConfig?.telegramHomeChannel?.trim();
  const allowedUsers = agentConfig?.telegramAllowedUsers?.trim() || homeChannel;
  if (!token || !homeChannel) return {};

  return {
    TELEGRAM_BOT_TOKEN: token,
    TELEGRAM_HOME_CHANNEL: homeChannel,
    TELEGRAM_ALLOWED_USERS: allowedUsers,
  };
}

export function mergeTelegramAgentConfigIntoRuntimeEnv(
  runtimeEnv: RuntimeEnvDecryptedMap,
  agentConfig: Partial<AgentConfig> | null | undefined,
): RuntimeEnvDecryptedMap {
  const merged: RuntimeEnvDecryptedMap = { ...runtimeEnv };
  const fallbacks = getTelegramAgentConfigFallbacks(agentConfig);

  for (const key of TELEGRAM_RUNTIME_ENV_KEYS) {
    if (!isPresentRuntimeValue(merged[key]) && fallbacks[key]) {
      merged[key] = fallbacks[key];
    }
  }

  return merged;
}

export async function loadRuntimeEnvForOrchestrationWithTelegramCompat(
  authUserId: string,
): Promise<RuntimeEnvDecryptedMap> {
  const runtimeEnv = await decryptRuntimeEnvForOrchestration(authUserId);
  const hasAllTelegramValues = TELEGRAM_RUNTIME_ENV_KEYS.every((key) =>
    isPresentRuntimeValue(runtimeEnv[key]),
  );
  if (hasAllTelegramValues) return runtimeEnv;

  const agentConfig = await loadAgentConfig(authUserId);
  return mergeTelegramAgentConfigIntoRuntimeEnv(runtimeEnv, agentConfig);
}
