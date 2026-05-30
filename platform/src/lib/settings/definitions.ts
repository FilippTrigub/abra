import { type SettingDefinition, type SettingsKey, type SettingValue, type SettingsValidationError } from "./schema";

export const SETTINGS_DEFINITIONS: SettingDefinition[] = [
  {
    key: "defaultEnvironment",
    label: "Default deployment environment",
    description:
      "Choose the target environment for new deployment requests. This affects which deployment contract is used.",
    section: "deployment",
    defaultValue: "preview",
    type: "select",
    options: [
      { value: "preview", label: "Preview — ephemeral environments" },
      { value: "staging", label: "Staging — pre-production validation" },
      { value: "production", label: "Production — live users" },
    ],
  },
  {
    key: "deploymentAutoPoll",
    label: "Auto-poll deployment status",
    description:
      "When enabled, the dashboard automatically polls for deployment status updates after queueing a request.",
    section: "deployment",
    defaultValue: true,
    type: "toggle",
  },
  {
    key: "deploymentPollInterval",
    label: "Deployment poll interval (ms)",
    description:
      "How often the dashboard checks for deployment status updates. Minimum 500ms.",
    section: "deployment",
    defaultValue: 1500,
    type: "slider",
    inputType: "number",
    min: 500,
    max: 10000,
    step: 500,
  },
  {
    key: "notificationsEnabled",
    label: "Show deployment notifications",
    description:
      "Display toast-like notifications when deployment status changes. Only works while the dashboard is open.",
    section: "notifications",
    defaultValue: true,
    type: "toggle",
  },
  {
    key: "brandAccentColor",
    label: "Brand accent color",
    description:
      "Choose the primary accent color used for CTAs, active states, and highlights across the dashboard.",
    section: "appearance",
    defaultValue: "coral",
    type: "select",
    options: [
      { value: "coral", label: "Coral — warm brand hero" },
      { value: "violet", label: "Violet — secondary accent" },
      { value: "teal", label: "Teal — fresh highlight" },
    ],
  },
  {
    key: "dashboardLocale",
    label: "Dashboard language",
    description:
      "Set the display language for dashboard labels and messages. Currently defaults to English.",
    section: "general",
    defaultValue: "en-US",
    type: "select",
    options: [
      { value: "en-US", label: "English (US)" },
    ],
  },
];

const VALIDATION_RANGES: Record<SettingsKey, { min?: number; max?: number; allowedValues?: string[] }> = {
  defaultEnvironment: { allowedValues: ["preview", "staging", "production"] },
  deploymentAutoPoll: {},
  deploymentPollInterval: { min: 500, max: 10000 },
  notificationsEnabled: {},
  brandAccentColor: { allowedValues: ["coral", "violet", "teal"] },
  dashboardLocale: { allowedValues: ["en-US"] },
};

export function validateSetting(key: SettingsKey, value: SettingValue): { valid: boolean; errors: SettingsValidationError[] } {
  const errors: SettingsValidationError[] = [];
  const constraints = VALIDATION_RANGES[key];

  if (constraints.allowedValues) {
    const strValue = String(value);
    if (!constraints.allowedValues.includes(strValue)) {
      errors.push({
        key,
        message: `Value must be one of: ${constraints.allowedValues.join(", ")}.`,
      });
    }
  }

  if (typeof value === "number") {
    if (constraints.min !== undefined && value < constraints.min) {
      errors.push({
        key,
        message: `Value must be at least ${constraints.min}.`,
      });
    }
    if (constraints.max !== undefined && value > constraints.max) {
      errors.push({
        key,
        message: `Value must be at most ${constraints.max}.`,
      });
    }
  }

  if (typeof value === "boolean") {
    /* booleans are always valid */
  }

  return { valid: errors.length === 0, errors };
}

export function getDefinitionByKey(key: SettingsKey): SettingDefinition | null {
  return SETTINGS_DEFINITIONS.find((def) => def.key === key) ?? null;
}

export function getSettingsBySection(section: string): SettingDefinition[] {
  return SETTINGS_DEFINITIONS.filter((def) => def.section === section);
}

export function getSectionOrder(): SettingDefinition["section"][] {
  return ["general", "deployment", "notifications", "appearance"];
}

export function getSectionLabel(section: SettingDefinition["section"]): string {
  const labels: Record<SettingDefinition["section"], string> = {
    general: "General",
    deployment: "Deployment",
    notifications: "Notifications",
    appearance: "Appearance",
  };
  return labels[section];
}
