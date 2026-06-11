import { afterEach, describe, expect, test, vi } from "vitest";

import {
  decryptSecret,
  encryptSecret,
  fingerprintSecret,
  redactSecretSummary,
} from "@/lib/runtime-env/encryption";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");
const ALTERNATE_TEST_KEY = Buffer.alloc(32, 11).toString("base64url");

function useRuntimeEnvKey(key = TEST_KEY) {
  vi.stubEnv("RUNTIME_ENV_ENCRYPTION_KEY", key);
}

function tamperEnvelopePart(value: string): string {
  const decoded = Buffer.from(value, "base64url");

  if (decoded.length === 0) {
    throw new Error("Cannot tamper an empty encrypted runtime env envelope part.");
  }

  const tampered = Buffer.from(decoded);
  tampered[0] ^= 0xff;

  return tampered.toString("base64url");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runtime env encryption helpers", () => {
  test("encrypts and decrypts secrets with a versioned AES-GCM envelope", () => {
    useRuntimeEnvKey();

    const plaintext = "sk_live_runtime_env_secret";
    const encrypted = encryptSecret(plaintext);

    expect(encrypted).toMatch(/^enc:v1:aes-256-gcm:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  test("uses a random IV so the same plaintext produces different ciphertext", () => {
    useRuntimeEnvKey();

    const first = encryptSecret("same-secret-value");
    const second = encryptSecret("same-secret-value");

    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("same-secret-value");
    expect(decryptSecret(second)).toBe("same-secret-value");
  });

  test("creates stable keyed fingerprints without plaintext fragments", () => {
    useRuntimeEnvKey();

    const plaintext = "super-secret-token";
    const first = fingerprintSecret(plaintext);
    const second = fingerprintSecret(plaintext);
    const different = fingerprintSecret("another-secret-token");

    expect(first).toMatch(/^hmac-sha256:[0-9a-f]{16}$/);
    expect(second).toBe(first);
    expect(different).not.toBe(first);
    expect(first).not.toContain("super");
    expect(first).not.toContain("secret");
    expect(first).not.toContain("token");
  });

  test("accepts base64url encoded 32-byte runtime keys", () => {
    useRuntimeEnvKey(ALTERNATE_TEST_KEY);

    const encrypted = encryptSecret("base64url-key-secret");

    expect(decryptSecret(encrypted)).toBe("base64url-key-secret");
  });

  test("fails closed when the runtime encryption key is missing outside tests", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => encryptSecret("missing-key-secret")).toThrow("Missing required runtime env encryption key");
    expect(() => fingerprintSecret("missing-key-secret")).toThrow("Missing required runtime env encryption key");
  });

  test("rejects invalid runtime encryption keys", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RUNTIME_ENV_ENCRYPTION_KEY", Buffer.alloc(16, 1).toString("base64"));

    expect(() => encryptSecret("wrong-length-key-secret")).toThrow("Invalid runtime env encryption key length");

    vi.stubEnv("RUNTIME_ENV_ENCRYPTION_KEY", "not a base64 key");

    expect(() => encryptSecret("invalid-key-secret")).toThrow("Invalid runtime env encryption key");
  });

  test("rejects malformed envelopes and tampered ciphertext or tags", () => {
    useRuntimeEnvKey();

    const encrypted = encryptSecret("do-not-tamper");
    const parts = encrypted.split(":");
    const tamperedCiphertext = [
      ...parts.slice(0, 5),
      tamperEnvelopePart(parts[5]),
    ].join(":");
    const tamperedTag = [
      ...parts.slice(0, 4),
      tamperEnvelopePart(parts[4]),
      parts[5],
    ].join(":");

    expect(() => decryptSecret("plaintext")).toThrow("Invalid encrypted runtime env secret envelope");
    expect(() => decryptSecret("enc:v1:aes-256-gcm:bad-iv:bad-tag:bad-ciphertext")).toThrow(
      "Invalid encrypted runtime env secret envelope",
    );
    expect(() => decryptSecret(tamperedCiphertext)).toThrow("Unable to decrypt encrypted runtime env secret");
    expect(() => decryptSecret(tamperedTag)).toThrow("Unable to decrypt encrypted runtime env secret");
  });

  test("redacted summaries contain only configured metadata and fingerprints", () => {
    useRuntimeEnvKey();

    const plaintext = "super-secret-token";
    const summary = redactSecretSummary(plaintext);
    const serializedSummary = JSON.stringify(summary);

    expect(summary).toEqual({
      configured: true,
      fingerprint: fingerprintSecret(plaintext),
    });
    expect(serializedSummary).not.toContain(plaintext);
    expect(serializedSummary).not.toContain("super");
    expect(serializedSummary).not.toContain("secret-token");
    expect(serializedSummary).not.toContain("token");
  });
});
