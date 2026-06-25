import "server-only";

import { createHash } from "node:crypto";

import type { DocumentReference, DocumentSnapshot, Firestore, Transaction } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";

import {
  getFixedUtcWeekQuotaWindow,
  getQuotaLimitForTier,
  QUOTA_LEDGER_STATE_BY_OPERATION,
  QUOTA_UNIT_V1,
  type AdmissionRejectReason,
  type ManagedBillingTier,
  type QuotaLedgerState,
  type QuotaUnitV1,
  type QuotaWindowRef,
} from "./contracts";

type AdmissionLedgerClock = Date | string | number;

export type AdmissionReserveStatus = "admitted" | "denied";
export type AdmissionDenyReason = AdmissionRejectReason | "duplicate";

export interface AdmissionIdempotencyInput {
  accountId: string;
  deploymentId?: string | null;
  channelMessageId?: string | null;
  requestId?: string | null;
  idempotencyKey?: string | null;
}

export interface BillingAdmissionReserveInput extends AdmissionIdempotencyInput {
  tier: ManagedBillingTier;
  now?: AdmissionLedgerClock;
}

export interface BillingAdmissionTransitionInput {
  accountId: string;
  eventId?: string | null;
  idempotencyKey?: string | null;
  now?: AdmissionLedgerClock;
}

export interface BillingAdmissionReleaseInput extends BillingAdmissionTransitionInput {
  /**
   * Defaults to false: a released reservation is treated as non-billable and
   * decrements the quota count only when it is released before commit.
   */
  billable?: boolean;
}

export interface BillingAdmissionDenyInput extends AdmissionIdempotencyInput {
  tier: ManagedBillingTier;
  reason: AdmissionDenyReason;
  now?: AdmissionLedgerClock;
}

export interface AdmissionQuotaWindowDocument {
  accountId: string;
  windowId: string;
  kind: QuotaWindowRef["kind"];
  startsAt: string;
  endsAt: string;
  unit: QuotaUnitV1;
  used: number;
  limit: number;
  updatedAt: string;
}

export interface AdmissionLedgerEventDocument {
  eventId: string;
  accountId: string;
  idempotencyKey: string;
  state: QuotaLedgerState;
  status: AdmissionReserveStatus;
  unit: QuotaUnitV1;
  window: QuotaWindowRef;
  tier: ManagedBillingTier;
  limit: number;
  usedAfter: number;
  billable: boolean;
  denyReason: AdmissionDenyReason | null;
  createdAt: string;
  updatedAt: string;
  reservedAt: string | null;
  committedAt: string | null;
  releasedAt: string | null;
  deniedAt: string | null;
}

export interface BillingAdmissionResult {
  eventId: string;
  duplicate: boolean;
  admitted: boolean;
  status: AdmissionReserveStatus;
  state: QuotaLedgerState;
  denyReason: AdmissionDenyReason | null;
  window: QuotaWindowRef;
  used: number;
  limit: number;
  event: AdmissionLedgerEventDocument;
}

export class BillingAdmissionLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingAdmissionLedgerError";
  }
}

function assertPathSegment(name: string, value: string) {
  if (value.trim().length === 0 || value.includes("/")) {
    throw new BillingAdmissionLedgerError(`Invalid ${name} for admission ledger path.`);
  }
}

function normalizeClock(input: AdmissionLedgerClock | undefined) {
  const date = input === undefined ? new Date() : new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new BillingAdmissionLedgerError("Invalid admission ledger timestamp.");
  }

  return date;
}

function normalizeString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function admissionQuotaWindowPath(accountId: string, windowId: string) {
  assertPathSegment("accountId", accountId);
  assertPathSegment("windowId", windowId);

  // Concrete document below accounts/{accountId}/quota/windows/{windowId}.
  // Firestore document paths need an even number of segments.
  return `accounts/${accountId}/quota/windows/${windowId}/current`;
}

export function admissionUsageEventPath(accountId: string, eventId: string) {
  assertPathSegment("accountId", accountId);
  assertPathSegment("eventId", eventId);

  // Concrete document below accounts/{accountId}/usage/events/{eventId}.
  // Firestore document paths need an even number of segments.
  return `accounts/${accountId}/usage/events/${eventId}/current`;
}

export function createAdmissionIdempotencyKey(input: AdmissionIdempotencyInput) {
  const explicitKey = normalizeString(input.idempotencyKey);
  if (explicitKey) {
    return explicitKey;
  }

  const deploymentId = normalizeString(input.deploymentId);
  const channelMessageId = normalizeString(input.channelMessageId);
  if (deploymentId && channelMessageId) {
    return `${input.accountId}:deployment:${deploymentId}:channel-message:${channelMessageId}`;
  }

  const requestId = normalizeString(input.requestId);
  if (requestId) {
    return `${input.accountId}:request:${requestId}`;
  }

  throw new BillingAdmissionLedgerError(
    "Admission ledger requires idempotencyKey, deploymentId + channelMessageId, or requestId.",
  );
}

export function createAdmissionEventId(input: AdmissionIdempotencyInput) {
  const idempotencyKey = createAdmissionIdempotencyKey(input);
  return `adm_${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32)}`;
}

function readUsed(snapshot: DocumentSnapshot) {
  const rawUsed = snapshot.exists ? snapshot.data()?.used : undefined;
  return typeof rawUsed === "number" && Number.isFinite(rawUsed) && rawUsed > 0
    ? Math.floor(rawUsed)
    : 0;
}

function eventFromSnapshot(snapshot: DocumentSnapshot): AdmissionLedgerEventDocument | null {
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();
  if (!data || typeof data.eventId !== "string" || typeof data.accountId !== "string") {
    return null;
  }

  return data as AdmissionLedgerEventDocument;
}

function quotaWindowDocument(input: {
  accountId: string;
  window: QuotaWindowRef;
  limit: number;
  used: number;
  now: string;
}): AdmissionQuotaWindowDocument {
  return {
    accountId: input.accountId,
    windowId: input.window.id,
    kind: input.window.kind,
    startsAt: input.window.startsAt,
    endsAt: input.window.endsAt,
    unit: QUOTA_UNIT_V1,
    used: input.used,
    limit: input.limit,
    updatedAt: input.now,
  };
}

function resultFromEvent(event: AdmissionLedgerEventDocument, duplicate: boolean): BillingAdmissionResult {
  return {
    eventId: event.eventId,
    duplicate,
    admitted: event.status === "admitted",
    status: event.status,
    state: event.state,
    denyReason: event.denyReason,
    window: event.window,
    used: event.usedAfter,
    limit: event.limit,
    event,
  };
}

export class BillingAdmissionService {
  constructor(private readonly firestore: Firestore = getAdminFirestore()) {}

  async reserve(input: BillingAdmissionReserveInput): Promise<BillingAdmissionResult> {
    const idempotencyKey = createAdmissionIdempotencyKey(input);
    const eventId = createAdmissionEventId(input);
    const nowDate = normalizeClock(input.now);
    const now = nowDate.toISOString();
    const window = getFixedUtcWeekQuotaWindow(nowDate);
    const quota = getQuotaLimitForTier(input.tier);
    const eventRef = this.firestore.doc(admissionUsageEventPath(input.accountId, eventId));
    const windowRef = this.firestore.doc(admissionQuotaWindowPath(input.accountId, window.id));

    return this.firestore.runTransaction(async (transaction) => {
      const existingEvent = eventFromSnapshot(await transaction.get(eventRef));
      if (existingEvent) {
        return resultFromEvent(existingEvent, true);
      }

      const windowSnapshot = await transaction.get(windowRef);
      const usedBefore = readUsed(windowSnapshot);
      const admitted = usedBefore < quota.limit;
      const usedAfter = admitted ? usedBefore + 1 : usedBefore;
      const event: AdmissionLedgerEventDocument = {
        eventId,
        accountId: input.accountId,
        idempotencyKey,
        state: admitted
          ? QUOTA_LEDGER_STATE_BY_OPERATION.reserve
          : QUOTA_LEDGER_STATE_BY_OPERATION.deny,
        status: admitted ? "admitted" : "denied",
        unit: QUOTA_UNIT_V1,
        window,
        tier: input.tier,
        limit: quota.limit,
        usedAfter,
        billable: admitted,
        denyReason: admitted ? null : "quota_exhausted",
        createdAt: now,
        updatedAt: now,
        reservedAt: admitted ? now : null,
        committedAt: null,
        releasedAt: null,
        deniedAt: admitted ? null : now,
      };

      transaction.set(eventRef, event, { merge: false });
      transaction.set(
        windowRef,
        quotaWindowDocument({
          accountId: input.accountId,
          window,
          limit: quota.limit,
          used: usedAfter,
          now,
        }),
        { merge: true },
      );

      return resultFromEvent(event, false);
    });
  }

  async commit(input: BillingAdmissionTransitionInput): Promise<BillingAdmissionResult> {
    return this.transitionExisting(input, (event, now) => {
      if (event.state !== "reserved") {
        return event;
      }

      return {
        ...event,
        state: QUOTA_LEDGER_STATE_BY_OPERATION.commit,
        billable: true,
        updatedAt: now,
        committedAt: now,
      };
    });
  }

  async release(input: BillingAdmissionReleaseInput): Promise<BillingAdmissionResult> {
    const billable = input.billable === true;

    return this.transitionExisting(input, (event, now, transaction, windowRef) => {
      if (event.state !== "reserved") {
        return event;
      }

      const usedAfter = billable ? event.usedAfter : Math.max(0, event.usedAfter - 1);
      if (!billable) {
        transaction.set(windowRef, { used: usedAfter, limit: event.limit, updatedAt: now }, { merge: true });
      }

      return {
        ...event,
        state: QUOTA_LEDGER_STATE_BY_OPERATION.release,
        status: billable ? "admitted" : "denied",
        billable,
        denyReason: billable ? null : "invalid_request",
        usedAfter,
        updatedAt: now,
        releasedAt: now,
      };
    });
  }

  async deny(input: BillingAdmissionDenyInput): Promise<BillingAdmissionResult> {
    const idempotencyKey = createAdmissionIdempotencyKey(input);
    const eventId = createAdmissionEventId(input);
    const nowDate = normalizeClock(input.now);
    const now = nowDate.toISOString();
    const window = getFixedUtcWeekQuotaWindow(nowDate);
    const quota = getQuotaLimitForTier(input.tier);
    const eventRef = this.firestore.doc(admissionUsageEventPath(input.accountId, eventId));
    const windowRef = this.firestore.doc(admissionQuotaWindowPath(input.accountId, window.id));

    return this.firestore.runTransaction(async (transaction) => {
      const existingEvent = eventFromSnapshot(await transaction.get(eventRef));
      if (existingEvent) {
        return resultFromEvent(existingEvent, true);
      }

      const windowSnapshot = await transaction.get(windowRef);
      const used = readUsed(windowSnapshot);
      const event: AdmissionLedgerEventDocument = {
        eventId,
        accountId: input.accountId,
        idempotencyKey,
        state: QUOTA_LEDGER_STATE_BY_OPERATION.deny,
        status: "denied",
        unit: QUOTA_UNIT_V1,
        window,
        tier: input.tier,
        limit: quota.limit,
        usedAfter: used,
        billable: false,
        denyReason: input.reason,
        createdAt: now,
        updatedAt: now,
        reservedAt: null,
        committedAt: null,
        releasedAt: null,
        deniedAt: now,
      };

      transaction.set(eventRef, event, { merge: false });
      return resultFromEvent(event, false);
    });
  }

  private async transitionExisting(
    input: BillingAdmissionTransitionInput,
    transition: (
      event: AdmissionLedgerEventDocument,
      now: string,
      transaction: Transaction,
      windowRef: DocumentReference,
    ) => AdmissionLedgerEventDocument,
  ) {
    const eventId = normalizeString(input.eventId)
      ?? createAdmissionEventId({ accountId: input.accountId, idempotencyKey: input.idempotencyKey });
    const now = normalizeClock(input.now).toISOString();
    const eventRef = this.firestore.doc(admissionUsageEventPath(input.accountId, eventId));

    return this.firestore.runTransaction(async (transaction) => {
      const event = eventFromSnapshot(await transaction.get(eventRef));
      if (!event) {
        throw new BillingAdmissionLedgerError(`Admission event not found: ${eventId}`);
      }

      const windowRef = this.firestore.doc(admissionQuotaWindowPath(input.accountId, event.window.id));
      const nextEvent = transition(event, now, transaction, windowRef);
      if (nextEvent !== event) {
        transaction.set(eventRef, nextEvent, { merge: true });
      }

      return resultFromEvent(nextEvent, nextEvent === event);
    });
  }
}
