import { NextResponse } from "next/server";
import { getSubscriptionInfo } from "@/lib/platform-account";

export async function GET() {
  try {
    const { createSupabaseServerClient } = await import("@/lib/auth/supabase-client");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({
        account: null,
        subscription: getSubscriptionInfo(null),
      });
    }

    const { data: account } = await supabase
      .schema("platform")
      .from("platform_account")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const subInfo = getSubscriptionInfo(account);

    return NextResponse.json({
      account: account
        ? {
            id: account.id,
            subscription_plan: account.subscription_plan,
            subscription_status: account.subscription_status,
            subscription_cancellation_reason: account.subscription_cancellation_reason,
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
