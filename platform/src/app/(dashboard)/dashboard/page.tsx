import { Badge, Button, Card, ErrorState, Panel } from "@/components/ui";
import { getUser } from "@/lib/auth/firebase-auth";
import { getDeploymentFeed } from "@/lib/deployments";
import { DeploymentConsole } from "./deployment-console";

const NAV_LINKS = [
  { label: "Deployments", href: "#deployment-request" },
  { label: "Settings", href: "/dashboard/settings" },
];

function AuthErrorBanner({ message }: { message: string }) {
  return (
    <ErrorState
      title="Authentication required"
      description={message}
    />
  );
}

function FeedErrorBanner({ message }: { message: string }) {
  return (
    <Panel bordered muted className="border-danger-200 bg-danger-50/70">
      <ErrorState
        title="Feed unavailable"
        description={message}
      />
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
  let deployments: Awaited<ReturnType<typeof getDeploymentFeed>>["deployments"] = [];

  try {
    const feed = await getDeploymentFeed(user.id);
    deployments = feed.deployments;
    feedWarning = feed.warning;
  } catch (err) {
    feedLoadError = err instanceof Error ? err.message : "Could not load deployment feed.";
  }

  const deploymentCount = deployments.length;
  const activeCount = deployments.filter(
    (deployment) =>
      deployment.status === "queued" || deployment.status === "running",
  ).length;
  const latestDeployment = deployments[0] ?? null;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-canvas)] text-[var(--color-shell-text-strong)]">
        <div className="grid gap-8 px-8 py-8 md:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)] md:px-10 md:py-10">
          <div>
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)] sm:text-[13px]">
              Welcome back
            </span>
            <h1 className="mt-5 max-w-3xl text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white md:text-[3.5rem]">
              Your brand command center
            </h1>
            <p className="mt-5 max-w-2xl text-[1.05rem] leading-7 text-zinc-300 md:text-[1.15rem]">
              Queue deployment requests, hand them off to the orchestration adapter, and track the lifecycle from queued to terminal state without blocking the dashboard response.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" href="#deployment-request">
                Request deployment
              </Button>
              <Button
                variant="ghost"
                href="/dashboard/settings"
                className="border border-white/12 bg-white/[0.03] text-zinc-100 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
              >
                Settings
              </Button>
              <Badge variant={activeCount > 0 ? "info" : "success"}>
                {activeCount > 0
                  ? `${activeCount} active rollout${activeCount > 1 ? "s" : ""}`
                  : "All quiet"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 self-start border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2 md:grid-cols-1">
            {[
              ["Deployments", `${deploymentCount}`],
              ["Active queue", `${activeCount}`],
              ["Latest outcome", latestDeployment ? latestDeployment.request.name : "No requests yet"],
            ].map(([label, value]) => (
              <div key={label} className="border border-white/10 bg-black/10 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
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
        <Card interactive className="border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Deployments
              </p>
              <p className="mt-3 text-h2 font-display font-bold text-white">
                {deploymentCount}
              </p>
              <p className="mt-2 text-caption text-zinc-400">
                Durable request records in your dashboard feed
              </p>
            </div>
            <span className="text-3xl opacity-60">🚀</span>
          </div>
        </Card>

        <Card interactive className="border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Active queue
              </p>
              <p className="mt-3 text-h2 font-display font-bold text-white">
                {activeCount}
              </p>
              <p className="mt-2 text-caption text-zinc-400">
                Requests currently queued or running
              </p>
            </div>
            <span className="text-3xl opacity-60">⏱️</span>
          </div>
        </Card>

        <Card interactive className="border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Latest outcome
              </p>
              <p className="mt-3 text-h5 font-display font-bold text-white">
                {latestDeployment ? latestDeployment.request.name : "No requests yet"}
              </p>
              <div className="mt-2">
                <Badge
                  variant={
                    latestDeployment?.status === "failed"
                      ? "danger"
                      : latestDeployment?.status === "succeeded"
                        ? "success"
                        : latestDeployment?.status === "running"
                          ? "info"
                          : latestDeployment?.status === "queued"
                            ? "warning"
                            : "default"
                  }
                >
                  {latestDeployment?.status ?? "idle"}
                </Badge>
              </div>
            </div>
            <span className="text-3xl opacity-60">📈</span>
          </div>
        </Card>
      </div>

      {feedLoadError && (
        <FeedErrorBanner message={feedLoadError} />
      )}

      <div id="deployment-request">
        <DeploymentConsole
          initialDeployments={deployments}
          persistenceWarning={feedWarning}
        />
      </div>

      <Panel bordered className="border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)]">
        <h3 className="mb-4 text-h6 font-display font-bold text-white">
          Quick access
        </h3>
        <div className="flex flex-wrap gap-3">
          {NAV_LINKS.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              href={link.href}
              className="border border-white/12 bg-white/[0.03] text-zinc-100 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
            >
              {link.label}
            </Button>
          ))}
        </div>
      </Panel>

      <div className="section-divider" />
      <div className="flex items-center justify-between text-caption text-content-600">
        <span>Abra · Platform</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
