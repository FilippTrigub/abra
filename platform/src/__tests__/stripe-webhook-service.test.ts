import { readFileSync } from "node:fs";
import { join } from "node:path";

import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAdminFirestoreMock = vi.hoisted(() => vi.fn());
const requireApiAuthMock = vi.hoisted(() => vi.fn());
const unauthenticatedResponseMock = vi.hoisted(() => vi.fn(() =>
  Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 }),
));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: getAdminFirestoreMock,
}));

vi.mock("@/lib/auth", () => ({
  requireApiAuth: requireApiAuthMock,
  unauthenticatedResponse: unauthenticatedResponseMock,
}));

vi.mock("server-only", () => ({}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "__server_timestamp__",
  },
}));

import {
  createBillingPortalSession,
  createGrowthCheckoutSession,
  processStripeWebhookEvent,
} from "@/lib/billing/stripe-service";

type StoredDoc = Record<string, unknown>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createFirestoreMock() {
  const docs = new Map<string, StoredDoc>();
  const setCalls: string[] = [];
  const doc = vi.fn((path: string) => ({ path }));
  doc.mockImplementation((path: string) => ({
    path,
    get: vi.fn().mockResolvedValue({
      get exists() {
        return docs.has(path);
      },
      data: () => {
        const value = docs.get(path);
        return value ? clone(value) : undefined;
      },
    }),
  }));
  const runTransaction = vi.fn(async <T>(callback: (transaction: {
    get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => StoredDoc | undefined }>;
    set: (ref: { path: string }, data: StoredDoc, options?: { merge?: boolean }) => void;
  }) => Promise<T>) => {
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
  });

  return { firestore: { doc, runTransaction }, docs, setCalls };
}

function subscriptionEvent(input: {
  id: string;
  status: Stripe.Subscription.Status;
  priceId?: string;
  pauseCollection?: Stripe.Subscription.PauseCollection | null;
}): Stripe.Event {
  const subscription = {
    id: `sub_${input.id}`,
    object: "subscription",
    customer: "cus_growth",
    status: input.status,
    metadata: {
      authUserId: "user_growth",
      planKey: "growth",
      managedTier: "growth",
    },
    items: {
      object: "list",
      data: [
        {
          id: `si_${input.id}`,
          object: "subscription_item",
          price: {
            id: input.priceId ?? "price_growth",
            object: "price",
          },
        },
      ],
    },
    pause_collection: input.pauseCollection ?? null,
    cancel_at_period_end: false,
  } as unknown as Stripe.Subscription;

  return {
    id: input.id,
    object: "event",
    type: "customer.subscription.updated",
    data: { object: subscription },
  } as Stripe.Event;
}

function signedWebhookRequest(payload: string, secret = "whsec_test") {
  const stripe = new Stripe("sk_test_unit");
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });

  return new Request("http://localhost:3000/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  });
}

describe("Stripe billing webhook service", () => {
  let firestoreMock: ReturnType<typeof createFirestoreMock>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_unit");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("STRIPE_GROWTH_PRICE_ID", "price_growth");
    firestoreMock = createFirestoreMock();
    getAdminFirestoreMock.mockReturnValue(firestoreMock.firestore);
    requireApiAuthMock.mockResolvedValue({ user: { id: "user_growth", email: "owner@example.com" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("projects active growth subscriptions and skips duplicate event IDs", async () => {
    const event = subscriptionEvent({ id: "evt_active_growth", status: "active" });

    await expect(processStripeWebhookEvent(event)).resolves.toEqual({
      eventId: "evt_active_growth",
      duplicate: false,
      projectedTier: "growth",
    });
    expect(firestoreMock.docs.get("accounts/user_growth/summaries/billing")).toMatchObject({
      tier: "growth",
      status: "active",
      hardBlocked: false,
      quota: {
        unit: "managed_inbound_message",
        limit: 500,
      },
    });
    expect(firestoreMock.docs.get("accounts/user_growth/billing/internal")).toMatchObject({
      stripeCustomerId: "cus_growth",
      stripeSubscriptionId: "sub_evt_active_growth",
      stripeSubscriptionStatus: "active",
      tier: "growth",
    });
    const writeCountAfterFirstDelivery = firestoreMock.setCalls.length;

    await expect(processStripeWebhookEvent(event)).resolves.toEqual({
      eventId: "evt_active_growth",
      duplicate: true,
      projectedTier: "growth",
    });
    expect(firestoreMock.setCalls).toHaveLength(writeCountAfterFirstDelivery);
  });

  it.each([
    "past_due",
    "unpaid",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "paused",
  ] as const)("demotes %s subscriptions to free without a hard block", async (status) => {
    const event = subscriptionEvent({ id: `evt_${status}`, status });

    await expect(processStripeWebhookEvent(event)).resolves.toMatchObject({
      duplicate: false,
      projectedTier: "free",
    });
    expect(firestoreMock.docs.get("accounts/user_growth/summaries/billing")).toMatchObject({
      tier: "free",
      status,
      hardBlocked: false,
      quota: {
        unit: "managed_inbound_message",
        limit: 25,
      },
    });
  });

  it("keeps active growth entitlement when checkout completion arrives after subscription events", async () => {
    await expect(processStripeWebhookEvent(subscriptionEvent({ id: "evt_active_before_checkout", status: "active" })))
      .resolves.toMatchObject({ projectedTier: "growth" });

    const checkoutWithSubscription = {
      id: "evt_checkout_with_subscription",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_with_subscription",
          object: "checkout.session",
          client_reference_id: "user_growth",
          customer: "cus_growth",
          subscription: "sub_evt_active_before_checkout",
          metadata: {
            authUserId: "user_growth",
            planKey: "growth",
          },
        },
      },
    } as unknown as Stripe.Event;

    await expect(processStripeWebhookEvent(checkoutWithSubscription)).resolves.toMatchObject({
      projectedTier: null,
    });

    const event = {
      id: "evt_checkout_no_subscription",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_missing_subscription",
          object: "checkout.session",
          client_reference_id: "user_growth",
          customer: "cus_growth",
          subscription: null,
          metadata: {
            authUserId: "user_growth",
            planKey: "growth",
          },
        },
      },
    } as unknown as Stripe.Event;

    await expect(processStripeWebhookEvent(event)).resolves.toMatchObject({
      projectedTier: null,
    });
    expect(firestoreMock.docs.get("accounts/user_growth/summaries/billing")).toMatchObject({
      tier: "growth",
      status: "active",
      hardBlocked: false,
    });
    expect(firestoreMock.docs.get("accounts/user_growth/billing/internal")).toMatchObject({
      stripeCustomerId: "cus_growth",
      stripeSubscriptionId: "sub_evt_active_before_checkout",
      stripeLastEventId: "evt_checkout_no_subscription",
      stripeLastEventType: "checkout.session.completed",
      tier: "growth",
    });
  });

  it("rejects unknown checkout plan keys before reading Stripe config or Firestore", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const response = await POST(new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ planKey: "enterprise" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNSUPPORTED_BILLING_PLAN",
        message: "Unsupported billing plan key.",
      },
    });
    expect(getAdminFirestoreMock).not.toHaveBeenCalled();
  });

  it("creates growth checkout sessions with only the server-configured Stripe price", async () => {
    firestoreMock.docs.set("accounts/user_growth/billing/internal", {
      stripeCustomerId: "cus_existing",
    });
    const createCheckoutSession = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    await expect(createGrowthCheckoutSession({
      authUserId: "user_growth",
      email: "owner@example.com",
      planKey: "growth",
      origin: "http://localhost:3000",
    }, {
      checkout: { sessions: { create: createCheckoutSession } },
    } as unknown as Stripe)).resolves.toEqual({ url: "https://checkout.stripe.com/session" });

    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      customer: "cus_existing",
      customer_email: undefined,
      line_items: [{ price: "price_growth", quantity: 1 }],
      metadata: expect.objectContaining({ authUserId: "user_growth", planKey: "growth" }),
      subscription_data: {
        metadata: expect.objectContaining({ authUserId: "user_growth", planKey: "growth" }),
      },
    }));
  });

  it("creates portal sessions only from server-stored Stripe customer IDs", async () => {
    firestoreMock.docs.set("accounts/user_growth/billing/internal", {
      stripeCustomerId: "cus_existing",
    });
    const createPortalSession = vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/session" });

    await expect(createBillingPortalSession({
      authUserId: "user_growth",
      origin: "http://localhost:3000",
    }, {
      billingPortal: { sessions: { create: createPortalSession } },
    } as unknown as Stripe)).resolves.toEqual({ url: "https://billing.stripe.com/session" });

    expect(createPortalSession).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "http://localhost:3000/dashboard/settings",
    });
  });

  it("verifies webhook signatures from the raw request body before processing", async () => {
    const payload = JSON.stringify(subscriptionEvent({ id: "evt_signed_active", status: "active" }));
    const { POST } = await import("@/app/api/billing/webhook/route");

    const response = await POST(signedWebhookRequest(payload));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      eventId: "evt_signed_active",
      duplicate: false,
      projectedTier: "growth",
    });

    const invalidResponse = await POST(new Request("http://localhost:3000/api/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=bad" },
      body: payload,
    }));
    expect(invalidResponse.status).toBe(400);
  });

  it("keeps Stripe secret names server-only and never exposes NEXT_PUBLIC Stripe config", () => {
    const files = [
      "src/lib/billing/config.ts",
      "src/lib/billing/stripe.ts",
      "src/lib/billing/stripe-service.ts",
      "src/app/api/billing/checkout/route.ts",
      "src/app/api/billing/portal/route.ts",
      "src/app/api/billing/webhook/route.ts",
    ];
    const source = files
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    expect(source).not.toContain("NEXT_PUBLIC_STRIPE");
    expect(source).toContain("import \"server-only\"");
    expect(source).toContain("STRIPE_SECRET_KEY");
    expect(source).toContain("STRIPE_WEBHOOK_SECRET");
  });
});
