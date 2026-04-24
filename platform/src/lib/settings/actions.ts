"use server";

import { requireApiAuth } from "@/lib/auth";
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
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
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

  return dbLoadSettings(authResult.user.id);
}

export async function updateUserSetting(
  payload: SettingsUpdatePayload,
  currentValues: Record<string, unknown>,
): Promise<SettingsUpdateResult> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return {
      success: false,
      snapshot: null,
      errors: [{ key: payload.key, message: "Sign in to update settings." }],
      restartRequired: false,
      warning: null,
    };
  }

  return dbSaveSettings(authResult.user.id, payload, currentValues as ConfigSnapshot["values"]);
}

export async function revertToDefaults(): Promise<SettingsUpdateResult> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return {
      success: false,
      snapshot: null,
      errors: [{ key: "defaultEnvironment", message: "Sign in to revert settings." }],
      restartRequired: false,
      warning: null,
    };
  }

  return dbRevertSettings(authResult.user.id);
}

export async function saveClientSideSettings(): Promise<{ ok: boolean }> {
  /* This action is a no-op on the server — the client persists to localStorage directly. */
  return { ok: true };
}
