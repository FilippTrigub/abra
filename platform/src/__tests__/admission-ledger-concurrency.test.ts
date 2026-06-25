import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminFirestoreMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

import {
  admissionQuotaWindowPath,
  BillingAdmissionService,
} from "@/lib/billing/admission-ledger";
import { getFixedUtcWeekQuotaWindow } from "@/lib/billing/contracts";

type StoredDoc = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSerializedFirestoreMock() {
  const docs = new Map<string, StoredDoc>();
  let transactionQueue = Promise.resolve();
  let maxSimultaneousTransactions = 0;
  let activeTransactions = 0;

  const doc = vi.fn((path: string) => ({ path }));
  const runTransaction = vi.fn(<T>(callback: (transaction: {
    get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => StoredDoc | undefined }>;
    set: (ref: { path: string }, data: StoredDoc, options?: { merge?: boolean }) => void;
  }) => Promise<T>) => {
    const run = async () => {
      activeTransactions += 1;
      maxSimultaneousTransactions = Math.max(maxSimultaneousTransactions, activeTransactions);
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
          staged.push({ path: ref.path, data: clone(data), merge: options?.merge });
        }),
      };

      try {
        const result = await callback(transaction);
        for (const write of staged) {
          if (write.merge && docs.has(write.path)) {
            docs.set(write.path, { ...docs.get(write.path), ...write.data });
          } else {
            docs.set(write.path, write.data);
          }
        }
        return result;
      } finally {
        activeTransactions -= 1;
      }
    };

    const result = transactionQueue.then(run, run);
    transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  });

  return {
    firestore: { doc, runTransaction },
    docs,
    get maxSimultaneousTransactions() {
      return maxSimultaneousTransactions;
    },
  };
}

const ACCOUNT_ID = "acct_boundary";
const NOW = "2026-06-25T12:00:00.000Z";

function windowPath() {
  return admissionQuotaWindowPath(ACCOUNT_ID, getFixedUtcWeekQuotaWindow(NOW).id);
}

describe("BillingAdmissionService boundary concurrency", () => {
  let firestoreMock: ReturnType<typeof createSerializedFirestoreMock>;
  let service: BillingAdmissionService;

  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMock = createSerializedFirestoreMock();
    getAdminFirestoreMock.mockReturnValue(firestoreMock.firestore);
    service = new BillingAdmissionService(firestoreMock.firestore as never);
  });

  it("admits exactly the remaining free quota under concurrent reservation attempts", async () => {
    const window = getFixedUtcWeekQuotaWindow(NOW);
    firestoreMock.docs.set(windowPath(), {
      accountId: ACCOUNT_ID,
      windowId: window.id,
      kind: window.kind,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      unit: "managed_inbound_message",
      used: 23,
      limit: 25,
      updatedAt: NOW,
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) => service.reserve({
        accountId: ACCOUNT_ID,
        tier: "free",
        idempotencyKey: `boundary-message-${index}`,
        now: NOW,
      })),
    );

    const admitted = results.filter((result) => result.admitted);
    const denied = results.filter((result) => !result.admitted);

    expect(admitted).toHaveLength(2);
    expect(denied).toHaveLength(3);
    expect(denied.every((result) => result.denyReason === "quota_exhausted")).toBe(true);
    expect(firestoreMock.docs.get(windowPath())).toMatchObject({ used: 25, limit: 25 });
    expect(firestoreMock.maxSimultaneousTransactions).toBe(1);
  });
});
