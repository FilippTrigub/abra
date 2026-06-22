import { requireAuth } from "@/lib/auth";
import { NavItem, Badge } from "@/components/ui";
import {
  ensurePlatformAccount,
  getUserDisplayName,
  getSubscriptionInfo,
} from "@/lib/platform-account";
import { AccountMenu } from "./account-menu";

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
  const navItemClassName =
    "min-h-10 rounded-xl px-4 py-2 text-[11px] sm:text-[12px]";

  return (
    <div className="min-h-screen bg-[var(--color-shell-canvas)] text-[var(--color-shell-text-strong)]">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--color-shell-border-strong)] bg-[var(--color-shell-canvas)]">
        <div className="mx-auto flex min-h-[4.5rem] max-w-screen-xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 text-[var(--color-shell-text-strong)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] text-[var(--color-shell-signal)] shadow-[0_16px_40px_-32px_var(--color-shell-signal)]">
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
              <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-white sm:text-[13px]">
                ABRA
              </span>
            </div>
            <nav className="hidden items-center gap-1 rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--color-shell-panel)_86%,black)] p-1 sm:flex">
              {DASHBOARD_NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  className={navItemClassName}
                >
                  {item.label}
                </NavItem>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isNew && (
              <Badge
                variant="brand"
                className="border-white/12 bg-white/[0.035] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.13em] text-[var(--color-shell-signal)]"
              >
                Welcome aboard!
              </Badge>
            )}
            <AccountMenu displayName={displayName} />
          </div>
        </div>
      </header>

      <nav className="border-b border-[var(--color-shell-border-strong)] bg-[var(--color-shell-canvas)] px-4 py-3 sm:hidden">
        <div className="mx-auto flex max-w-screen-xl items-center gap-1 rounded-2xl border border-white/10 bg-[color-mix(in_srgb,var(--color-shell-panel)_86%,black)] p-1">
          {DASHBOARD_NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              className={`${navItemClassName} flex-1 text-center`}
              style={{ paddingLeft: "var(--s-2)", paddingRight: "var(--s-2)" }}
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
      <main className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </main>
    </div>
  );
}
