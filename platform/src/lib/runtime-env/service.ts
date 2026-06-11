import { getAdminFirestore } from "@/lib/firebase/admin";
import { toIsoTimestamp } from "@/lib/firestore-serialization";
import * as admin from "firebase-admin";
import type { DocumentData } from "firebase-admin/firestore";
import {
  getRuntimeEnvDefinition,
  isSupportedRuntimeEnvKey,
  type RuntimeEnvKey,
} from "./definitions";
import {
  decryptSecret,
  encryptSecret,
  fingerprintSecret,
  redactSecretSummary,
} from "./encryption";
import type {
  RuntimeEnvActiveDocument,
  RuntimeEnvAuditAction,
  RuntimeEnvAuditEvent,
  RuntimeEnvDecryptedMap,
  RuntimeEnvDeleteInput,
  RuntimeEnvEncryptedEntries,
  RuntimeEnvEntrySource,
  RuntimeEnvMutationResult,
  RuntimeEnvRollbackInput,
  RuntimeEnvSaveInput,
  RuntimeEnvStoredEntry,
  RuntimeEnvSummary,
  RuntimeEnvVersionDocument,
} from "./types";

type RuntimeEnvWriteContext = {
  now?: Date;
  createId?: (kind: "version" | "event") => string;
};

function currentDocPath(authUserId: string) {
  return `accounts/${authUserId}/runtime-env/current`;
}

function versionDocPath(authUserId: string, versionId: string) {
  return `${currentDocPath(authUserId)}/versions/${versionId}`;
}

function auditDocPath(authUserId: string, eventId: string) {
  return `${currentDocPath(authUserId)}/audit/${eventId}`;
}

function defaultCreateId(kind: "version" | "event") {
  const prefix = kind === "version" ? "ver" : "evt";
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

function validateRuntimeEnvKey(key: string): RuntimeEnvKey {
  const definition = getRuntimeEnvDefinition(key);
  if (definition === null) {
    throw new Error(`Unsupported runtime env key: ${key}`);
  }
  if (definition.reserved || !isSupportedRuntimeEnvKey(key)) {
    throw new Error(`Reserved runtime env key cannot be managed: ${key}`);
  }
  return key;
}

function validateValues(values: RuntimeEnvSaveInput["values"]): Partial<Record<RuntimeEnvKey, string>> {
  const validated: Partial<Record<RuntimeEnvKey, string>> = {};

  for (const [key, value] of Object.entries(values)) {
    const validatedKey = validateRuntimeEnvKey(key);
    if (typeof value !== "string") {
      throw new Error(`Runtime env value must be a string: ${key}`);
    }
    if (value.trim().length === 0) {
      throw new Error(`Runtime env value cannot be empty: ${key}. Use delete to remove the value.`);
    }
    validated[validatedKey] = value;
  }

  return validated;
}

function safeServiceErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message.startsWith("Missing required runtime env encryption key:")) {
    return "Runtime environment encryption is not configured. Set RUNTIME_ENV_ENCRYPTION_KEY before saving runtime environment values.";
  }

  if (error.message.startsWith("Invalid runtime env encryption key")) {
    return "Runtime environment encryption is misconfigured. Set RUNTIME_ENV_ENCRYPTION_KEY to a valid 32-byte base64 value before saving runtime environment values.";
  }

  const safePrefixes = [
    "Unsupported runtime env key:",
    "Reserved runtime env key cannot be managed:",
    "Runtime env value must be a string:",
    "Runtime env value cannot be empty:",
    "Runtime env version not found:",
  ];

  return safePrefixes.some((prefix) => error.message.startsWith(prefix))
    ? error.message
    : fallback;
}

function cloneEntries(values: RuntimeEnvEncryptedEntries | undefined): RuntimeEnvEncryptedEntries {
  return { ...(values ?? {}) };
}

function createStoredEntry(
  plaintext: string,
  source: RuntimeEnvEntrySource,
  previousEntry: RuntimeEnvStoredEntry | undefined,
  timestamp: unknown,
): RuntimeEnvStoredEntry {
  return {
    encryptedValue: encryptSecret(plaintext),
    fingerprint: fingerprintSecret(plaintext),
    source,
    createdAt: previousEntry?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function dataToActiveDocument(data: DocumentData | undefined): RuntimeEnvActiveDocument | null {
  if (!data) return null;
  return {
    values: cloneEntries(data.values as RuntimeEnvEncryptedEntries | undefined),
    versionId: typeof data.versionId === "string" ? data.versionId : "",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function summaryFromActiveDocument(
  authUserId: string,
  active: RuntimeEnvActiveDocument | null,
  fallbackIso: string,
): RuntimeEnvSummary {
  if (active === null) {
    return {
      accountScope: authUserId,
      versionId: null,
      values: [],
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    accountScope: authUserId,
    versionId: active.versionId || null,
    createdAt: active.createdAt ? toIsoTimestamp(active.createdAt, fallbackIso) : null,
    updatedAt: active.updatedAt ? toIsoTimestamp(active.updatedAt, fallbackIso) : null,
    values: Object.entries(active.values)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => ({
        key: key as RuntimeEnvKey,
        configured: Boolean(entry?.fingerprint),
        fingerprint: entry?.fingerprint ?? "",
        source: entry?.source ?? "manual",
        createdAt: toIsoTimestamp(entry?.createdAt, fallbackIso),
        updatedAt: toIsoTimestamp(entry?.updatedAt, fallbackIso),
      })),
  };
}

async function loadActiveDocument(authUserId: string): Promise<RuntimeEnvActiveDocument | null> {
  const firestore = getAdminFirestore();
  const doc = await firestore.doc(currentDocPath(authUserId)).get();
  if (!doc.exists) return null;
  return dataToActiveDocument(doc.data() as DocumentData | undefined);
}

async function persistNewSnapshot(
  authUserId: string,
  values: RuntimeEnvEncryptedEntries,
  action: RuntimeEnvAuditAction,
  source: RuntimeEnvEntrySource,
  keys: RuntimeEnvKey[],
  previousActive: RuntimeEnvActiveDocument | null,
  context: RuntimeEnvWriteContext = {},
): Promise<RuntimeEnvMutationResult> {
  const firestore = getAdminFirestore();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const now = context.now ?? new Date();
  const fallbackIso = now.toISOString();
  const versionId = context.createId?.("version") ?? defaultCreateId("version");
  const eventId = context.createId?.("event") ?? defaultCreateId("event");
  const previousVersionId = previousActive?.versionId || null;
  const createdAt = previousActive?.createdAt ?? timestamp;

  const activeDocument: RuntimeEnvActiveDocument = {
    values,
    versionId,
    createdAt,
    updatedAt: timestamp,
  };
  const versionDocument: RuntimeEnvVersionDocument = {
    versionId,
    previousVersionId,
    action,
    keys,
    values,
    source,
    createdAt: timestamp,
  };
  const auditEvent: RuntimeEnvAuditEvent = {
    eventId,
    versionId,
    previousVersionId,
    action,
    keys,
    source,
    createdAt: timestamp,
  };

  await firestore.doc(versionDocPath(authUserId, versionId)).set(versionDocument);
  await firestore.doc(auditDocPath(authUserId, eventId)).set(auditEvent);
  await firestore.doc(currentDocPath(authUserId)).set(activeDocument, { merge: true });

  return {
    success: true,
    summary: summaryFromActiveDocument(authUserId, activeDocument, fallbackIso),
    versionId,
    eventId,
    errors: [],
  };
}

async function saveRuntimeEnvValues(
  authUserId: string,
  values: RuntimeEnvSaveInput["values"],
  action: Extract<RuntimeEnvAuditAction, "save" | "import">,
  source: Extract<RuntimeEnvEntrySource, "manual" | "import">,
  context: RuntimeEnvWriteContext = {},
): Promise<RuntimeEnvMutationResult> {
  try {
    const validatedValues = validateValues(values);
    const keys = Object.keys(validatedValues) as RuntimeEnvKey[];
    const active = await loadActiveDocument(authUserId);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const mergedValues = cloneEntries(active?.values);

    for (const key of keys) {
      const plaintext = validatedValues[key] ?? "";
      const redacted = redactSecretSummary(plaintext);
      mergedValues[key] = {
        ...createStoredEntry(plaintext, source, active?.values[key], timestamp),
        fingerprint: redacted.fingerprint,
      };
    }

    return await persistNewSnapshot(authUserId, mergedValues, action, source, keys, active, context);
  } catch (error) {
    const fallback = "Unable to save runtime env values.";

    return {
      success: false,
      summary: null,
      versionId: null,
      eventId: null,
      errors: [safeServiceErrorMessage(error, fallback)],
    };
  }
}

export async function loadRuntimeEnvSummary(authUserId: string): Promise<RuntimeEnvSummary> {
  const active = await loadActiveDocument(authUserId);
  return summaryFromActiveDocument(authUserId, active, new Date().toISOString());
}

export async function decryptRuntimeEnvForOrchestration(authUserId: string): Promise<RuntimeEnvDecryptedMap> {
  const active = await loadActiveDocument(authUserId);
  if (active === null) return {};

  const values: RuntimeEnvDecryptedMap = {};
  for (const [key, entry] of Object.entries(active.values)) {
    if (entry?.encryptedValue) {
      values[key as RuntimeEnvKey] = decryptSecret(entry.encryptedValue);
    }
  }

  return values;
}

export async function saveRuntimeEnvFields(
  authUserId: string,
  input: RuntimeEnvSaveInput,
  context: RuntimeEnvWriteContext = {},
): Promise<RuntimeEnvMutationResult> {
  return saveRuntimeEnvValues(authUserId, input.values, "save", "manual", context);
}

export async function saveRuntimeEnvImport(
  authUserId: string,
  input: RuntimeEnvSaveInput,
  context: RuntimeEnvWriteContext = {},
): Promise<RuntimeEnvMutationResult> {
  return saveRuntimeEnvValues(authUserId, input.values, "import", "import", context);
}

export async function deleteRuntimeEnvKey(
  authUserId: string,
  input: RuntimeEnvDeleteInput,
  context: RuntimeEnvWriteContext = {},
): Promise<RuntimeEnvMutationResult> {
  try {
    const key = validateRuntimeEnvKey(input.key);
    const active = await loadActiveDocument(authUserId);
    const values = cloneEntries(active?.values);
    delete values[key];

    return await persistNewSnapshot(authUserId, values, "delete", "delete", [key], active, context);
  } catch (error) {
    const fallback = "Unable to delete runtime env value.";

    return {
      success: false,
      summary: null,
      versionId: null,
      eventId: null,
      errors: [safeServiceErrorMessage(error, fallback)],
    };
  }
}

export async function rollbackRuntimeEnvVersion(
  authUserId: string,
  input: RuntimeEnvRollbackInput,
  context: RuntimeEnvWriteContext = {},
): Promise<RuntimeEnvMutationResult> {
  try {
    const firestore = getAdminFirestore();
    const versionDoc = await firestore.doc(versionDocPath(authUserId, input.versionId)).get();
    if (!versionDoc.exists) {
      throw new Error(`Runtime env version not found: ${input.versionId}`);
    }

    const versionData = versionDoc.data() as RuntimeEnvVersionDocument | undefined;
    const rollbackValues = cloneEntries(versionData?.values);
    const active = await loadActiveDocument(authUserId);
    const keys = Object.keys(rollbackValues) as RuntimeEnvKey[];

    return await persistNewSnapshot(authUserId, rollbackValues, "rollback", "rollback", keys, active, context);
  } catch (error) {
    const fallback = "Unable to rollback runtime env values.";

    return {
      success: false,
      summary: null,
      versionId: null,
      eventId: null,
      errors: [safeServiceErrorMessage(error, fallback)],
    };
  }
}
