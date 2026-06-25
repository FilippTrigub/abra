import { NextResponse } from "next/server";

import { requireApiAuth, unauthenticatedResponse } from "@/lib/auth";
import { getBrowserSafeBillingSummary } from "@/lib/billing/billing-summary";

export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireApiAuth();
  if ("error" in authResult) {
    return unauthenticatedResponse();
  }

  try {
    const summary = await getBrowserSafeBillingSummary({
      accountId: authResult.user.id,
    });

    return NextResponse.json({ summary }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load billing summary.";
    return NextResponse.json(
      { error: { code: "BILLING_SUMMARY_UNAVAILABLE", message } },
      { status: 503 },
    );
  }
}
