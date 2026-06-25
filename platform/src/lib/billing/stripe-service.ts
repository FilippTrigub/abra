import "server-only";

import type Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";

import { getAdminFirestore } from "@/lib/firebase/admin";

import {
  getQuotaLimitForTier,
  projectStripeEntitlement,
  QUOTA_UNIT_V1,
  type ManagedBillingTier,
} from "./contracts";
import {
  getStripeBillingConfig,
  managedTierForStripePrice,
  parseStripeCheckoutPlanKey,
  STRIPE_GROWTH_PLAN_KEY,
  type StripeCheckoutPlanKey,
} from "./config";
import { getStripeClient } from "./stripe";

interface AccountBillingProfile {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface StripeWebhookResult {
  eventId: string;
  duplicate: boolean;
  projectedTier: ManagedBillingTier | null;
}

export class StripeWebhookProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookProcessingError";
  }
}

function internalBillingPath(authUserId: string) {
  return `accounts/${authUserId}/billing/internal`;
}

function billingSummaryPath(authUserId: string) {
  return `accounts/${authUserId}/summaries/billing`;
}

function webhookEventPath(eventId: string) {
  return `stripeWebhookEvents/${eventId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export async function getAccountBillingProfile(authUserId: string): Promise<AccountBillingProfile> {
  const snapshot = await getAdminFirestore().doc(internalBillingPath(authUserId)).get();
  const data = snapshot.data();

  return {
    stripeCustomerId: stringOrNull(data?.stripeCustomerId),
    stripeSubscriptionId: stringOrNull(data?.stripeSubscriptionId),
  };
}

export async function createGrowthCheckoutSession(input: {
  authUserId: string;
  email?: string | null;
  planKey: unknown;
  origin: string;
}, stripe = getStripeClient()) {
  const planKey = parseStripeCheckoutPlanKey(input.planKey);
  if (planKey !== STRIPE_GROWTH_PLAN_KEY) {
    throw new StripeWebhookProcessingError("Unsupported billing plan key.");
  }

  const config = getStripeBillingConfig();
  const profile = await getAccountBillingProfile(input.authUserId);
  const successUrl = new URL("/dashboard/settings", input.origin);
  successUrl.searchParams.set("billing", "success");
  successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  const cancelUrl = new URL("/dashboard/settings", input.origin);
  cancelUrl.searchParams.set("billing", "cancelled");

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: profile.stripeCustomerId ?? undefined,
    customer_email: profile.stripeCustomerId ? undefined : input.email ?? undefined,
    client_reference_id: input.authUserId,
    line_items: [
      {
        price: config.growthPriceId,
        quantity: 1,
      },
    ],
    metadata: {
      authUserId: input.authUserId,
      planKey,
      managedTier: "growth",
    },
    subscription_data: {
      metadata: {
        authUserId: input.authUserId,
        planKey,
        managedTier: "growth",
      },
    },
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
  });
}

export async function createBillingPortalSession(
  input: { authUserId: string; origin: string },
  stripe = getStripeClient(),
) {
  const profile = await getAccountBillingProfile(input.authUserId);

  if (!profile.stripeCustomerId) {
    throw new StripeWebhookProcessingError("No Stripe customer is linked to this account.");
  }

  return stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: new URL("/dashboard/settings", input.origin).toString(),
  });
}

function getEventAccountId(event: Stripe.Event, stripeObject: Stripe.Event.Data.Object) {
  if (isRecord(stripeObject) && isRecord(stripeObject.metadata)) {
    const metadataUserId = stringOrNull(stripeObject.metadata.authUserId);
    if (metadataUserId) {
      return metadataUserId;
    }
  }

  if (isRecord(stripeObject) && stringOrNull(stripeObject.client_reference_id)) {
    return stringOrNull(stripeObject.client_reference_id);
  }

  if (isRecord(event.request) && stringOrNull(event.request.idempotency_key)) {
    return null;
  }

  return null;
}

function subscriptionIdFromSession(session: Stripe.Checkout.Session) {
  if (typeof session.subscription === "string") {
    return session.subscription;
  }

  return session.subscription?.id ?? null;
}

function customerIdFromStripeObject(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (isRecord(value)) {
    return stringOrNull(value.id);
  }

  return null;
}

function mappedTierForSubscription(subscription: Stripe.Subscription) {
  for (const item of subscription.items.data) {
    const tier = managedTierForStripePrice(item.price.id);
    if (tier) {
      return tier;
    }
  }

  return null;
}

function projectionForSubscription(subscription: Stripe.Subscription | null) {
  if (!subscription) {
    return projectStripeEntitlement({ status: null, mappedTier: null });
  }

  return projectStripeEntitlement({
    status: subscription.status,
    mappedTier: mappedTierForSubscription(subscription),
    subscriptionPaused: subscription.pause_collection !== null,
  });
}

function createProjectionWrites(input: {
  authUserId: string;
  event: Stripe.Event;
  subscription: Stripe.Subscription | null;
  customerId: string | null;
  subscriptionId: string | null;
}) {
  const projection = projectionForSubscription(input.subscription);
  const quota = getQuotaLimitForTier(projection.tier);

  return {
    projection,
    internal: {
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: input.subscription?.id ?? input.subscriptionId,
      stripeSubscriptionStatus: projection.status,
      stripeLastEventId: input.event.id,
      stripeLastEventType: input.event.type,
      tier: projection.tier,
      statusReason: projection.reason,
      hardBlocked: projection.hardBlocked,
      updatedAt: FieldValue.serverTimestamp(),
    },
    summary: {
      tier: projection.tier,
      status: projection.status ?? "missing",
      statusReason: projection.reason,
      hardBlocked: projection.hardBlocked,
      blockReason: null,
      quota: {
        unit: QUOTA_UNIT_V1,
        limit: quota.limit,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
}

function createCheckoutLinkageWrites(input: {
  event: Stripe.Event;
  customerId: string | null;
  subscriptionId: string | null;
}) {
  return {
    ...(input.customerId ? { stripeCustomerId: input.customerId } : {}),
    ...(input.subscriptionId ? { stripeSubscriptionId: input.subscriptionId } : {}),
    stripeLastEventId: input.event.id,
    stripeLastEventType: input.event.type,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function projectablePayloadFromEvent(event: Stripe.Event) {
  const stripeObject = event.data.object;
  const authUserId = getEventAccountId(event, stripeObject);

  if (event.type === "checkout.session.completed") {
    const session = stripeObject as Stripe.Checkout.Session;
    return {
      type: "checkout" as const,
      authUserId,
      customerId: customerIdFromStripeObject(session.customer),
      subscriptionId: subscriptionIdFromSession(session),
    };
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = stripeObject as Stripe.Subscription;
    return {
      type: "subscription" as const,
      authUserId,
      customerId: customerIdFromStripeObject(subscription.customer),
      subscriptionId: subscription.id,
      subscription,
    };
  }

  return null;
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<StripeWebhookResult> {
  const firestore = getAdminFirestore();
  const eventRef = firestore.doc(webhookEventPath(event.id));
  const payload = projectablePayloadFromEvent(event);

  return firestore.runTransaction(async (transaction) => {
    const existingEvent = await transaction.get(eventRef);
    if (existingEvent.exists) {
      const data = existingEvent.data();
      return {
        eventId: event.id,
        duplicate: true,
        projectedTier: (data?.projectedTier as ManagedBillingTier | undefined) ?? null,
      };
    }

    if (!payload || !payload.authUserId) {
      transaction.set(eventRef, {
        eventId: event.id,
        type: event.type,
        processed: true,
        ignored: true,
        reason: payload ? "missing-auth-user-id" : "unsupported-event-type",
        projectedTier: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        eventId: event.id,
        duplicate: false,
        projectedTier: null,
      };
    }

    if (payload.type === "checkout") {
      const internal = createCheckoutLinkageWrites({
        event,
        customerId: payload.customerId,
        subscriptionId: payload.subscriptionId,
      });

      transaction.set(eventRef, {
        eventId: event.id,
        type: event.type,
        processed: true,
        ignored: false,
        accountId: payload.authUserId,
        projectedTier: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(firestore.doc(internalBillingPath(payload.authUserId)), internal, { merge: true });

      return {
        eventId: event.id,
        duplicate: false,
        projectedTier: null,
      };
    }

    const writes = createProjectionWrites({
      authUserId: payload.authUserId,
      event,
      subscription: payload.subscription,
      customerId: payload.customerId,
      subscriptionId: payload.subscriptionId,
    });

    transaction.set(eventRef, {
      eventId: event.id,
      type: event.type,
      processed: true,
      ignored: false,
      accountId: payload.authUserId,
      projectedTier: writes.projection.tier,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(firestore.doc(internalBillingPath(payload.authUserId)), writes.internal, { merge: true });
    transaction.set(firestore.doc(billingSummaryPath(payload.authUserId)), writes.summary, { merge: true });

    return {
      eventId: event.id,
      duplicate: false,
      projectedTier: writes.projection.tier,
    };
  });
}

export function assertGrowthPlanKey(planKey: unknown): asserts planKey is StripeCheckoutPlanKey {
  if (parseStripeCheckoutPlanKey(planKey) !== STRIPE_GROWTH_PLAN_KEY) {
    throw new StripeWebhookProcessingError("Unsupported billing plan key.");
  }
}
