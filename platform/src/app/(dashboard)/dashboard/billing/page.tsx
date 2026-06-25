import { Badge, Card, Panel } from "@/components/ui";
import { getUser } from "@/lib/auth/firebase-auth";
import { getBrowserSafeBillingSummary, type BillingRuntimeState } from "@/lib/billing/billing-summary";

import { BillingActionButton } from "./billing-action-button";

const shellCardClassName =
  "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none";

const shellLabelClassName =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500";

const runtimeBadge: Record<BillingRuntimeState, { label: string; variant: "success" | "warning" | "danger" }> = {
  available: { label: "Available", variant: "success" },
  blocked: { label: "Blocked", variant: "danger" },
  quota_exhausted: { label: "Quota exhausted", variant: "warning" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function AuthErrorBanner({ message }: { message: string }) {
  return (
    <Panel className="border border-[color-mix(in_srgb,var(--color-danger-400)_40%,var(--color-shell-border-strong))] bg-[color-mix(in_srgb,var(--color-danger-900)_26%,var(--color-shell-panel))] p-6 text-left text-[var(--color-shell-text-strong)] shadow-none">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-danger-200">
        Authentication required
      </p>
      <p className="mt-3 max-w-xl text-[1rem] leading-7 text-danger-50/88">
        {message}
      </p>
    </Panel>
  );
}

export default async function BillingPage() {
  const { user, error } = await getUser();

  if (error || !user) {
    return (
      <div className="space-y-8">
        <AuthErrorBanner message="You need to be signed in to view billing and usage." />
      </div>
    );
  }

  const summary = await getBrowserSafeBillingSummary({ accountId: user.id });
  const badge = runtimeBadge[summary.runtime.state];
  const quotaPercent = summary.quota.limit > 0
    ? Math.min(100, Math.round((summary.quota.used / summary.quota.limit) * 100))
    : 0;

  return (
    <div className="space-y-8">
      <section className="animate-fade-up overflow-hidden border border-[var(--color-shell-border-strong)] bg-[color-mix(in_srgb,var(--color-shell-panel)_78%,black)] px-6 py-7 text-[var(--color-shell-text-strong)] md:px-8 md:py-8 lg:px-10 lg:py-10">
        <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)] sm:text-[13px]">
          Billing
        </p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="max-w-3xl text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white md:text-[3.5rem]">
              Usage summary
            </h1>
            <p className="mt-5 max-w-2xl text-[1.05rem] leading-7 text-zinc-300 md:text-[1.15rem]">
              Your managed Abra quota, runtime availability, and billing action in one safe dashboard view.
            </p>
          </div>
          <Badge variant={summary.tier === "growth" ? "brand" : "default"}>{summary.tierLabel}</Badge>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={shellCardClassName}>
          <p className={shellLabelClassName}>Tier</p>
          <p className="mt-3 text-h4 font-display font-bold text-white">{summary.tierLabel}</p>
          <p className="mt-2 text-caption text-zinc-400">Billing status: {summary.status}</p>
        </Card>
        <Card className={shellCardClassName}>
          <p className={shellLabelClassName}>Remaining</p>
          <p className="mt-3 text-h4 font-display font-bold text-white">{summary.quota.remaining}</p>
          <p className="mt-2 text-caption text-zinc-400">of {summary.quota.limit} managed messages</p>
        </Card>
        <Card className={shellCardClassName}>
          <p className={shellLabelClassName}>Reset date</p>
          <p className="mt-3 text-h6 font-display font-bold text-white">{formatDate(summary.quota.resetAt)}</p>
          <p className="mt-2 text-caption text-zinc-400">Window {summary.quota.windowId}</p>
        </Card>
      </div>

      <Card className={shellCardClassName}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-shell-border-strong)] pb-5">
          <div>
            <p className={shellLabelClassName}>Quota</p>
            <h2 className="mt-4 text-h5 font-display font-bold text-white">Managed runtime usage</h2>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        <div className="mt-6 space-y-5">
          <div className="grid gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 sm:grid-cols-3">
            <span>Used: {summary.quota.used}</span>
            <span>Remaining: {summary.quota.remaining}</span>
            <span>Limit: {summary.quota.limit}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-sm border border-[var(--color-shell-border-strong)] bg-black/30" aria-label={`${summary.quota.used} of ${summary.quota.limit} managed messages used`}>
            <div
              className="h-full bg-[var(--color-shell-signal)] transition-all duration-200 ease-smooth"
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
          <p className="text-body text-zinc-300">
            Runtime state: <span className="font-semibold text-white">{badge.label}</span>
          </p>
          {summary.runtime.blockReason && (
            <Panel bordered className="border-[color-mix(in_srgb,var(--color-warning-400)_42%,var(--color-shell-border-strong))] bg-[color-mix(in_srgb,var(--color-warning-900)_24%,var(--color-shell-panel))] text-warning-50/90">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-warning-200">
                Safe block reason
              </p>
              <p className="mt-2 text-body">{summary.runtime.blockReason}</p>
            </Panel>
          )}
        </div>
      </Card>

      <Card className={shellCardClassName}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={shellLabelClassName}>Billing action</p>
            <h2 className="mt-4 text-h5 font-display font-bold text-white">{summary.action.label}</h2>
            <p className="mt-3 max-w-xl text-body text-zinc-300">
              {summary.action.kind === "upgrade"
                ? "Move to Growth when you need a larger managed runtime quota."
                : "Open the billing portal to review or update your Growth subscription."}
            </p>
          </div>
          <BillingActionButton action={summary.action} />
        </div>
      </Card>

      <div className="h-px bg-[color-mix(in_srgb,var(--color-shell-border-strong)_82%,transparent)]" />
      <div className="flex items-center justify-between text-caption text-zinc-500">
        <span>Abra · Billing</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
