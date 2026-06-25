import "server-only";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { getPlatformAccount } from "@/lib/platform-account";
import {
  decideManualBlockGate,
  getFixedUtcWeekQuotaWindow,
  getQuotaLimitForTier,
  isManagedBillingTier,
  type ManagedBillingTier,
} from "@/lib/billing";
import { readManualBlockState } from "@/lib/billing/manual-block-service";
import type { OrchestrationAction } from "./types";

export type OrchestrationGateOperation =
  | OrchestrationAction
  | "start"
  | "admission";

export type OrchestrationGateReasonCode =
  | "account_scope_mismatch"
  | "billing_state_unavailable"
  | "manual_block"
  | "operation_not_permitted"
  | "quota_exhausted";

export interface AuthorizedAccountScopes {
  accountId: string | null;
  scopes: Set<string>;
}

export interface OrchestrationGateDecision {
  allowed: boolean;
  accountId: string | null;
  operation: OrchestrationGateOperation;
  status: number;
  reasonCode: OrchestrationGateReasonCode | null;
  message: string | null;
}

export interface OrchestrationGateInput {
  authUserId: string;
  operation: OrchestrationGateOperation;
  requestedAccountId?: string | null;
  now?: Date | string | number;
}

interface BillingSummaryDocument {
  tier?: unknown;
}

const MUTATING_BILLING_GATED_OPERATIONS = new Set<OrchestrationGateOperation>([
  "admission",
  "create",
  "restart",
  "start",
  "update",
]);

function billingSummaryPath(accountId: string) {
  return `accounts/${accountId}/summaries/billing`;
}

function admissionQuotaWindowPath(accountId: string, windowId: string) {
  return `accounts/${accountId}/quota/windows/${windowId}/current`;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function deny(
  input: Pick<OrchestrationGateDecision, "accountId" | "operation" | "reasonCode" | "status"> & {
    message: string;
  },
): OrchestrationGateDecision {
  return {
    allowed: false,
    accountId: input.accountId,
    operation: input.operation,
    status: input.status,
    reasonCode: input.reasonCode,
    message: input.message,
  };
}

export async function resolveAuthorizedAccountScopes(authUserId: string): Promise<AuthorizedAccountScopes> {
  const scopes = new Set<string>([authUserId]);
  const account = await getPlatformAccount(authUserId);

  if (account?.id) {
    scopes.add(account.id);
  }

  return {
    accountId: account?.id ?? null,
    scopes,
  };
}

async function readLocalManagedBillingState(accountId: string, now: Date | string | number | undefined) {
  const firestore = getAdminFirestore();
  const summaryRef = firestore.doc(billingSummaryPath(accountId));
  const window = getFixedUtcWeekQuotaWindow(now ?? new Date());
  const quotaRef = firestore.doc(admissionQuotaWindowPath(accountId, window.id));
  const [summarySnapshot, quotaSnapshot] = await Promise.all([
    summaryRef.get(),
    quotaRef.get(),
  ]);
  const summary = summarySnapshot.data() as BillingSummaryDocument | undefined;
  const tier: ManagedBillingTier = isManagedBillingTier(summary?.tier) ? summary.tier : "free";
  const quotaLimit = getQuotaLimitForTier(tier);
  const quotaData = quotaSnapshot.data();
  const used = isFiniteNonNegativeNumber(quotaData?.used) ? Math.floor(quotaData.used) : 0;

  return {
    tier,
    quota: {
      used,
      limit: quotaLimit.limit,
    },
  };
}

export async function evaluateOrchestrationGate(input: OrchestrationGateInput): Promise<OrchestrationGateDecision> {
  const authorized = await resolveAuthorizedAccountScopes(input.authUserId);
  const requestedAccountId = input.requestedAccountId?.trim() || null;

  if (!authorized.accountId) {
    return deny({
      accountId: null,
      operation: input.operation,
      reasonCode: "account_scope_mismatch",
      status: 403,
      message: "No managed platform account is available for this principal.",
    });
  }

  if (requestedAccountId && !authorized.scopes.has(requestedAccountId)) {
    return deny({
      accountId: authorized.accountId,
      operation: input.operation,
      reasonCode: "account_scope_mismatch",
      status: 403,
      message: "The requested account does not belong to the authenticated principal.",
    });
  }

  if (input.operation === "destroy") {
    return {
      allowed: true,
      accountId: authorized.accountId,
      operation: input.operation,
      status: 200,
      reasonCode: null,
      message: null,
    };
  }

  if (!MUTATING_BILLING_GATED_OPERATIONS.has(input.operation)) {
    return deny({
      accountId: authorized.accountId,
      operation: input.operation,
      reasonCode: "operation_not_permitted",
      status: 403,
      message: "This orchestration operation is not permitted for the shared gate.",
    });
  }

  try {
    const [manualBlock, managedBilling] = await Promise.all([
      readManualBlockState(authorized.accountId),
      readLocalManagedBillingState(authorized.accountId, input.now),
    ]);
    const manualDecision = decideManualBlockGate({
      operation: input.operation === "restart" ? "start" : input.operation,
      manualBlock,
      ownershipVerified: true,
    });

    if (!manualDecision.allowed) {
      return deny({
        accountId: authorized.accountId,
        operation: input.operation,
        reasonCode: manualDecision.reasonCode === "manual_block" ? "manual_block" : "account_scope_mismatch",
        status: manualDecision.reasonCode === "manual_block" ? 403 : 403,
        message:
          manualDecision.reasonCode === "manual_block"
            ? "This account is manually blocked from starting or changing runtimes."
            : "The authenticated principal does not own this runtime.",
      });
    }

    if (input.operation === "admission" && managedBilling.quota.used >= managedBilling.quota.limit) {
      return deny({
        accountId: authorized.accountId,
        operation: input.operation,
        reasonCode: "quota_exhausted",
        status: 402,
        message: "Managed billing quota is exhausted for the current window.",
      });
    }

    return {
      allowed: true,
      accountId: authorized.accountId,
      operation: input.operation,
      status: 200,
      reasonCode: null,
      message: null,
    };
  } catch {
    return deny({
      accountId: authorized.accountId,
      operation: input.operation,
      reasonCode: "billing_state_unavailable",
      status: 503,
      message: "Managed billing, quota, or block state is unavailable.",
    });
  }
}
