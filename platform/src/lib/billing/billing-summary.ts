import "server-only";

import type { Firestore } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";

import {
  getFixedUtcWeekQuotaWindow,
  getQuotaExhaustedMessageForTier,
  getQuotaLimitForTier,
  isManagedBillingTier,
  MANAGED_BILLING_TIER_LABELS,
  QUOTA_UNIT_V1,
  type ManagedBillingTier,
  type QuotaUnitV1,
} from "./contracts";
import { summarizeManualBlockForBrowser } from "./manual-block-gate";
import { readManualBlockState } from "./manual-block-service";

export type BillingRuntimeState = "available" | "blocked" | "quota_exhausted";
export type BillingSummaryActionKind = "upgrade" | "manage_billing";

export interface BrowserSafeBillingSummary {
  tier: ManagedBillingTier;
  tierLabel: string;
  status: string;
  quota: {
    unit: QuotaUnitV1;
    limit: number;
    used: number;
    remaining: number;
    resetAt: string;
    windowId: string;
  };
  runtime: {
    state: BillingRuntimeState;
    blockReasonCode: string | null;
    blockReason: string | null;
  };
  action: {
    kind: BillingSummaryActionKind;
    label: string;
    endpoint: "/api/billing/checkout" | "/api/billing/portal";
    planKey?: "growth";
  };
}

interface BillingSummaryDocument {
  tier?: unknown;
  status?: unknown;
}

interface QuotaWindowDocument {
  used?: unknown;
}

function billingSummaryPath(accountId: string) {
  return `accounts/${accountId}/summaries/billing`;
}

function admissionQuotaWindowPath(accountId: string, windowId: string) {
  return `accounts/${accountId}/quota/windows/${windowId}/current`;
}

function finiteNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function statusForBrowser(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "missing";
}

function actionForTier(tier: ManagedBillingTier): BrowserSafeBillingSummary["action"] {
  if (tier === "growth") {
    return {
      kind: "manage_billing",
      label: "Manage billing",
      endpoint: "/api/billing/portal",
    };
  }

  return {
    kind: "upgrade",
    label: "Upgrade",
    endpoint: "/api/billing/checkout",
    planKey: "growth",
  };
}

export async function getBrowserSafeBillingSummary(input: {
  accountId: string;
  now?: Date | string | number;
  firestore?: Firestore;
}): Promise<BrowserSafeBillingSummary> {
  const firestore = input.firestore ?? getAdminFirestore();
  const window = getFixedUtcWeekQuotaWindow(input.now ?? new Date());
  const [summarySnapshot, quotaSnapshot, manualBlock] = await Promise.all([
    firestore.doc(billingSummaryPath(input.accountId)).get(),
    firestore.doc(admissionQuotaWindowPath(input.accountId, window.id)).get(),
    readManualBlockState(input.accountId),
  ]);

  const summary = summarySnapshot.data() as BillingSummaryDocument | undefined;
  const quotaWindow = quotaSnapshot.data() as QuotaWindowDocument | undefined;
  const tier: ManagedBillingTier = isManagedBillingTier(summary?.tier) ? summary.tier : "free";
  const quotaLimit = getQuotaLimitForTier(tier);
  const used = finiteNonNegativeInteger(quotaWindow?.used);
  const remaining = Math.max(quotaLimit.limit - used, 0);
  const manualBlockSummary = summarizeManualBlockForBrowser(manualBlock);
  const runtimeState: BillingRuntimeState = manualBlockSummary.isManuallyBlocked
    ? "blocked"
    : remaining <= 0
      ? "quota_exhausted"
      : "available";

  return {
    tier,
    tierLabel: MANAGED_BILLING_TIER_LABELS[tier],
    status: statusForBrowser(summary?.status),
    quota: {
      unit: QUOTA_UNIT_V1,
      limit: quotaLimit.limit,
      used,
      remaining,
      resetAt: window.endsAt,
      windowId: window.id,
    },
    runtime: {
      state: runtimeState,
      blockReasonCode: manualBlockSummary.reasonCode,
      blockReason: manualBlockSummary.isManuallyBlocked
        ? manualBlockSummary.reason
        : runtimeState === "quota_exhausted"
          ? getQuotaExhaustedMessageForTier(tier)
          : null,
    },
    action: actionForTier(tier),
  };
}
