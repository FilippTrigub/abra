import { afterEach, describe, expect, test, vi } from "vitest";

const {
  decryptRuntimeEnvForOrchestrationMock,
  loadAgentConfigMock,
} = vi.hoisted(() => ({
  decryptRuntimeEnvForOrchestrationMock: vi.fn(),
  loadAgentConfigMock: vi.fn(),
}));

vi.mock("@/lib/runtime-env/service", () => ({
  decryptRuntimeEnvForOrchestration: decryptRuntimeEnvForOrchestrationMock,
}));

vi.mock("@/lib/agent-config/service", () => ({
  loadAgentConfig: loadAgentConfigMock,
}));

import {
  loadRuntimeEnvForOrchestrationWithTelegramCompat,
  mergeTelegramAgentConfigIntoRuntimeEnv,
} from "@/lib/runtime-env/telegram-compat";

describe("runtime env Telegram legacy compatibility", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("old-only agent-config Telegram values hydrate the canonical runtime env map", () => {
    const merged = mergeTelegramAgentConfigIntoRuntimeEnv(
      { BUFFER_API_KEY: "buffer-runtime" },
      {
        telegramBotToken: " old-token ",
        telegramHomeChannel: " old-home ",
        telegramAllowedUsers: " old-user ",
      },
    );

    expect(merged).toEqual({
      BUFFER_API_KEY: "buffer-runtime",
      TELEGRAM_BOT_TOKEN: "old-token",
      TELEGRAM_HOME_CHANNEL: "old-home",
      TELEGRAM_ALLOWED_USERS: "old-user",
    });
  });

  test("legacy allowed users fall back to the legacy home channel when missing", () => {
    const merged = mergeTelegramAgentConfigIntoRuntimeEnv(
      {},
      {
        telegramBotToken: "old-token",
        telegramHomeChannel: "old-home",
      },
    );

    expect(merged).toEqual({
      TELEGRAM_BOT_TOKEN: "old-token",
      TELEGRAM_HOME_CHANNEL: "old-home",
      TELEGRAM_ALLOWED_USERS: "old-home",
    });
  });

  test("server helper reads old-only agent-config values when runtime env is empty", async () => {
    decryptRuntimeEnvForOrchestrationMock.mockResolvedValue({});
    loadAgentConfigMock.mockResolvedValue({
      telegramBotToken: "old-token",
      telegramHomeChannel: "old-home",
      telegramAllowedUsers: "old-user",
    });

    const loaded = await loadRuntimeEnvForOrchestrationWithTelegramCompat("user-old-only");

    expect(loaded).toEqual({
      TELEGRAM_BOT_TOKEN: "old-token",
      TELEGRAM_HOME_CHANNEL: "old-home",
      TELEGRAM_ALLOWED_USERS: "old-user",
    });
    expect(decryptRuntimeEnvForOrchestrationMock).toHaveBeenCalledWith("user-old-only");
    expect(loadAgentConfigMock).toHaveBeenCalledWith("user-old-only");
  });

  test("new-only runtime env Telegram values win and avoid legacy config reads", async () => {
    decryptRuntimeEnvForOrchestrationMock.mockResolvedValue({
      TELEGRAM_BOT_TOKEN: "runtime-token",
      TELEGRAM_HOME_CHANNEL: "runtime-home",
      TELEGRAM_ALLOWED_USERS: "runtime-user",
    });

    const loaded = await loadRuntimeEnvForOrchestrationWithTelegramCompat("user-new-only");

    expect(loaded).toEqual({
      TELEGRAM_BOT_TOKEN: "runtime-token",
      TELEGRAM_HOME_CHANNEL: "runtime-home",
      TELEGRAM_ALLOWED_USERS: "runtime-user",
    });
    expect(decryptRuntimeEnvForOrchestrationMock).toHaveBeenCalledWith("user-new-only");
    expect(loadAgentConfigMock).not.toHaveBeenCalled();
  });

  test("runtime env Telegram values take precedence over conflicting legacy config values", () => {
    const merged = mergeTelegramAgentConfigIntoRuntimeEnv({
      TELEGRAM_BOT_TOKEN: "runtime-token",
      TELEGRAM_HOME_CHANNEL: "runtime-home",
      TELEGRAM_ALLOWED_USERS: "runtime-user",
    }, {
      telegramBotToken: "legacy-token",
      telegramHomeChannel: "legacy-home",
      telegramAllowedUsers: "legacy-user",
    });

    expect(merged).toEqual({
      TELEGRAM_BOT_TOKEN: "runtime-token",
      TELEGRAM_HOME_CHANNEL: "runtime-home",
      TELEGRAM_ALLOWED_USERS: "runtime-user",
    });
  });

  test("legacy config supplies only missing Telegram runtime env keys", async () => {
    decryptRuntimeEnvForOrchestrationMock.mockResolvedValue({
      TELEGRAM_BOT_TOKEN: "runtime-token",
      TELEGRAM_HOME_CHANNEL: "runtime-home",
      BUFFER_API_KEY: "buffer-runtime",
    });
    loadAgentConfigMock.mockResolvedValue({
      telegramBotToken: "legacy-token",
      telegramHomeChannel: "legacy-home",
      telegramAllowedUsers: "legacy-user",
    });

    const loaded = await loadRuntimeEnvForOrchestrationWithTelegramCompat("user-partial");

    expect(loaded).toEqual({
      TELEGRAM_BOT_TOKEN: "runtime-token",
      TELEGRAM_HOME_CHANNEL: "runtime-home",
      TELEGRAM_ALLOWED_USERS: "legacy-user",
      BUFFER_API_KEY: "buffer-runtime",
    });
    expect(loadAgentConfigMock).toHaveBeenCalledWith("user-partial");
  });
});
