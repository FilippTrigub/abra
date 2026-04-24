import { type ConfigSnapshot, type SettingsResponse, type SettingsUpdatePayload, type SettingsUpdateResult } from "./schema";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { SETTINGS_DEFINITIONS, validateSetting } from "./definitions";
import * as admin from "firebase-admin";
import type { DocumentData, Timestamp } from "firebase-admin/firestore";

function buildDefaultValues(): ConfigSnapshot["values"] {
  const values = {} as ConfigSnapshot["values"];
  for (const def of SETTINGS_DEFINITIONS) {
    values[def.key] = def.defaultValue;
  }
  return values;
}

export async function loadSettings(authUserId: string): Promise<SettingsResponse> {
  try {
    const firestore = getAdminFirestore();
    const docRef = firestore.doc(`accounts/${authUserId}/settings/current`);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data() as DocumentData;
      if (data && data.values) {
        return {
          snapshot: {
            id: doc.id,
            accountScope: authUserId,
            values: data.values as ConfigSnapshot["values"],
            createdAt: (data.createdAt as Timestamp)?.toDate()?.toISOString() ?? new Date().toISOString(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate()?.toISOString() ?? new Date().toISOString(),
          },
          definitions: SETTINGS_DEFINITIONS,
          persistence: "database",
          warning: null,
        };
      }
    }
  } catch {
    // Firestore unavailable, return defaults
  }

  return {
    snapshot: {
      id: "",
      accountScope: authUserId,
      values: buildDefaultValues(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    definitions: SETTINGS_DEFINITIONS,
    persistence: "memory",
    warning: "Firestore storage is unavailable. Showing default values.",
  };
}

export async function saveSettings(
  authUserId: string,
  payload: SettingsUpdatePayload,
  _currentValues?: ConfigSnapshot["values"],
): Promise<SettingsUpdateResult> {
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

  try {
    const firestore = getAdminFirestore();
    const docRef = firestore.doc(`accounts/${authUserId}/settings/current`);
    const existingDoc = await docRef.get();

    const existingData = existingDoc.exists ? existingDoc.data() : undefined;
    const existingValues = existingData?.values ?? buildDefaultValues();
    
    const mergedValues = {
      ...existingValues,
      [payload.key]: payload.value,
    };

    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!existingDoc.exists) {
      await docRef.set({
        values: mergedValues,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await docRef.update({
        values: mergedValues,
        updatedAt: now,
      });
    }

    const snap: ConfigSnapshot = {
      id: authUserId,
      accountScope: authUserId,
      values: mergedValues,
      createdAt: existingDoc.exists 
        ? new Date().toISOString() 
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return {
      success: true,
      snapshot: snap,
      errors: [],
      restartRequired: payload.key === "defaultEnvironment",
      warning: null,
    };
  } catch {
    // Firestore unavailable, return local save result
  }

  return {
    success: true,
    snapshot: null,
    errors: [],
    restartRequired: payload.key === "defaultEnvironment",
    warning: "Settings saved locally. Firestore storage was unavailable.",
  };
}

export async function revertSettings(authUserId: string): Promise<SettingsUpdateResult> {
  try {
    const firestore = getAdminFirestore();
    const docRef = firestore.doc(`accounts/${authUserId}/settings/current`);
    
    const defaultValues = buildDefaultValues();
    const now = admin.firestore.FieldValue.serverTimestamp();
    
    await docRef.set({
      values: defaultValues,
      updatedAt: now,
    }, { merge: true });

    const snap: ConfigSnapshot = {
      id: authUserId,
      accountScope: authUserId,
      values: defaultValues,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return {
      success: true,
      snapshot: snap,
      errors: [],
      restartRequired: false,
      warning: null,
    };
  } catch {
    // Firestore unavailable, return local revert result
  }

  return {
    success: true,
    snapshot: null,
    errors: [],
    restartRequired: false,
    warning: "Defaults restored locally. Firestore storage was unavailable.",
  };
}

export async function getSettingsSnapshot(authUserId: string): Promise<ConfigSnapshot | null> {
  try {
    const firestore = getAdminFirestore();
    const docRef = firestore.doc(`accounts/${authUserId}/settings/current`);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data() as DocumentData;
      if (data && data.values) {
        return {
          id: doc.id,
          accountScope: authUserId,
          values: data.values as ConfigSnapshot["values"],
          createdAt: (data.createdAt as Timestamp)?.toDate()?.toISOString() ?? new Date().toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate()?.toISOString() ?? new Date().toISOString(),
        };
      }
    }
  } catch {
    // graceful fallthrough
  }

  return null;
}
