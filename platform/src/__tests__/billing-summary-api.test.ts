import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminFirestoreMock = vi.hoisted(() => vi.fn());
const requireApiAuthMock = vi.hoisted(() => vi.fn());
const unauthenticatedResponseMock = vi.hoisted(() => vi.fn(() =>
  Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }),
));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

vi.mock("@/lib/auth", () => ({
  requireApiAuth: requireApiAuthMock,
  unauthenticatedResponse: unauthenticatedResponseMock,
}));

type StoredDoc = Record<string, unknown>;

function createFirestoreMock(docs: Map<string, StoredDoc>) {
  return {
    doc: vi.fn((path: string) => ({
      path,
      get: vi.fn(async () => ({
        data: () => docs.get(path),
      })),
    })),
  };
}

async function getSummaryResponse(docs: Map<string, StoredDoc>) {
  vi.resetModules();
  getAdminFirestoreMock.mockReturnValue(createFirestoreMock(docs));
  requireApiAuthMock.mockResolvedValue({ user: { id: "billing-user", email: "owner@example.com" } });

  const { GET } = await import("@/app/api/billing/summary/route");
  const response = await GET();

  expect(response.status).toBe(200);
  return response.json() as Promise<{ summary: unknown }>;
}

describe("browser-safe billing summary API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a free summary with remaining quota, reset date, and upgrade action", async () => {
    const payload = await getSummaryResponse(new Map([
      ["accounts/billing-user/summaries/billing", {
        tier: "free",
        status: "missing",
        stripeCustomerId: "cus_secret",
        stripeSubscriptionId: "sub_secret",
        webhookEventId: "evt_secret",
        runtimeCredential: "runtime_secret",
        rawProviderCost: 123.45,
      }],
      ["accounts/billing-user/quota/windows/2026-W26/current", { used: 7 }],
    ]));

    expect(payload.summary).toMatchObject({
      tier: "free",
      tierLabel: "Free",
      quota: {
        unit: "managed_inbound_message",
        limit: 25,
        used: 7,
        remaining: 18,
        resetAt: expect.any(String),
      },
      runtime: {
        state: "available",
        blockReasonCode: null,
        blockReason: null,
      },
      action: {
        kind: "upgrade",
        label: "Upgrade",
        endpoint: "/api/billing/checkout",
        planKey: "growth",
      },
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("stripeCustomerId");
    expect(serialized).not.toContain("stripeSubscriptionId");
    expect(serialized).not.toContain("webhookEventId");
    expect(serialized).not.toContain("runtimeCredential");
    expect(serialized).not.toContain("rawProviderCost");
  });

  it("returns a growth summary with the manage billing action", async () => {
    const payload = await getSummaryResponse(new Map([
      ["accounts/billing-user/summaries/billing", {
        tier: "growth",
        status: "active",
        stripeCustomerId: "cus_secret",
      }],
      ["accounts/billing-user/quota/windows/2026-W26/current", { used: 125 }],
    ]));

    expect(payload.summary).toMatchObject({
      tier: "growth",
      tierLabel: "Growth",
      status: "active",
      quota: {
        limit: 100,
        used: 125,
        remaining: 0,
      },
      runtime: {
        state: "quota_exhausted",
        blockReason: "You've reached your Growth message limit. I will reach out within 24 hours with an offer.",
      },
      action: {
        kind: "manage_billing",
        label: "Manage billing",
        endpoint: "/api/billing/portal",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("cus_secret");
  });

  it("returns an exhausted free summary with an upgrade invitation", async () => {
    const payload = await getSummaryResponse(new Map([
      ["accounts/billing-user/summaries/billing", { tier: "free", status: "active" }],
      ["accounts/billing-user/quota/windows/2026-W26/current", { used: 25 }],
    ]));

    expect(payload.summary).toMatchObject({
      tier: "free",
      quota: {
        limit: 25,
        used: 25,
        remaining: 0,
      },
      runtime: {
        state: "quota_exhausted",
        blockReason: "You've reached your Free message limit. Upgrade to Growth to keep processing managed messages.",
      },
      action: {
        kind: "upgrade",
        endpoint: "/api/billing/checkout",
        planKey: "growth",
      },
    });
  });

  it("returns only the sanitized public block reason for blocked users", async () => {
    const payload = await getSummaryResponse(new Map([
      ["accounts/billing-user/summaries/billing", { tier: "free", status: "active" }],
      ["accounts/billing-user/moderation/current", {
        blocked: true,
        reason: "operator_hold",
        publicReason: "  Public review only.\nNo internal detail.  ",
        operatorNote: "Do not show this operator note.",
        rawProviderCost: 99,
      }],
    ]));

    expect(payload.summary).toMatchObject({
      runtime: {
        state: "blocked",
        blockReasonCode: "operator_hold",
        blockReason: "Public review only. No internal detail.",
      },
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("operatorNote");
    expect(serialized).not.toContain("Do not show this operator note");
    expect(serialized).not.toContain("rawProviderCost");
  });

  it("does not expose the sensitive field names in API source or payload", async () => {
    const payload = await getSummaryResponse(new Map([
      ["accounts/billing-user/summaries/billing", {
        tier: "free",
        status: "active",
        stripeCustomerId: "cus_secret",
        stripeSubscriptionId: "sub_secret",
        webhookEventId: "evt_secret",
        operatorNote: "internal note",
        runtimeCredential: "runtime_secret",
        rawProviderCost: 42,
      }],
    ]));

    const serialized = JSON.stringify(payload);
    for (const field of [
      "stripeCustomerId",
      "stripeSubscriptionId",
      "webhookEventId",
      "operatorNote",
      "runtimeCredential",
      "rawProviderCost",
    ]) {
      expect(serialized).not.toContain(field);
    }
  });
});
