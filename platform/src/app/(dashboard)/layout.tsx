import { requireAuth } from "@/lib/auth";
import { NavItem, Badge } from "@/components/ui";
import {
  ensurePlatformAccount,
  getUserDisplayName,
  getSubscriptionInfo,
} from "@/lib/platform-account";

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
    <div className="min-h-full bg-surface-default">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-sticky bg-surface-default/90 backdrop-blur border-b border-border-subtle">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-h5 font-display font-bold text-brand-500">
              Abra
            </span>
            <nav className="hidden sm:flex items-center gap-1">
              <NavItem href="/dashboard" active>
                Dashboard
              </NavItem>
              <NavItem href="/dashboard/settings">
                Settings
              </NavItem>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isNew && (
              <Badge variant="brand">Welcome aboard!</Badge>
            )}
            {hasAccount && (
              <Badge
                variant={
                  subInfo.status === "inactive"
                    ? "warning"
                    : subInfo.status === "missing"
                      ? "danger"
                      : "success"
                }
              >
                {subInfo.status === "inactive"
                  ? `⚠ ${subInfo.plan}`
                  : subInfo.status === "missing"
                    ? "No account"
                    : subInfo.plan}
              </Badge>
            )}
            {!hasAccount && (
              <Badge variant="default">Initializing…</Badge>
            )}
            <span className="text-body text-content-500 hidden md:inline">
              {displayName}
            </span>
          </div>
        </div>
      </header>

      <nav className="border-b border-border-subtle bg-surface-default/95 px-4 py-2 sm:hidden">
        <div className="mx-auto flex max-w-screen-xl items-center gap-2">
          <NavItem href="/dashboard" active className="flex-1 justify-center text-center">
            Dashboard
          </NavItem>
          <NavItem href="/dashboard/settings" className="flex-1 justify-center text-center">
            Settings
          </NavItem>
        </div>
      </nav>

      {/* ── Subscription gate (inactive) ────────────────── */}
      {hasAccount && subInfo.status === "inactive" && subInfo.cancellationReason && (
        <div className="border-b border-warning-200 bg-warning-50/70">
          <div className="max-w-screen-xl mx-auto px-6 py-3">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">🔒</span>
              <div>
                <p className="text-caption font-semibold text-warning-800">
                  Subscription paused
                </p>
                <p className="mt-0.5 text-caption text-warning-700">
                  {subInfo.cancellationReason}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────── */}
      <div className="relative">
        <div aria-hidden className="absolute inset-0 depth-layer-mesh" />
        <div className="relative max-w-screen-xl mx-auto px-6 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
