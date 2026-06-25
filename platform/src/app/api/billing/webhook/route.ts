import { NextResponse } from "next/server";

import { getStripeBillingConfig, StripeBillingConfigError } from "@/lib/billing/config";
import { processStripeWebhookEvent } from "@/lib/billing/stripe-service";
import { getStripeClient } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: { code: "MISSING_STRIPE_SIGNATURE", message: "Missing Stripe signature header." } },
      { status: 400 },
    );
  }

  try {
    const rawBody = await request.text();
    const event = getStripeClient().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeBillingConfig().webhookSecret,
    );
    const result = await processStripeWebhookEvent(event);

    return NextResponse.json({ received: true, ...result }, { status: 200 });
  } catch (error) {
    if (error instanceof StripeBillingConfigError) {
      return NextResponse.json(
        { error: { code: "BILLING_NOT_CONFIGURED", message: error.message } },
        { status: 500 },
      );
    }

    const message = error instanceof Error ? error.message : "Invalid Stripe webhook payload.";
    return NextResponse.json(
      { error: { code: "STRIPE_WEBHOOK_VERIFICATION_FAILED", message } },
      { status: 400 },
    );
  }
}
