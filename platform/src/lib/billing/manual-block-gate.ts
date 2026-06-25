import {
  isManualBlockReason,
  NO_MANUAL_BLOCK,
  type ManualBlockReason,
  type ManualBlockState,
} from "./contracts";

export const MANUAL_BLOCK_STATE_PATH_SEGMENTS = ["moderation", "current"] as const;

export type ManualBlockGateOperation = "create" | "start" | "update" | "admission" | "destroy";

export type ManualBlockGateDenyReason = "manual_block" | "ownership_not_verified";

export interface ManualBlockGateInput {
  operation: ManualBlockGateOperation;
  manualBlock: ManualBlockState;
  ownershipVerified?: boolean;
}

export interface ManualBlockGateDecision {
  operation: ManualBlockGateOperation;
  allowed: boolean;
  reasonCode: ManualBlockGateDenyReason | null;
}

export interface BrowserSafeManualBlockSummary {
  isManuallyBlocked: boolean;
  reasonCode: ManualBlockReason | null;
  reason: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizePublicReason(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const sanitized = value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

  return sanitized.length > 0 ? sanitized : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function manualBlockStatePath(accountId: string) {
  return `accounts/${accountId}/${MANUAL_BLOCK_STATE_PATH_SEGMENTS.join("/")}`;
}

export function normalizeManualBlockState(rawState: unknown): ManualBlockState {
  if (!isRecord(rawState) || rawState.blocked !== true) {
    return NO_MANUAL_BLOCK;
  }

  return {
    blocked: true,
    reason: isManualBlockReason(rawState.reason) ? rawState.reason : null,
    message: sanitizePublicReason(rawState.publicReason ?? rawState.message),
    operatorNote: stringOrNull(rawState.operatorNote),
    updatedAt: rawState.updatedAt ?? null,
    updatedBy: stringOrNull(rawState.updatedBy),
  };
}

export function summarizeManualBlockForBrowser(manualBlock: ManualBlockState): BrowserSafeManualBlockSummary {
  return {
    isManuallyBlocked: manualBlock.blocked,
    reasonCode: manualBlock.blocked ? manualBlock.reason : null,
    reason: manualBlock.blocked ? sanitizePublicReason(manualBlock.message) : null,
  };
}

export function decideManualBlockGate(input: ManualBlockGateInput): ManualBlockGateDecision {
  if (input.operation === "destroy") {
    return {
      operation: input.operation,
      allowed: input.ownershipVerified === true,
      reasonCode: input.ownershipVerified === true ? null : "ownership_not_verified",
    };
  }

  if (input.manualBlock.blocked) {
    return {
      operation: input.operation,
      allowed: false,
      reasonCode: "manual_block",
    };
  }

  return {
    operation: input.operation,
    allowed: true,
    reasonCode: null,
  };
}
