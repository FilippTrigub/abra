import { NextResponse } from "next/server";

import { requireApiAuth, unauthenticatedResponse } from "@/lib/auth";
import { StripeBillingConfigError } from "@/lib/billing/config";
import { createBillingPortalSession, StripeWebhookProcessingError } from "@/lib/billing/stripe-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  try {
    const session = await createBillingPortalSession({
      authUserId: authResult.user.id,
      origin: new URL(request.url).origin,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    if (error instanceof StripeWebhookProcessingError) {
      return NextResponse.json(
        { error: { code: "STRIPE_CUSTOMER_NOT_FOUND", message: error.message } },
        { status: 404 },
      );
    }

    if (error instanceof StripeBillingConfigError) {
      return NextResponse.json(
        { error: { code: "BILLING_NOT_CONFIGURED", message: error.message } },
        { status: 500 },
      );
    }

    const message = error instanceof Error ? error.message : "Unable to create billing portal session.";
    return NextResponse.json(
      { error: { code: "BILLING_PORTAL_SESSION_FAILED", message } },
      { status: 500 },
    );
  }
}
