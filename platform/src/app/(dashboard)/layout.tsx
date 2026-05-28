import { requireAuth } from "@/lib/auth";
import { NavItem, Badge } from "@/components/ui";
import {
  ensurePlatformAccount,
  getUserDisplayName,
  getSubscriptionInfo,
} from "@/lib/platform-account";

const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

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
  const shellBadgeClassName =
    "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)]";

  return (
    <div className="min-h-full bg-[var(--color-shell-canvas)]">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-sticky border-b border-[var(--color-shell-border-strong)] bg-[color-mix(in_srgb,var(--color-shell-canvas)_92%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 text-[var(--color-shell-text-strong)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-signal)]">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M3 4.5H9.5L13 8L9.5 11.5H3V4.5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5.5 8H10.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="text-h6 font-semibold tracking-[0.12em]">
                Abra
              </span>
            </div>
            <nav className="hidden items-center gap-2 rounded-full border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] p-1 sm:flex">
              {DASHBOARD_NAV_ITEMS.map((item) => (
                <NavItem key={item.href} href={item.href}>
                  {item.label}
                </NavItem>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isNew && (
              <Badge
                variant="brand"
                className="border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-signal)]"
              >
                Welcome aboard!
              </Badge>
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
                className={shellBadgeClassName}
              >
                {subInfo.status === "inactive"
                  ? `⚠ ${subInfo.plan}`
                  : subInfo.status === "missing"
                    ? "No account"
                    : subInfo.plan}
              </Badge>
            )}
            {!hasAccount && (
              <Badge variant="default" className={shellBadgeClassName}>
                Initializing…
              </Badge>
            )}
            <span className="hidden text-caption font-medium text-white/72 md:inline">
              {displayName}
            </span>
          </div>
        </div>
      </header>

      <nav className="border-b border-[var(--color-shell-border-strong)] bg-[color-mix(in_srgb,var(--color-shell-canvas)_94%,transparent)] px-4 py-3 sm:hidden">
        <div className="mx-auto flex max-w-screen-xl items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] p-1">
          {DASHBOARD_NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              className="flex-1 text-center"
            >
              {item.label}
            </NavItem>
          ))}
        </div>
      </nav>

      {/* ── Subscription gate (inactive) ────────────────── */}
      {hasAccount && subInfo.status === "inactive" && subInfo.cancellationReason && (
        <div className="border-b border-[color-mix(in_srgb,var(--color-warning-400)_45%,var(--color-shell-border-strong))] bg-[color-mix(in_srgb,var(--color-warning-900)_28%,var(--color-shell-canvas))]">
          <div className="mx-auto max-w-screen-xl px-6 py-3">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">🔒</span>
              <div>
                <p className="text-caption font-semibold text-warning-200">
                  Subscription paused
                </p>
                <p className="mt-0.5 text-caption text-warning-100/80">
                  {subInfo.cancellationReason}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────── */}
      <div className="relative border-t border-white/5">
        <div className="mx-auto max-w-screen-xl px-6 py-8">
          <div className="rounded-[1.75rem] border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] p-4 shadow-[0_24px_48px_rgba(0,0,0,0.28)] sm:p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
