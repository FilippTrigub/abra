"use server";

import { getUser } from "@/lib/auth/supabase-client";
import {
  loadSettings as dbLoadSettings,
  saveSettings as dbSaveSettings,
  revertSettings as dbRevertSettings,
} from "./service";
import type {
  SettingsResponse,
  SettingsUpdatePayload,
  SettingsUpdateResult,
  ConfigSnapshot,
} from "./schema";
import { SETTINGS_DEFINITIONS } from "./definitions";

function buildDefaultValues(): ConfigSnapshot["values"] {
  const values = {} as ConfigSnapshot["values"];
  for (const def of SETTINGS_DEFINITIONS) {
    values[def.key] = def.defaultValue;
  }
  return values;
}

export async function loadUserSettings(): Promise<SettingsResponse> {
  const { user, error } = await getUser();

  if (error || !user) {
    return {
      snapshot: {
        id: "",
        accountScope: "",
        values: buildDefaultValues(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      definitions: [],
      persistence: "memory",
      warning: "Sign in to view settings.",
    };
  }

  return dbLoadSettings(user.id);
}

export async function updateUserSetting(
  payload: SettingsUpdatePayload,
  currentValues: Record<string, unknown>,
): Promise<SettingsUpdateResult> {
  const { user, error } = await getUser();

  if (error || !user) {
    return {
      success: false,
      snapshot: null,
      errors: [{ key: payload.key, message: "Sign in to update settings." }],
      restartRequired: false,
      warning: null,
    };
  }

  return dbSaveSettings(user.id, payload, currentValues as ConfigSnapshot["values"]);
}

export async function revertToDefaults(): Promise<SettingsUpdateResult> {
  const { user, error } = await getUser();

  if (error || !user) {
    return {
      success: false,
      snapshot: null,
      errors: [{ key: "defaultEnvironment", message: "Sign in to revert settings." }],
      restartRequired: false,
      warning: null,
    };
  }

  return dbRevertSettings(user.id);
}

export async function saveClientSideSettings(): Promise<{ ok: boolean }> {
  /* This action is a no-op on the server — the client persists to localStorage directly. */
  return { ok: true };
}
