import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const ENCRYPTION_KEY_ENV = "RUNTIME_ENV_ENCRYPTION_KEY";
const ENVELOPE_PREFIX = "enc:v1:aes-256-gcm";
const FINGERPRINT_DOMAIN = "runtime-env:fingerprint:v1\0";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const FINGERPRINT_HEX_CHARS = 16;

export interface RedactedSecretSummary {
  configured: boolean;
  fingerprint: string;
}

function getRuntimeEnvEncryptionKey(): Buffer {
  const encodedKey = process.env[ENCRYPTION_KEY_ENV];

  if (!encodedKey) {
    throw new Error(`Missing required runtime env encryption key: ${ENCRYPTION_KEY_ENV}`);
  }

  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(encodedKey)) {
    throw new Error(`Invalid runtime env encryption key: ${ENCRYPTION_KEY_ENV}`);
  }

  const decodedKey = Buffer.from(encodedKey, "base64");

  if (decodedKey.length !== KEY_BYTES) {
    throw new Error(`Invalid runtime env encryption key length: ${ENCRYPTION_KEY_ENV}`);
  }

  return decodedKey;
}

function toEnvelopePart(value: Buffer): string {
  return value.toString("base64url");
}

function fromEnvelopePart(value: string, expectedBytes?: number): Buffer {
  if (value && !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid encrypted runtime env secret envelope.");
  }

  const decoded = Buffer.from(value, "base64url");

  if (expectedBytes !== undefined && decoded.length !== expectedBytes) {
    throw new Error("Invalid encrypted runtime env secret envelope.");
  }

  return decoded;
}

export function encryptSecret(plaintext: string): string {
  const key = getRuntimeEnvEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_BYTES });
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_PREFIX,
    toEnvelopePart(iv),
    toEnvelopePart(tag),
    toEnvelopePart(ciphertext),
  ].join(":");
}

export function decryptSecret(encryptedSecret: string): string {
  const [scheme, version, algorithm, ivPart, tagPart, ciphertextPart, ...extraParts] = encryptedSecret.split(":");

  if (
    scheme !== "enc" ||
    version !== "v1" ||
    algorithm !== "aes-256-gcm" ||
    ivPart === undefined ||
    tagPart === undefined ||
    ciphertextPart === undefined ||
    extraParts.length > 0
  ) {
    throw new Error("Invalid encrypted runtime env secret envelope.");
  }

  const key = getRuntimeEnvEncryptionKey();
  const iv = fromEnvelopePart(ivPart, IV_BYTES);
  const tag = fromEnvelopePart(tagPart, AUTH_TAG_BYTES);
  const ciphertext = fromEnvelopePart(ciphertextPart);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: AUTH_TAG_BYTES });

  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt encrypted runtime env secret.");
  }
}

export function fingerprintSecret(plaintext: string): string {
  const key = getRuntimeEnvEncryptionKey();
  const digest = createHmac("sha256", key)
    .update(FINGERPRINT_DOMAIN, "utf8")
    .update(plaintext, "utf8")
    .digest("hex")
    .slice(0, FINGERPRINT_HEX_CHARS);

  return `hmac-sha256:${digest}`;
}

export function redactSecretSummary(plaintext: string): RedactedSecretSummary {
  return {
    configured: plaintext.length > 0,
    fingerprint: fingerprintSecret(plaintext),
  };
}
