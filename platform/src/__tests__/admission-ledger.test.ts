import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminFirestoreMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

import {
  admissionQuotaWindowPath,
  admissionUsageEventPath,
  BillingAdmissionService,
  createAdmissionEventId,
  type AdmissionLedgerEventDocument,
} from "@/lib/billing/admission-ledger";
import { getFixedUtcWeekQuotaWindow } from "@/lib/billing/contracts";

type StoredDoc = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createFirestoreMock() {
  const docs = new Map<string, StoredDoc>();
  const setCalls: string[] = [];
  const docCalls: string[] = [];
  let transactionQueue = Promise.resolve();

  const doc = vi.fn((path: string) => {
    docCalls.push(path);
    return { path };
  });

  const runTransaction = vi.fn(<T>(callback: (transaction: {
    get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => StoredDoc | undefined }>;
    set: (ref: { path: string }, data: StoredDoc, options?: { merge?: boolean }) => void;
  }) => Promise<T>) => {
    const run = async () => {
      const staged: Array<{ path: string; data: StoredDoc; merge?: boolean }> = [];
      const transaction = {
        get: vi.fn(async (ref: { path: string }) => ({
          exists: docs.has(ref.path),
          data: () => {
            const value = docs.get(ref.path);
            return value ? clone(value) : undefined;
          },
        })),
        set: vi.fn((ref: { path: string }, data: StoredDoc, options?: { merge?: boolean }) => {
          setCalls.push(ref.path);
          staged.push({ path: ref.path, data: clone(data), merge: options?.merge });
        }),
      };

      const result = await callback(transaction);
      for (const write of staged) {
        if (write.merge && docs.has(write.path)) {
          docs.set(write.path, { ...docs.get(write.path), ...write.data });
        } else {
          docs.set(write.path, write.data);
        }
      }

      return result;
    };

    const result = transactionQueue.then(run, run);
    transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  });

  return { firestore: { doc, runTransaction }, docs, setCalls, docCalls };
}

const ACCOUNT_ID = "acct_admission";
const NOW = "2026-06-25T12:00:00.000Z";

function windowPath() {
  return admissionQuotaWindowPath(ACCOUNT_ID, getFixedUtcWeekQuotaWindow(NOW).id);
}

function eventPathFor(idempotencyKey: string) {
  return admissionUsageEventPath(ACCOUNT_ID, createAdmissionEventId({ accountId: ACCOUNT_ID, idempotencyKey }));
}

function seedWindow(docs: Map<string, StoredDoc>, used: number, limit = 25) {
  const window = getFixedUtcWeekQuotaWindow(NOW);
  docs.set(windowPath(), {
    accountId: ACCOUNT_ID,
    windowId: window.id,
    kind: window.kind,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    unit: "managed_inbound_message",
    used,
    limit,
    updatedAt: NOW,
  });
}

describe("BillingAdmissionService", () => {
  let firestoreMock: ReturnType<typeof createFirestoreMock>;
  let service: BillingAdmissionService;

  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMock = createFirestoreMock();
    getAdminFirestoreMock.mockReturnValue(firestoreMock.firestore);
    service = new BillingAdmissionService(firestoreMock.firestore as never);
  });

  it("uses concrete valid Firestore document paths below the quota and usage namespaces", () => {
    const eventPath = admissionUsageEventPath(ACCOUNT_ID, "adm_test");
    const quotaPath = admissionQuotaWindowPath(ACCOUNT_ID, "2026-W26");

    expect(eventPath).toBe("accounts/acct_admission/usage/events/adm_test/current");
    expect(quotaPath).toBe("accounts/acct_admission/quota/windows/2026-W26/current");
    expect(eventPath.split("/")).toHaveLength(6);
    expect(quotaPath.split("/")).toHaveLength(6);
  });

  it("admits free tier below quota and writes one reserved usage event", async () => {
    const result = await service.reserve({
      accountId: ACCOUNT_ID,
      tier: "free",
      deploymentId: "deployment-1",
      channelMessageId: "telegram-message-1",
      now: NOW,
    });

    expect(result).toMatchObject({
      admitted: true,
      duplicate: false,
      state: "reserved",
      used: 1,
      limit: 25,
    });
    expect(firestoreMock.docs.get(windowPath())).toMatchObject({ used: 1, limit: 25 });
    expect(firestoreMock.docs.get(eventPathFor(`${ACCOUNT_ID}:deployment:deployment-1:channel-message:telegram-message-1`))).toMatchObject({
      state: "reserved",
      status: "admitted",
      billable: true,
    });
  });

  it("denies free tier at quota before forwarding and does not increment usage", async () => {
    seedWindow(firestoreMock.docs, 25);

    const result = await service.reserve({
      accountId: ACCOUNT_ID,
      tier: "free",
      idempotencyKey: "message-at-free-limit",
      now: NOW,
    });

    expect(result).toMatchObject({
      admitted: false,
      state: "denied",
      denyReason: "quota_exhausted",
      used: 25,
      limit: 25,
    });
    expect(firestoreMock.docs.get(windowPath())).toMatchObject({ used: 25, limit: 25 });
    expect(firestoreMock.docs.get(eventPathFor("message-at-free-limit"))).toMatchObject({
      state: "denied",
      status: "denied",
      billable: false,
    });
  });

  it("admits growth tier above the free quota boundary", async () => {
    seedWindow(firestoreMock.docs, 25, 25);

    const result = await service.reserve({
      accountId: ACCOUNT_ID,
      tier: "growth",
      idempotencyKey: "growth-message-above-free-limit",
      now: NOW,
    });

    expect(result).toMatchObject({
      admitted: true,
      state: "reserved",
      used: 26,
      limit: 100,
    });
    expect(firestoreMock.docs.get(windowPath())).toMatchObject({ used: 26, limit: 100 });
  });

  it("denies further free admissions after mid-window demotion when usage exceeds the free limit", async () => {
    seedWindow(firestoreMock.docs, 26, 100);

    const result = await service.reserve({
      accountId: ACCOUNT_ID,
      tier: "free",
      idempotencyKey: "demoted-free-message",
      now: NOW,
    });

    expect(result).toMatchObject({
      admitted: false,
      denyReason: "quota_exhausted",
      used: 26,
      limit: 25,
    });
    expect(firestoreMock.docs.get(windowPath())).toMatchObject({ used: 26, limit: 25 });
  });

  it("returns the same event for duplicate inbound IDs without double-counting", async () => {
    const input = {
      accountId: ACCOUNT_ID,
      tier: "free" as const,
      deploymentId: "deployment-duplicate",
      channelMessageId: "telegram-message-duplicate",
      now: NOW,
    };

    const first = await service.reserve(input);
    const second = await service.reserve(input);

    expect(second).toMatchObject({
      eventId: first.eventId,
      duplicate: true,
      admitted: true,
      used: 1,
    });
    expect(firestoreMock.docs.get(windowPath())).toMatchObject({ used: 1 });
  });

  it("commits admitted failures once and only releases quota when explicitly non-billable before commit", async () => {
    const committed = await service.reserve({
      accountId: ACCOUNT_ID,
      tier: "free",
      idempotencyKey: "provider-failure-counts-once",
      now: NOW,
    });
    await service.commit({ accountId: ACCOUNT_ID, eventId: committed.eventId, now: NOW });

    const attemptedLateRelease = await service.release({
      accountId: ACCOUNT_ID,
      eventId: committed.eventId,
      billable: false,
      now: NOW,
    });

    expect(attemptedLateRelease).toMatchObject({
      state: "committed",
      admitted: true,
      used: 1,
    });
    expect(firestoreMock.docs.get(windowPath())).toMatchObject({ used: 1 });

    const released = await service.reserve({
      accountId: ACCOUNT_ID,
      tier: "free",
      idempotencyKey: "not-forwarded-released-before-commit",
      now: NOW,
    });
    const releaseResult = await service.release({
      accountId: ACCOUNT_ID,
      eventId: released.eventId,
      billable: false,
      now: NOW,
    });

    expect(releaseResult).toMatchObject({
      state: "released",
      admitted: false,
      used: 1,
    });
    expect(releaseResult.event).toMatchObject({ billable: false });
    expect(firestoreMock.docs.get(windowPath())).toMatchObject({ used: 1 });
  });

  it("writes deterministic denied events without consuming quota", async () => {
    const result = await service.deny({
      accountId: ACCOUNT_ID,
      tier: "free",
      idempotencyKey: "manual-block-before-forwarding",
      reason: "manual_block",
      now: NOW,
    });

    expect(result).toMatchObject({
      admitted: false,
      state: "denied",
      denyReason: "manual_block",
      used: 0,
    });
    expect(firestoreMock.docs.get(eventPathFor("manual-block-before-forwarding"))).toMatchObject({
      state: "denied",
      denyReason: "manual_block",
      billable: false,
    } satisfies Partial<AdmissionLedgerEventDocument>);
    expect(firestoreMock.docs.get(windowPath())).toBeUndefined();
  });
});
