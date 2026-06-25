import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { Firestore } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";

import {
  isManagedBillingTier,
  type AdmissionRejectReason,
  type ManagedBillingTier,
} from "./contracts";
import { BillingAdmissionService, type BillingAdmissionResult } from "./admission-ledger";
import {
  createManagedRuntimeCredential,
  getManagedAdmissionCredentialSecret,
} from "./managed-admission-runtime";
import { decideManualBlockGate } from "./manual-block-gate";
import { readManualBlockState } from "./manual-block-service";

export interface ManagedRuntimeAdmissionRequest {
  accountId: string;
  deploymentId: string;
  requestId: string;
  channelMessageId?: string | null;
  credential: string;
  now?: Date | string | number;
}

export interface ManagedRuntimeAdmissionDecision {
  allow: boolean;
  status: number;
  reasonCode: AdmissionRejectReason | "unauthorized" | "billing_state_unavailable" | null;
  message: string;
  reservation: BillingAdmissionResult | null;
}

interface BillingSummaryDocument {
  tier?: unknown;
}

function normalizeString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function billingSummaryPath(accountId: string) {
  return `accounts/${accountId}/summaries/billing`;
}

export function verifyManagedRuntimeCredential(input: {
  accountId: string;
  deploymentId: string;
  credential: string;
  secret: string;
}) {
  const expected = createManagedRuntimeCredential(input);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(input.credential, "utf8");

  return expectedBuffer.length === receivedBuffer.length
    && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function createManagedAdmissionIdempotencyKey(input: {
  accountId: string;
  deploymentId: string;
  requestId: string;
  channelMessageId?: string | null;
}) {
  const channelMessageId = normalizeString(input.channelMessageId);
  return [
    "managed-runtime",
    input.accountId,
    input.deploymentId,
    channelMessageId ? `channel:${channelMessageId}` : `request:${input.requestId}`,
  ].join(":");
}

async function readBillingTier(firestore: Firestore, accountId: string): Promise<ManagedBillingTier> {
  const snapshot = await firestore.doc(billingSummaryPath(accountId)).get();
  const summary = snapshot.data() as BillingSummaryDocument | undefined;
  return isManagedBillingTier(summary?.tier) ? summary.tier : "free";
}

function deny(input: {
  status: number;
  reasonCode: ManagedRuntimeAdmissionDecision["reasonCode"];
  message: string;
  reservation?: BillingAdmissionResult | null;
}): ManagedRuntimeAdmissionDecision {
  return {
    allow: false,
    status: input.status,
    reasonCode: input.reasonCode,
    message: input.message,
    reservation: input.reservation ?? null,
  };
}

export class ManagedRuntimeAdmissionService {
  private readonly admission: BillingAdmissionService;

  constructor(private readonly firestore: Firestore = getAdminFirestore()) {
    this.admission = new BillingAdmissionService(firestore);
  }

  async reserve(input: ManagedRuntimeAdmissionRequest): Promise<ManagedRuntimeAdmissionDecision> {
    const secret = getManagedAdmissionCredentialSecret();
    if (!secret || !verifyManagedRuntimeCredential({ ...input, secret })) {
      return deny({
        status: 401,
        reasonCode: "unauthorized",
        message: "Runtime admission credential is invalid.",
      });
    }

    try {
      const [tier, manualBlock] = await Promise.all([
        readBillingTier(this.firestore, input.accountId),
        readManualBlockState(input.accountId),
      ]);
      const idempotencyKey = createManagedAdmissionIdempotencyKey(input);
      const manualDecision = decideManualBlockGate({
        operation: "admission",
        manualBlock,
        ownershipVerified: true,
      });

      if (!manualDecision.allowed) {
        const reservation = await this.admission.deny({
          accountId: input.accountId,
          deploymentId: input.deploymentId,
          idempotencyKey,
          tier,
          reason: "manual_block",
          now: input.now,
        });
        return deny({
          status: 403,
          reasonCode: "manual_block",
          message: "This account is manually blocked from managed runtime admission.",
          reservation,
        });
      }

      const reservation = await this.admission.reserve({
        accountId: input.accountId,
        deploymentId: input.deploymentId,
        idempotencyKey,
        tier,
        now: input.now,
      });

      if (!reservation.admitted) {
        return deny({
          status: 402,
          reasonCode: reservation.denyReason === "quota_exhausted" ? "quota_exhausted" : "invalid_request",
          message: "Managed billing quota is exhausted for the current window.",
          reservation,
        });
      }

      return {
        allow: true,
        status: 200,
        reasonCode: null,
        message: "Managed runtime admission reserved.",
        reservation,
      };
    } catch {
      return deny({
        status: 503,
        reasonCode: "billing_state_unavailable",
        message: "Managed billing admission is unavailable.",
      });
    }
  }
}
