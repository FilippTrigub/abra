import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const getAdminAuthMock = vi.hoisted(() => vi.fn());
const getAdminFirestoreMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminAuth: getAdminAuthMock,
  getAdminFirestore: getAdminFirestoreMock,
}));

describe("dashboard account-info API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue({ get: () => ({ value: "session-cookie" }) });
    getAdminAuthMock.mockReturnValue({
      verifySessionCookie: vi.fn().mockResolvedValue({ uid: "acct_legacy" }),
    });
  });

  it("sanitizes legacy paid plans before returning account or subscription data", async () => {
    getAdminFirestoreMock.mockReturnValue({
      doc: vi.fn((path: string) => ({
        path,
        get: vi.fn().mockResolvedValue({
          exists: true,
          id: "acct_legacy",
          data: () => ({
            authUserId: "acct_legacy",
            subscriptionPlan: "enterprise",
            subscriptionStatus: "active",
            subscriptionCancellationReason: null,
            createdAt: "created",
            updatedAt: "updated",
          }),
        }),
      })),
    });

    const { GET } = await import("@/app/api/dashboard/account-info/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      account: {
        id: "acct_legacy",
        subscription_plan: "unknown",
        subscription_status: "active",
      },
      subscription: {
        status: "active",
        plan: "unknown",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("enterprise");
    expect(JSON.stringify(payload)).not.toContain("pro");
  });
});
