import type { RuntimeEnvKey } from "./definitions";

export type RuntimeEnvEntrySource = "manual" | "import" | "delete" | "rollback";
export type RuntimeEnvAuditAction = "save" | "import" | "delete" | "rollback";

export type RuntimeEnvEncryptedEntries = Partial<Record<RuntimeEnvKey, RuntimeEnvStoredEntry>>;

export interface RuntimeEnvStoredEntry {
  encryptedValue: string;
  fingerprint: string;
  source: RuntimeEnvEntrySource;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface RuntimeEnvActiveDocument {
  values: RuntimeEnvEncryptedEntries;
  versionId: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface RuntimeEnvVersionDocument {
  versionId: string;
  previousVersionId: string | null;
  action: RuntimeEnvAuditAction;
  keys: RuntimeEnvKey[];
  values: RuntimeEnvEncryptedEntries;
  source: RuntimeEnvEntrySource;
  createdAt: unknown;
}

export interface RuntimeEnvAuditEvent {
  eventId: string;
  versionId: string;
  previousVersionId: string | null;
  action: RuntimeEnvAuditAction;
  keys: RuntimeEnvKey[];
  source: RuntimeEnvEntrySource;
  createdAt: unknown;
}

export interface RuntimeEnvKeySummary {
  key: RuntimeEnvKey;
  configured: boolean;
  fingerprint: string;
  source: RuntimeEnvEntrySource;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeEnvSummary {
  accountScope: string;
  versionId: string | null;
  values: RuntimeEnvKeySummary[];
  createdAt: string | null;
  updatedAt: string | null;
}

export type RuntimeEnvDecryptedMap = Partial<Record<RuntimeEnvKey, string>>;

export interface RuntimeEnvSaveInput {
  values: Partial<Record<RuntimeEnvKey | string, string>>;
}

export interface RuntimeEnvDeleteInput {
  key: RuntimeEnvKey | string;
}

export interface RuntimeEnvRollbackInput {
  versionId: string;
}

export interface RuntimeEnvMutationResult {
  success: boolean;
  summary: RuntimeEnvSummary | null;
  versionId: string | null;
  eventId: string | null;
  errors: string[];
}
