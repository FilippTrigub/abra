import { NextResponse } from "next/server";
import { getPlatformAccount, getSubscriptionInfo } from "@/lib/platform-account";
import { getAdminAuth } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const { cookies } = await import("next/headers");

    // Get user via Firebase Admin SDK (consistent with getUser pattern)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({
        account: null,
        subscription: getSubscriptionInfo(null),
      });
    }

    const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const authUserId = decodedToken.uid;

    // Read account from Firestore via helper
    const account = await getPlatformAccount(authUserId);

    // Map FirestoreAccount to legacy format expected by getSubscriptionInfo
    const legacyAccount = account
      ? {
          subscription_plan: account.subscriptionPlan,
          subscription_status: account.subscriptionStatus,
          subscription_cancellation_reason: account.subscriptionCancellationReason,
        }
      : null;

    const subInfo = getSubscriptionInfo(legacyAccount);

    return NextResponse.json({
      account: account
        ? {
            id: account.id,
            subscription_plan: account.subscriptionPlan,
            subscription_status: account.subscriptionStatus,
            subscription_cancellation_reason: account.subscriptionCancellationReason,
          }
        : null,
      subscription: subInfo,
    });
  } catch {
    return NextResponse.json({
      account: null,
      subscription: getSubscriptionInfo(null),
    });
  }
}
