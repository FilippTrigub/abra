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
    expect(getRuntimeEnvGroupLabel("contentMedia")).toBe("Content and media skills");
  });
});

describe("parseRuntimeEnvDotenv", () => {
  test("accepts supported keys, quoted values, comments, blank lines, and empty values", () => {
    const result = parseRuntimeEnvDotenv(`
# Supported values
BUFFER_API_KEY=buf_123
FAL_API_KEY="fal_456"
TELEGRAM_ALLOWED_USERS='123,456'
POSTHOG_HOST=https://app.posthog.com # local comment
BRAVE_API_KEY=
`);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.persistableValues.BUFFER_API_KEY).toBe("buf_123");
    expect(result.persistableValues.FAL_API_KEY).toBe("fal_456");
    expect(result.persistableValues.TELEGRAM_ALLOWED_USERS).toBe("123,456");
    expect(result.persistableValues.POSTHOG_HOST).toBe("https://app.posthog.com");
    expect(result.persistableValues.BRAVE_API_KEY).toBe("");
    expect(result.accepted.map((entry) => entry.key)).toEqual([
      "BUFFER_API_KEY",
      "FAL_API_KEY",
      "TELEGRAM_ALLOWED_USERS",
      "POSTHOG_HOST",
      "BRAVE_API_KEY",
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
