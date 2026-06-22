import { describe, expect, test } from "vitest";

import {
  getRuntimeEnvDefinition,
  getRuntimeEnvDefinitionsByGroup,
  getRuntimeEnvGroupLabel,
  isReservedRuntimeEnvKey,
  isSupportedRuntimeEnvKey,
  SUPPORTED_RUNTIME_ENV_KEYS,
} from "@/lib/runtime-env/definitions";
import { parseRuntimeEnvDotenv } from "@/lib/runtime-env/dotenv";

describe("runtime env registry", () => {
  test("exports allowlisted Hermes and compatibility runtime env keys", () => {
    expect(SUPPORTED_RUNTIME_ENV_KEYS).toContain("BUFFER_API_KEY");
    expect(SUPPORTED_RUNTIME_ENV_KEYS).toContain("FAL_API_KEY");
    expect(SUPPORTED_RUNTIME_ENV_KEYS).toContain("AZURE_FOUNDRY_API_KEY");
    expect(SUPPORTED_RUNTIME_ENV_KEYS).toContain("OBSIDIAN_VAULT_PATH");
    expect(SUPPORTED_RUNTIME_ENV_KEYS).toContain("BROWSERBASE_PROXIES");
    expect(SUPPORTED_RUNTIME_ENV_KEYS).toContain("LINKUP_API_KEY");
    expect(SUPPORTED_RUNTIME_ENV_KEYS).toContain("TELEGRAM_HOME_CHANNEL_THREAD_ID");
    expect(SUPPORTED_RUNTIME_ENV_KEYS).not.toContain("KUBECONFIG_B64");
  });

  test("looks up supported, grouped, and reserved definitions", () => {
    const bufferDefinition = getRuntimeEnvDefinition("BUFFER_API_KEY");
    const reservedDefinition = getRuntimeEnvDefinition("KUBECONFIG_B64");

    expect(bufferDefinition).toEqual(expect.objectContaining({
      key: "BUFFER_API_KEY",
      group: "contentMedia",
      reserved: false,
      secret: true,
      injectIntoDotenv: true,
      injectAsProcessEnv: true,
      validation: expect.objectContaining({ allowEmptyValue: true }),
    }));
    expect(reservedDefinition).toEqual(expect.objectContaining({
      key: "KUBECONFIG_B64",
      group: "reserved",
      reserved: true,
      injectIntoDotenv: false,
      injectAsProcessEnv: false,
    }));
    expect(isSupportedRuntimeEnvKey("BUFFER_API_KEY")).toBe(true);
    expect(isSupportedRuntimeEnvKey("RANDOM_SECRET")).toBe(false);
    expect(isReservedRuntimeEnvKey("KUBECONFIG_B64")).toBe(true);
    expect(getRuntimeEnvDefinitionsByGroup("contentMedia").map((definition) => definition.key)).toContain("FAL_API_KEY");
    expect(getRuntimeEnvDefinitionsByGroup("utilities").map((definition) => definition.key)).toEqual(
      expect.arrayContaining([
        "OBSIDIAN_VAULT_PATH",
        "BROWSERBASE_PROXIES",
        "BROWSERBASE_ADVANCED_STEALTH",
        "BROWSER_SESSION_TIMEOUT",
        "BROWSER_INACTIVITY_TIMEOUT",
        "LINKUP_API_KEY",
        "TODOIST_API_KEY",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ACCOUNT_ID",
      ])
    );
    expect(getRuntimeEnvDefinition("OBSIDIAN_VAULT_PATH")).toEqual(expect.objectContaining({ secret: false }));
    expect(getRuntimeEnvDefinition("BROWSERBASE_PROXIES")).toEqual(expect.objectContaining({ secret: true }));
    expect(getRuntimeEnvDefinition("CLOUDFLARE_ACCOUNT_ID")).toEqual(expect.objectContaining({ secret: false }));
    expect(getRuntimeEnvDefinition("TELEGRAM_HOME_CHANNEL_THREAD_ID")).toEqual(expect.objectContaining({ group: "telegram", secret: false }));
    expect(getRuntimeEnvGroupLabel("contentMedia")).toBe("Content and media skills");
  });
});

describe("parseRuntimeEnvDotenv", () => {
  test("accepts supported keys, quoted values, comments, blank lines, and empty values", () => {
    const result = parseRuntimeEnvDotenv(`
# Supported values
BUFFER_API_KEY=buf_123
FAL_API_KEY="fal_456"
POSTHOG_HOST=https://app.posthog.com # local comment
BRAVE_API_KEY=
OBSIDIAN_VAULT_PATH=/vaults/abra
BROWSERBASE_PROXIES=http://user:pass@example.com:8080
BROWSERBASE_ADVANCED_STEALTH=true
BROWSER_SESSION_TIMEOUT=600000
BROWSER_INACTIVITY_TIMEOUT=120000
LINKUP_API_KEY=linkup_123
TODOIST_API_KEY=todoist_123
CLOUDFLARE_API_TOKEN=cf_token
CLOUDFLARE_ACCOUNT_ID=cf_account
TELEGRAM_HOME_CHANNEL_THREAD_ID=42
`);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.persistableValues.BUFFER_API_KEY).toBe("buf_123");
    expect(result.persistableValues.FAL_API_KEY).toBe("fal_456");
    expect(result.persistableValues.POSTHOG_HOST).toBe("https://app.posthog.com");
    expect(result.persistableValues.BRAVE_API_KEY).toBe("");
    expect(result.persistableValues.OBSIDIAN_VAULT_PATH).toBe("/vaults/abra");
    expect(result.persistableValues.BROWSERBASE_PROXIES).toBe("http://user:pass@example.com:8080");
    expect(result.persistableValues.BROWSERBASE_ADVANCED_STEALTH).toBe("true");
    expect(result.persistableValues.BROWSER_SESSION_TIMEOUT).toBe("600000");
    expect(result.persistableValues.BROWSER_INACTIVITY_TIMEOUT).toBe("120000");
    expect(result.persistableValues.LINKUP_API_KEY).toBe("linkup_123");
    expect(result.persistableValues.TODOIST_API_KEY).toBe("todoist_123");
    expect(result.persistableValues.CLOUDFLARE_API_TOKEN).toBe("cf_token");
    expect(result.persistableValues.CLOUDFLARE_ACCOUNT_ID).toBe("cf_account");
    expect(result.persistableValues.TELEGRAM_HOME_CHANNEL_THREAD_ID).toBe("42");
    expect(result.accepted.map((entry) => entry.key)).toEqual([
      "BUFFER_API_KEY",
      "FAL_API_KEY",
      "POSTHOG_HOST",
      "BRAVE_API_KEY",
      "OBSIDIAN_VAULT_PATH",
      "BROWSERBASE_PROXIES",
      "BROWSERBASE_ADVANCED_STEALTH",
      "BROWSER_SESSION_TIMEOUT",
      "BROWSER_INACTIVITY_TIMEOUT",
      "LINKUP_API_KEY",
      "TODOIST_API_KEY",
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "TELEGRAM_HOME_CHANNEL_THREAD_ID",
    ]);
  });

  test("reports duplicates as warnings and keeps the last allowlisted value", () => {
    const result = parseRuntimeEnvDotenv(`
BUFFER_API_KEY=buf_old
FAL_API_KEY=fal_456
BUFFER_API_KEY=buf_new
`);

    expect(result.errors).toEqual([]);
    expect(result.persistableValues.BUFFER_API_KEY).toBe("buf_new");
    expect(result.accepted.filter((entry) => entry.key === "BUFFER_API_KEY")).toHaveLength(1);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: "duplicate-key",
        key: "BUFFER_API_KEY",
        message: "Duplicate environment variable; the last supported value wins.",
      }),
    ]);
  });

  test("rejects reserved, invalid, and unknown keys without accepting their values", () => {
    const result = parseRuntimeEnvDotenv(`
KUBECONFIG_B64=do-not-import
1BAD=value
RANDOM_SECRET=value
BUFFER_API_KEY=buf_123
`);

    expect(result.persistableValues).toEqual({ BUFFER_API_KEY: "buf_123" });
    expect(result.accepted).toHaveLength(1);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "reserved-key", key: "KUBECONFIG_B64" }),
      expect.objectContaining({ code: "invalid-name", key: "1BAD" }),
      expect.objectContaining({ code: "unknown-key", key: "RANDOM_SECRET" }),
    ]);
    expect(JSON.stringify(result.errors)).not.toContain("do-not-import");
    expect(JSON.stringify(result.errors)).not.toContain("value");
  });

  test("rejects Telegram identity keys with a message pointing to Bot Setup, not the platform message", () => {
    const result = parseRuntimeEnvDotenv(`
TELEGRAM_BOT_TOKEN=do-not-import
TELEGRAM_HOME_CHANNEL=do-not-import
TELEGRAM_ALLOWED_USERS=do-not-import
BUFFER_API_KEY=buf_123
`);

    expect(result.persistableValues).toEqual({ BUFFER_API_KEY: "buf_123" });
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "reserved-key",
        key: "TELEGRAM_BOT_TOKEN",
        message: "This is managed in Settings → Telegram bot, not here.",
      }),
      expect.objectContaining({
        code: "reserved-key",
        key: "TELEGRAM_HOME_CHANNEL",
        message: "This is managed in Settings → Telegram bot, not here.",
      }),
      expect.objectContaining({
        code: "reserved-key",
        key: "TELEGRAM_ALLOWED_USERS",
        message: "This is managed in Settings → Telegram bot, not here.",
      }),
    ]);
    expect(JSON.stringify(result.errors)).not.toContain("do-not-import");
  });

  test("reports non-assignment lines without leaking their plaintext", () => {
    const result = parseRuntimeEnvDotenv(`
BUFFER_API_KEY=buf_123
sk_live_123
`);

    expect(result.persistableValues).toEqual({ BUFFER_API_KEY: "buf_123" });
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: "missing-assignment",
        key: null,
        lineNumber: 3,
      }),
    ]);
    expect(JSON.stringify(result.errors)).not.toContain("sk_live_123");
  });
});
