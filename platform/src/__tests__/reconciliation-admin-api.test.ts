import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAdminFirestoreMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

const NOW = "2026-06-25T12:00:00.000Z";

type StoredDoc = Record<string, unknown>;

function snapshot(path: string, data: StoredDoc) {
  return {
    ref: { path },
    data: () => data,
  };
}

function createFirestoreMock() {
  const groups: Record<string, Array<ReturnType<typeof snapshot>>> = {
    current: [
      snapshot("accounts/acct_reconcile/usage/events/adm_missing/current", {
        eventId: "adm_missing",
        accountId: "acct_reconcile",
        idempotencyKey: "adm_missing",
        state: "reserved",
        status: "admitted",
        unit: "managed_inbound_message",
        window: {
          kind: "fixed_utc_week",
          id: "2026-W26",
          startsAt: "2026-06-22T00:00:00.000Z",
          endsAt: "2026-06-29T00:00:00.000Z",
        },
        tier: "free",
        limit: 25,
        usedAfter: 1,
        billable: true,
        denyReason: null,
        createdAt: NOW,
        updatedAt: NOW,
        reservedAt: NOW,
        committedAt: null,
        releasedAt: null,
        deniedAt: null,
        providerUsageEnvelopes: [],
        providerUsageUpdatedAt: null,
      }),
      snapshot("accounts/acct_reconcile/settings/current", { ignored: true }),
    ],
    summaries: [
      snapshot("accounts/acct_reconcile/summaries/billing", { tier: "free", status: "active" }),
    ],
    moderation: [
      snapshot("accounts/acct_reconcile/moderation/current", { blocked: false, reason: null }),
    ],
  };

  return {
    collectionGroup: vi.fn((group: string) => ({
      get: vi.fn(async () => ({ docs: groups[group] ?? [] })),
    })),
  };
}

describe("internal billing reconciliation admin API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects browser/user calls without the internal bearer secret", async () => {
    vi.stubEnv("ABRA_BILLING_RECONCILIATION_SECRET", "reconcile-secret");
    getAdminFirestoreMock.mockReturnValue(createFirestoreMock());

    const { GET } = await import("@/app/api/internal/billing/reconciliation/route");
    const response = await GET(new Request("http://localhost:3000/api/internal/billing/reconciliation"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Billing reconciliation admin credential is required.",
      },
    });
    expect(getAdminFirestoreMock).not.toHaveBeenCalled();
  });

  it("returns unavailable when no internal reconciliation secret is configured", async () => {
    const { GET } = await import("@/app/api/internal/billing/reconciliation/route");
    const response = await GET(new Request("http://localhost:3000/api/internal/billing/reconciliation", {
      headers: { authorization: "Bearer anything" },
    }));

    expect(response.status).toBe(503);
    expect(getAdminFirestoreMock).not.toHaveBeenCalled();
  });

  it("allows authorized internal callers to execute and receive the report", async () => {
    vi.stubEnv("ABRA_BILLING_RECONCILIATION_SECRET", "reconcile-secret");
    const firestore = createFirestoreMock();
    getAdminFirestoreMock.mockReturnValue(firestore);

    const { GET } = await import("@/app/api/internal/billing/reconciliation/route");
    const response = await GET(new Request("http://localhost:3000/api/internal/billing/reconciliation", {
      headers: { authorization: "Bearer reconcile-secret" },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(firestore.collectionGroup).toHaveBeenCalledWith("current");
    expect(firestore.collectionGroup).toHaveBeenCalledWith("summaries");
    expect(firestore.collectionGroup).toHaveBeenCalledWith("moderation");
    expect(payload.report).toMatchObject({
      visibility: "internal_admin_only",
      readonly: true,
      findings: expect.arrayContaining([
        expect.objectContaining({ reason: "missing_completion", usageEventId: "adm_missing" }),
        expect.objectContaining({ reason: "missing_usage", usageEventId: "adm_missing" }),
      ]),
      summary: {
        ledgerEvents: 1,
        providerUsage: 0,
        langfuseObservations: 0,
        issues: 2,
        findings: 2,
        criticalFindings: 0,
        warningFindings: 2,
        duplicateSettlementGroups: 0,
        usageDriftFindings: 0,
      },
    });
  });
});
