"use server";

import { requireApiAuth } from "@/lib/auth";
import {
  updateCurrentDeploymentRuntimeEnvForUser,
  type RuntimeEnvDeploymentUpdateResult,
} from "@/lib/deployments";
import { MAX_RUNTIME_ENV_DOTENV_IMPORT_BYTES } from "./constants";
import { parseRuntimeEnvDotenv, type RuntimeEnvDotenvIssue } from "./dotenv";
import {
  deleteRuntimeEnvKey,
  loadRuntimeEnvSummary,
  rollbackRuntimeEnvVersion,
  saveRuntimeEnvFields,
  saveRuntimeEnvImport,
} from "./service";
import type {
  RuntimeEnvDeleteInput,
  RuntimeEnvMutationResult,
  RuntimeEnvRollbackInput,
  RuntimeEnvSaveInput,
  RuntimeEnvSummary,
} from "./types";
import type { RuntimeEnvGroup, RuntimeEnvKey } from "./definitions";

type RuntimeEnvActionError = {
  code: "UNAUTHORIZED" | "INVALID_INPUT" | "SERVICE_ERROR";
  message: string;
};

export type RuntimeEnvDeploymentActionStatus = {
  applied: boolean;
  status: "saved" | "applying" | "live";
  message: string;
  reason: string | null;
  warning: string | null;
};

type RuntimeEnvActionResult = RuntimeEnvMutationResult & {
  error: RuntimeEnvActionError | null;
  deploymentUpdate: RuntimeEnvDeploymentActionStatus | null;
};

export type RuntimeEnvDotenvAcceptedPreview = {
  key: RuntimeEnvKey;
  lineNumber: number;
  label: string;
  group: RuntimeEnvGroup;
};

export type RuntimeEnvDotenvPreviewResult = {
  success: boolean;
  accepted: RuntimeEnvDotenvAcceptedPreview[];
  rejected: RuntimeEnvDotenvIssue[];
  warnings: RuntimeEnvDotenvIssue[];
  error: RuntimeEnvActionError | null;
};

export type RuntimeEnvImportActionResult = RuntimeEnvActionResult & {
  accepted: RuntimeEnvDotenvAcceptedPreview[];
  rejected: RuntimeEnvDotenvIssue[];
  warnings: RuntimeEnvDotenvIssue[];
};

export type RuntimeEnvApplyActionResult = {
  success: boolean;
  applied: boolean;
  status: "saved" | "applying" | "live";
  message: string;
  summary: RuntimeEnvSummary | null;
  error: RuntimeEnvActionError | null;
};

const applyStatusMessages: Record<RuntimeEnvApplyActionResult["status"], string> = {
  saved: "Runtime environment values are saved. Deploy Abra to apply them.",
  applying: "Runtime environment values were saved and Abra is updating.",
  live: "Runtime environment values are live on Abra.",
};

function unauthorizedError(message: string): RuntimeEnvActionError {
  return { code: "UNAUTHORIZED", message };
}

function serviceError(message = "Unable to update runtime environment values."): RuntimeEnvActionError {
  return { code: "SERVICE_ERROR", message };
}

function invalidInputError(message: string): RuntimeEnvActionError {
  return { code: "INVALID_INPUT", message };
}

function validationMutationResult(message: string): RuntimeEnvActionResult {
  return {
    success: false,
    summary: null,
    versionId: null,
    eventId: null,
    errors: [message],
    error: invalidInputError(message),
    deploymentUpdate: null,
  };
}

function serviceFailureMutationResult(): RuntimeEnvActionResult {
  const error = serviceError();

  return {
    success: false,
    summary: null,
    versionId: null,
    eventId: null,
    errors: [error.message],
    error,
    deploymentUpdate: null,
  };
}

function safeActionServiceErrorMessage(result: RuntimeEnvMutationResult): string {
  const message = result.errors[0];
  if (message?.startsWith("Runtime environment encryption is ")) {
    return message;
  }

  return serviceError().message;
}

function toActionResult(result: RuntimeEnvMutationResult): RuntimeEnvActionResult {
  if (result.success) {
    return { ...result, error: null, deploymentUpdate: null };
  }

  const message = safeActionServiceErrorMessage(result);

  return {
    ...result,
    errors: [message],
    error: serviceError(message),
    deploymentUpdate: null,
  };
}

function getDotenvImportSizeBytes(content: string) {
  return new TextEncoder().encode(content).length;
}

function isDotenvImportTooLarge(content: string) {
  return getDotenvImportSizeBytes(content) > MAX_RUNTIME_ENV_DOTENV_IMPORT_BYTES;
}

function oversizedImportMessage() {
  return "Runtime environment import is too large. Paste at most 64 KiB.";
}

function findEmptyRuntimeEnvValueKeys(values: RuntimeEnvSaveInput["values"]): string[] {
  return Object.entries(values)
    .filter(([, value]) => typeof value === "string" && value.trim().length === 0)
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
}

function filterNonEmptyRuntimeEnvValues(values: RuntimeEnvSaveInput["values"]): RuntimeEnvSaveInput["values"] {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
  );
}

function emptyValuesMessage(keys: string[]) {
  return keys.length === 1
    ? `Runtime environment value for ${keys[0]} cannot be empty. Use delete to remove a saved value.`
    : `Runtime environment values cannot be empty. Use delete to remove saved values. Empty keys: ${keys.join(", ")}.`;
}

function noNonEmptyImportValuesMessage() {
  return "No non-empty supported runtime environment values were found to import. Leave template entries blank or use delete to remove saved values.";
}

function toDeploymentActionStatus(
  updateResult: RuntimeEnvDeploymentUpdateResult,
): RuntimeEnvDeploymentActionStatus {
  const message = updateResult.applied
    ? applyStatusMessages.live
    : updateResult.reason === "No runtime deployed"
      ? applyStatusMessages.saved
      : updateResult.status === "applying"
        ? applyStatusMessages.applying
        : "Runtime environment values are saved, but Abra could not be updated automatically.";

  return {
    applied: updateResult.applied,
    status: updateResult.status,
    message,
    reason: updateResult.reason,
    warning: updateResult.warning,
  };
}

async function queueRuntimeEnvDeploymentUpdate(
  authUserId: string,
  result: RuntimeEnvActionResult,
): Promise<RuntimeEnvDeploymentActionStatus | null> {
  if (!result.success || !result.versionId) {
    return null;
  }

  try {
    const updateResult = await updateCurrentDeploymentRuntimeEnvForUser(authUserId, result.versionId);
    return toDeploymentActionStatus(updateResult);
  } catch {
    // Saving the runtime env version already succeeded. Deployment update failures
    // are intentionally non-fatal here and must not reflect secret-bearing errors.
    return {
      applied: false,
      status: "saved",
      message: "Runtime environment values are saved, but Abra could not be updated automatically.",
      reason: "Runtime update failed",
      warning: null,
    };
  }
}

function unauthenticatedMutationResult(message: string): RuntimeEnvActionResult {
  return {
    success: false,
    summary: null,
    versionId: null,
    eventId: null,
    errors: [message],
    error: unauthorizedError(message),
    deploymentUpdate: null,
  };
}

function sanitizeAcceptedPreview(content: string): RuntimeEnvDotenvPreviewResult {
  const preview = parseRuntimeEnvDotenv(content);

  return {
    success: preview.errors.length === 0,
    accepted: preview.accepted.map((entry) => ({
      key: entry.key,
      lineNumber: entry.lineNumber,
      label: entry.definition.label,
      group: entry.definition.group,
    })),
    rejected: preview.errors,
    warnings: preview.warnings,
    error: null,
  };
}

export async function loadRuntimeEnvSummaryAction(): Promise<{
  success: boolean;
  summary: RuntimeEnvSummary | null;
  error: RuntimeEnvActionError | null;
}> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return {
      success: false,
      summary: null,
      error: unauthorizedError("Sign in to view runtime environment values."),
    };
  }

  return {
    success: true,
    summary: await loadRuntimeEnvSummary(authResult.user.id),
    error: null,
  };
}

export async function previewRuntimeEnvDotenvImport(content: string): Promise<RuntimeEnvDotenvPreviewResult> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return {
      success: false,
      accepted: [],
      rejected: [],
      warnings: [],
      error: unauthorizedError("Sign in to preview runtime environment imports."),
    };
  }

  if (isDotenvImportTooLarge(content)) {
    const error = invalidInputError(oversizedImportMessage());

    return {
      success: false,
      accepted: [],
      rejected: [],
      warnings: [],
      error,
    };
  }

  return sanitizeAcceptedPreview(content);
}

export async function saveRuntimeEnvFieldsAction(input: RuntimeEnvSaveInput): Promise<RuntimeEnvActionResult> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedMutationResult("Sign in to update runtime environment values.");
  }

  const emptyKeys = findEmptyRuntimeEnvValueKeys(input.values);
  if (emptyKeys.length > 0) {
    return validationMutationResult(emptyValuesMessage(emptyKeys));
  }

  try {
    const result = toActionResult(await saveRuntimeEnvFields(authResult.user.id, input));
    const deploymentUpdate = await queueRuntimeEnvDeploymentUpdate(authResult.user.id, result);
    return { ...result, deploymentUpdate };
  } catch {
    return serviceFailureMutationResult();
  }
}

export async function saveRuntimeEnvImportAction(content: string): Promise<RuntimeEnvImportActionResult> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return {
      ...unauthenticatedMutationResult("Sign in to import runtime environment values."),
      accepted: [],
      rejected: [],
      warnings: [],
    };
  }

  if (isDotenvImportTooLarge(content)) {
    return {
      ...validationMutationResult(oversizedImportMessage()),
      accepted: [],
      rejected: [],
      warnings: [],
    };
  }

  const parsed = parseRuntimeEnvDotenv(content);
  const accepted = parsed.accepted.map((entry) => ({
    key: entry.key,
    lineNumber: entry.lineNumber,
    label: entry.definition.label,
    group: entry.definition.group,
  }));

  if (accepted.length === 0) {
    return {
      success: false,
      summary: null,
      versionId: null,
      eventId: null,
      errors: ["No supported runtime environment values were found to import."],
      error: { code: "INVALID_INPUT", message: "No supported runtime environment values were found to import." },
      deploymentUpdate: null,
      accepted,
      rejected: parsed.errors,
      warnings: parsed.warnings,
    };
  }

  const persistableValues = filterNonEmptyRuntimeEnvValues(parsed.persistableValues);
  if (Object.keys(persistableValues).length === 0) {
    return {
      ...validationMutationResult(noNonEmptyImportValuesMessage()),
      accepted,
      rejected: parsed.errors,
      warnings: parsed.warnings,
    };
  }

  try {
    const result = toActionResult(await saveRuntimeEnvImport(authResult.user.id, { values: persistableValues }));
    const deploymentUpdate = await queueRuntimeEnvDeploymentUpdate(authResult.user.id, result);

    return {
      ...result,
      deploymentUpdate,
      accepted,
      rejected: parsed.errors,
      warnings: parsed.warnings,
    };
  } catch {
    return {
      ...serviceFailureMutationResult(),
      accepted,
      rejected: parsed.errors,
      warnings: parsed.warnings,
    };
  }
}

export async function deleteRuntimeEnvKeyAction(input: RuntimeEnvDeleteInput): Promise<RuntimeEnvActionResult> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedMutationResult("Sign in to delete runtime environment values.");
  }

  try {
    const result = toActionResult(await deleteRuntimeEnvKey(authResult.user.id, input));
    const deploymentUpdate = await queueRuntimeEnvDeploymentUpdate(authResult.user.id, result);
    return { ...result, deploymentUpdate };
  } catch {
    return serviceFailureMutationResult();
  }
}

export async function rollbackRuntimeEnvVersionAction(input: RuntimeEnvRollbackInput): Promise<RuntimeEnvActionResult> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedMutationResult("Sign in to roll back runtime environment values.");
  }

  try {
    const result = toActionResult(await rollbackRuntimeEnvVersion(authResult.user.id, input));
    const deploymentUpdate = await queueRuntimeEnvDeploymentUpdate(authResult.user.id, result);
    return { ...result, deploymentUpdate };
  } catch {
    return serviceFailureMutationResult();
  }
}

export async function applyRuntimeEnvAction(): Promise<RuntimeEnvApplyActionResult> {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return {
      success: false,
      applied: false,
      status: "saved",
      message: "Sign in to apply runtime environment values.",
      summary: null,
      error: unauthorizedError("Sign in to apply runtime environment values."),
    };
  }

  const summary = await loadRuntimeEnvSummary(authResult.user.id);
  const updateResult = await updateCurrentDeploymentRuntimeEnvForUser(
    authResult.user.id,
    summary?.versionId ?? undefined,
  );

  if (updateResult.applied) {
    return {
      success: true,
      applied: true,
      status: "live",
      message: applyStatusMessages.live,
      summary,
      error: null,
    };
  }

  const message = updateResult.reason === "No runtime deployed"
    ? applyStatusMessages.saved
    : updateResult.status === "applying"
      ? applyStatusMessages.applying
      : "Runtime environment values are saved, but Abra could not be updated automatically.";

  return {
    success: true,
    applied: false,
    status: updateResult.status,
    message,
    summary,
    error: null,
  };
}
