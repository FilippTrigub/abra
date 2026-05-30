import { Badge, Button, Card, Panel } from "@/components/ui";
import { getUser } from "@/lib/auth/firebase-auth";
import { getDeploymentFeed } from "@/lib/deployments";
import { DeploymentConsole } from "./deployment-console";

const NAV_LINKS = [
  { label: "Abra instance", href: "#deployment-request" },
  { label: "Logs", href: "/dashboard/deployments" },
  { label: "Settings", href: "/dashboard/settings" },
];

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

function FeedErrorBanner({ message }: { message: string }) {
  return (
    <Panel className="border border-[color-mix(in_srgb,var(--color-danger-400)_40%,var(--color-shell-border-strong))] bg-[color-mix(in_srgb,var(--color-danger-900)_22%,var(--color-shell-panel))] p-6 text-[var(--color-shell-text-strong)] shadow-none">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-danger-200">
        Feed unavailable
      </p>
      <p className="mt-3 max-w-2xl text-[1rem] leading-7 text-danger-50/88">
        {message}
      </p>
    </Panel>
  );
}

export default async function DashboardPage() {
  const { user, error } = await getUser();

  if (error || !user) {
    return (
      <div className="space-y-8">
        <AuthErrorBanner message="You need to be signed in to access the dashboard. Try signing in again." />
      </div>
    );
  }

  let feedWarning: string | null = null;
  let feedLoadError: string | null = null;
  let currentDeployment: Awaited<ReturnType<typeof getDeploymentFeed>>["currentDeployment"] = null;

  try {
    const feed = await getDeploymentFeed(user.id);
    currentDeployment = feed.currentDeployment;
    feedWarning = feed.warning;
  } catch (err) {
    feedLoadError = err instanceof Error ? err.message : "Could not load deployment feed.";
  }

  const instanceStatus = currentDeployment?.status ?? "idle";
  const statusLabel = currentDeployment
    ? instanceStatus === "succeeded"
      ? "Ready"
      : instanceStatus === "running"
        ? "Deploying"
        : instanceStatus === "queued"
          ? "Queued"
          : instanceStatus === "deleting"
            ? "Deleting"
            : instanceStatus === "deleted"
              ? "Deleted"
              : "Failed"
    : "Not deployed";
  const primaryActionLabel = currentDeployment && currentDeployment.status !== "deleted"
    ? "Stop"
    : "Start";
  const shellGhostButtonClassName =
    "rounded-sm border border-white/12 bg-transparent font-mono text-[12px] uppercase tracking-[0.14em] text-zinc-100 shadow-none hover:border-white/25 hover:bg-white/[0.04] hover:text-white";
  const shellStatusBadgeClassName =
    "rounded-sm border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]";

  return (
    <div className="space-y-10">
      <section className="overflow-hidden border border-[var(--color-shell-border-strong)] bg-[color-mix(in_srgb,var(--color-shell-panel)_78%,black)] text-[var(--color-shell-text-strong)]">
        <div className="grid gap-10 px-6 py-7 md:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)] md:px-8 md:py-8 lg:px-10 lg:py-10">
          <div>
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)] sm:text-[13px]">
              Welcome back
            </span>
            <h1 className="mt-5 max-w-3xl text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white md:text-[3.5rem]">
              Your brand command center
            </h1>
            <p className="mt-5 max-w-2xl text-[1.05rem] leading-7 text-zinc-300 md:text-[1.15rem]">
              Deploy one Abra runtime for your account, monitor its status, and delete it when you want to replace the instance.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                href="#deployment-request"
                className="rounded-sm border border-brand-400/40 shadow-none"
              >
                {primaryActionLabel}
              </Button>
              <Button
                variant="ghost"
                href="/dashboard/settings"
                className={shellGhostButtonClassName}
              >
                Settings
              </Button>
              <Badge
                variant={currentDeployment ? "info" : "success"}
                className={shellStatusBadgeClassName}
              >
                {statusLabel}
              </Badge>
            </div>
          </div>

          <div className="self-start border border-[var(--color-shell-border-strong)] bg-black/10">
            {[
              ["Instance", currentDeployment ? currentDeployment.request.name : "Not deployed"],
              ["Status", statusLabel],
              ["Logs", "Header"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border-b border-[var(--color-shell-border-strong)] px-5 py-5 last:border-b-0"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  {label}
                </p>
                <p className="mt-3 text-[1.2rem] leading-6 font-semibold text-white md:text-[1.35rem]">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="rounded-[1.25rem] border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none">
          <div className="border-l border-[var(--color-shell-border-strong)] pl-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Abra instance
              </p>
              <p className="mt-3 text-h2 font-display font-bold text-white">
                {currentDeployment ? "1" : "0"}
              </p>
              <p className="mt-2 text-caption text-zinc-400">
                Active runtime allowed for this account
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[1.25rem] border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none">
          <div className="border-l border-[var(--color-shell-border-strong)] pl-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Runtime status
              </p>
              <p className="mt-3 text-h5 font-display font-bold text-white">
                {statusLabel}
              </p>
              <p className="mt-2 text-caption text-zinc-400">
                Live state from the orchestration adapter
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[1.25rem] border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none">
          <div className="border-l border-[var(--color-shell-border-strong)] pl-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Deployment logs
              </p>
              <p className="mt-3 text-h2 font-display font-bold text-white">
                ↗
              </p>
              <p className="mt-2 text-caption text-zinc-400">
                Available from the header navigation
              </p>
            </div>
          </div>
        </Card>
      </div>

      {feedLoadError && (
        <FeedErrorBanner message={feedLoadError} />
      )}

      <div id="deployment-request">
        <DeploymentConsole
          initialDeployment={currentDeployment}
          persistenceWarning={feedWarning}
        />
      </div>

      <Panel bordered className="rounded-[1.25rem] border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] p-6 text-[var(--color-shell-text-strong)] shadow-none">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-shell-signal)]">
          Navigate
        </p>
        <h3 className="mt-3 mb-5 text-[1.6rem] leading-[1.08] font-display font-bold tracking-[-0.03em] text-white">
          Quick links
        </h3>
        <div className="flex flex-wrap gap-3">
          {NAV_LINKS.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              href={link.href}
              className={shellGhostButtonClassName}
            >
              {link.label}
            </Button>
          ))}
        </div>
      </Panel>

      <div className="h-px bg-[color-mix(in_srgb,var(--color-shell-border-strong)_82%,transparent)]" />
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 sm:text-[12px]">
        <span>Abra · Dashboard</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
