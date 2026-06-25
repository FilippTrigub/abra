import { NextResponse } from "next/server";

import { requireApiAuth, unauthenticatedResponse } from "@/lib/auth";
import { StripeBillingConfigError } from "@/lib/billing/config";
import { createGrowthCheckoutSession, StripeWebhookProcessingError } from "@/lib/billing/stripe-service";

export const runtime = "nodejs";

interface CheckoutRequestBody {
  planKey?: unknown;
}

export async function POST(request: Request) {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const session = await createGrowthCheckoutSession({
      authUserId: authResult.user.id,
      email: authResult.user.email,
      planKey: body.planKey,
      origin: new URL(request.url).origin,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    if (error instanceof StripeWebhookProcessingError) {
      return NextResponse.json(
        { error: { code: "UNSUPPORTED_BILLING_PLAN", message: error.message } },
        { status: 400 },
      );
    }

    if (error instanceof StripeBillingConfigError) {
      return NextResponse.json(
        { error: { code: "BILLING_NOT_CONFIGURED", message: error.message } },
        { status: 500 },
      );
    }

    const message = error instanceof Error ? error.message : "Unable to create checkout session.";
    return NextResponse.json(
      { error: { code: "CHECKOUT_SESSION_FAILED", message } },
      { status: 500 },
    );
  }
}
