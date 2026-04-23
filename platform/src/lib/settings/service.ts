import { type ConfigSnapshot, type SettingsResponse, type SettingsUpdatePayload, type SettingsUpdateResult } from "./schema";
import { createSupabaseServerClient } from "@/lib/auth/supabase-client";
import { getPlatformAccount } from "@/lib/platform-account";
import { SETTINGS_DEFINITIONS, validateSetting } from "./definitions";

function buildDefaultValues(): ConfigSnapshot["values"] {
  const values = {} as ConfigSnapshot["values"];
  for (const def of SETTINGS_DEFINITIONS) {
    values[def.key] = def.defaultValue;
  }
  return values;
}

export async function loadSettings(authUserId: string): Promise<SettingsResponse> {
  const account = await getPlatformAccount(authUserId);
  const accountScope = account?.id ?? "";

  if (accountScope) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .schema("platform")
        .from("platform_settings")
        .select("id, account_id, values, created_at, updated_at")
        .eq("account_id", accountScope)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const row = data?.[0];
      if (row) {
        const values = (row.values as ConfigSnapshot["values"]) ?? buildDefaultValues();
        return {
          snapshot: {
            id: row.id,
            accountScope: row.account_id,
            values,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
          definitions: SETTINGS_DEFINITIONS,
          persistence: "database",
          warning: null,
        };
      }
    } catch (err) {
      console.warn("[settings] DB load failed:", err);
    }
  }

  return {
    snapshot: {
      id: "",
      accountScope: "",
      values: buildDefaultValues(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    definitions: SETTINGS_DEFINITIONS,
    persistence: "memory",
    warning: "Database storage is unavailable. Showing default values.",
  };
}

export async function saveSettings(
  authUserId: string,
  payload: SettingsUpdatePayload,
  currentValues?: ConfigSnapshot["values"],
): Promise<SettingsUpdateResult> {
  const account = await getPlatformAccount(authUserId);
  const accountScope = account?.id ?? "";

  const validation = validateSetting(payload.key, payload.value);
  if (validation.errors.length > 0) {
    return {
      success: false,
      snapshot: null,
      errors: validation.errors,
      restartRequired: false,
      warning: null,
    };
  }

  if (accountScope) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .schema("platform")
        .from("platform_settings")
        .upsert(
          {
            account_id: accountScope,
            values: {
              ...(currentValues ?? {}),
              [payload.key]: payload.value,
            },
          },
          { onConflict: "account_id" },
        )
        .select("id, account_id, values, created_at, updated_at")
        .single();

      if (error) throw error;

      if (data) {
        const snap: ConfigSnapshot = {
          id: data.id,
          accountScope: data.account_id,
          values: data.values as ConfigSnapshot["values"],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        return {
          success: true,
          snapshot: snap,
          errors: [],
          restartRequired: payload.key === "defaultEnvironment",
          warning: null,
        };
      }
    } catch (err) {
      console.warn("[settings] DB save failed:", err);
    }
  }

  return {
    success: true,
    snapshot: null,
    errors: [],
    restartRequired: payload.key === "defaultEnvironment",
    warning: "Settings saved locally. Database storage was unavailable.",
  };
}

export async function revertSettings(authUserId: string): Promise<SettingsUpdateResult> {
  const account = await getPlatformAccount(authUserId);
  const accountScope = account?.id ?? "";

  if (accountScope) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .schema("platform")
        .from("platform_settings")
        .upsert(
          {
            account_id: accountScope,
            values: buildDefaultValues(),
          },
          { onConflict: "account_id" },
        )
        .select("id, account_id, values, created_at, updated_at")
        .single();

      if (error) throw error;

      if (data) {
        const snap: ConfigSnapshot = {
          id: data.id,
          accountScope: data.account_id,
          values: data.values as ConfigSnapshot["values"],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        return {
          success: true,
          snapshot: snap,
          errors: [],
          restartRequired: false,
          warning: null,
        };
      }
    } catch (err) {
      console.warn("[settings] DB revert failed:", err);
    }
  }

  return {
    success: true,
    snapshot: null,
    errors: [],
    restartRequired: false,
    warning: "Defaults restored locally. Database storage was unavailable.",
  };
}

export async function getSettingsSnapshot(authUserId: string): Promise<ConfigSnapshot | null> {
  const account = await getPlatformAccount(authUserId);
  const accountScope = account?.id ?? "";

  if (accountScope) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .schema("platform")
        .from("platform_settings")
        .select("id, account_id, values, created_at, updated_at")
        .eq("account_id", accountScope)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          id: data.id,
          accountScope: data.account_id,
          values: data.values as ConfigSnapshot["values"],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch {
      /* graceful fallthrough */
    }
  }

  return null;
}
