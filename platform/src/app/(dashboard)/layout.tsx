import { requireAuth } from "@/lib/auth";
import {
  ensurePlatformAccount,
  getUserDisplayName,
  getSubscriptionInfo,
} from "@/lib/platform-account";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  // Bootstrap: ensure platform_account row exists.
  // Non-blocking — the dashboard renders regardless.
  let account = null;
  let isNew = false;

  try {
    const { account: fetched, booted } = await ensurePlatformAccount(
      user.id
    );
    account = fetched;
    isNew = booted;
  } catch {
    // Degrade: user sees dashboard without account data.
  }

  const displayName = getUserDisplayName(user);
  const hasAccount = !!account;
  const subInfo = getSubscriptionInfo(account);

  return (
    <DashboardShell
      displayName={displayName}
      isNew={isNew}
      hasAccount={hasAccount}
      subInfo={subInfo}
    >
      {children}
    </DashboardShell>
  );
}
