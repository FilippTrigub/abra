import "server-only";

import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";

import type { AdmissionLedgerEventDocument } from "./admission-ledger";
import {
  createInternalUsageReconciliationReport,
  type BillingTierStateObservation,
  type ManualBlockStateObservation,
  type UsageReconciliationReport,
} from "./langfuse-reconciliation";

const ADMIN_SECRET_ENV = "ABRA_BILLING_RECONCILIATION_SECRET";

function normalizeString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function accountIdFromPath(path: string) {
  const parts = path.split("/");
  return parts[0] === "accounts" && typeof parts[1] === "string" && parts[1].length > 0
    ? parts[1]
    : null;
}

function isUsageLedgerDocument(snapshot: QueryDocumentSnapshot) {
  return /^accounts\/[^/]+\/usage\/events\/[^/]+\/current$/.test(snapshot.ref.path);
}

function isBillingSummaryDocument(snapshot: QueryDocumentSnapshot) {
  return /^accounts\/[^/]+\/summaries\/billing$/.test(snapshot.ref.path);
}

function isManualBlockDocument(snapshot: QueryDocumentSnapshot) {
  return /^accounts\/[^/]+\/moderation\/current$/.test(snapshot.ref.path);
}

function billingTierStateFromSnapshot(snapshot: QueryDocumentSnapshot): BillingTierStateObservation | null {
  if (!isBillingSummaryDocument(snapshot)) {
    return null;
  }

  const accountId = accountIdFromPath(snapshot.ref.path);
  if (!accountId) {
    return null;
  }

  return {
    accountId,
    tier: snapshot.data().tier,
    source: "billing_summary",
  };
}

function manualBlockStateFromSnapshot(snapshot: QueryDocumentSnapshot): ManualBlockStateObservation | null {
  if (!isManualBlockDocument(snapshot)) {
    return null;
  }

  const accountId = accountIdFromPath(snapshot.ref.path);
  if (!accountId) {
    return null;
  }

  const data = snapshot.data();
  return {
    accountId,
    blocked: data.blocked,
    reason: data.reason,
    source: "manual_block",
  };
}

export function readBillingReconciliationAdminSecret() {
  return normalizeString(process.env[ADMIN_SECRET_ENV]);
}

export function isBillingReconciliationAdminCredential(credential: string | null | undefined) {
  const configuredSecret = readBillingReconciliationAdminSecret();
  const candidate = normalizeString(credential);

  return configuredSecret !== null && candidate !== null && candidate === configuredSecret;
}

export async function runInternalUsageReconciliationReport(input: {
  firestore?: Firestore;
} = {}): Promise<UsageReconciliationReport> {
  const firestore = input.firestore ?? getAdminFirestore();
  const [currentDocs, summaryDocs, moderationDocs] = await Promise.all([
    firestore.collectionGroup("current").get(),
    firestore.collectionGroup("summaries").get(),
    firestore.collectionGroup("moderation").get(),
  ]);

  const ledgerEvents = currentDocs.docs
    .filter(isUsageLedgerDocument)
    .map((snapshot) => snapshot.data() as AdmissionLedgerEventDocument);
  const billingTierStates = summaryDocs.docs
    .map(billingTierStateFromSnapshot)
    .filter((state): state is BillingTierStateObservation => state !== null);
  const manualBlockStates = moderationDocs.docs
    .map(manualBlockStateFromSnapshot)
    .filter((state): state is ManualBlockStateObservation => state !== null);

  return createInternalUsageReconciliationReport({
    ledgerEvents,
    providerUsage: [],
    billingTierStates,
    manualBlockStates,
  });
}
