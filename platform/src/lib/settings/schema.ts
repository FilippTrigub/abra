/**
 * User-editable settings for the Claw Parade dashboard.
 *
 * This set is intentionally scoped to product-level knobs — no Terraform,
 * Azure, or raw infra handles are exposed. Each key carries a display label,
 * description, and a safe value range.
 */

/* ── Supported setting keys ──────────────────────────────── */

export type SettingsKey =
  | "defaultEnvironment"
  | "deploymentAutoPoll"
  | "deploymentPollInterval"
  | "notificationsEnabled"
  | "brandAccentColor"
  | "dashboardLocale";

/* ── Value unions per key ────────────────────────────────── */

export type SettingValue = string | boolean | number;

/* ── Per-key definition (used for rendering controls) ───── */

export interface SettingDefinition {
  key: SettingsKey;
  label: string;
  description: string;
  section: SettingsSection;
  defaultValue: SettingValue;
  type: "select" | "toggle" | "input" | "slider";
  options?: { value: string; label: string }[];
  inputType?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
}

/* ── Sections ────────────────────────────────────────────── */

export type SettingsSection =
  | "general"
  | "deployment"
  | "notifications"
  | "appearance";

/* ── Snapshot stored per account ─────────────────────────── */

export interface ConfigSnapshot {
  id: string;
  accountScope: string;
  values: Record<SettingsKey, SettingValue>;
  createdAt: string;
  updatedAt: string;
}

/* ── Saved settings response ─────────────────────────────── */

export interface SettingsResponse {
  snapshot: ConfigSnapshot;
  definitions: SettingDefinition[];
  persistence: "database" | "memory";
  warning: string | null;
}

/* ── Update payload ──────────────────────────────────────── */

export interface SettingsUpdatePayload {
  key: SettingsKey;
  value: SettingValue;
}

/* ── Validation error ────────────────────────────────────── */

export interface SettingsValidationError {
  key: SettingsKey;
  message: string;
}

/* ── Update result ───────────────────────────────────────── */

export interface SettingsUpdateResult {
  success: boolean;
  snapshot: ConfigSnapshot | null;
  errors: SettingsValidationError[];
  restartRequired: boolean;
  warning: string | null;
}
