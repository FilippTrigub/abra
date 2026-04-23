import { Badge, Button, Card, ErrorState, Panel } from "@/components/ui";
import { getUser } from "@/lib/auth/supabase-client";
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
      <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-brand-50 via-secondary-50 to-accent-50 p-8 md:p-12">
        <div
          aria-hidden
          className="absolute -top-12 -right-12 h-48 w-48 shape-abstract-blob opacity-40 blur-xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-16 -left-8 h-56 w-56 shape-abstract-petal opacity-30 blur-lg"
        />
        <div
          aria-hidden
          className="absolute top-1/2 right-1/4 h-24 w-24 shape-abstract-ring opacity-20 blur-sm"
        />

        <div className="relative">
          <span className="text-caption font-semibold uppercase tracking-wide text-brand-500">
            Welcome back
          </span>
          <h1 className="mt-2 text-h2 font-display font-extrabold text-content-100 md:text-h1">
            Your brand command center
          </h1>
          <p className="mt-3 max-w-2xl text-body text-content-500">
            Queue deployment requests, hand them off to the orchestration adapter, and track the lifecycle from queued to terminal state without blocking the dashboard response.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="primary" href="#deployment-request">
              Request deployment
            </Button>
            <Button variant="ghost" href="/dashboard/settings">
              Settings
            </Button>
            <Badge variant={activeCount > 0 ? "info" : "success"}>
              {activeCount > 0 ? `${activeCount} active rollout${activeCount > 1 ? "s" : ""}` : "All quiet"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card interactive>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-content-500">
                Deployments
              </p>
              <p className="mt-1 text-h2 font-display font-bold text-content-100">
                {deploymentCount}
              </p>
              <p className="mt-1 text-caption text-content-600">
                Durable request records in your dashboard feed
              </p>
            </div>
            <span className="text-3xl opacity-40">🚀</span>
          </div>
        </Card>

        <Card interactive>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-content-500">
                Active queue
              </p>
              <p className="mt-1 text-h2 font-display font-bold text-content-100">
                {activeCount}
              </p>
              <p className="mt-1 text-caption text-content-600">
                Requests currently queued or running
              </p>
            </div>
            <span className="text-3xl opacity-40">⏱️</span>
          </div>
        </Card>

        <Card interactive>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-caption font-semibold uppercase tracking-wide text-content-500">
                Latest outcome
              </p>
              <p className="mt-1 text-h5 font-display font-bold text-content-100">
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
            <span className="text-3xl opacity-40">📈</span>
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

      <Panel bordered muted>
        <h3 className="mb-4 text-h6 font-display font-bold text-content-100">
          Quick access
        </h3>
        <div className="flex flex-wrap gap-3">
          {NAV_LINKS.map((link) => (
            <Button key={link.href} variant="ghost" href={link.href}>
              {link.label}
            </Button>
          ))}
        </div>
      </Panel>

      <div className="section-divider" />
      <div className="flex items-center justify-between text-caption text-content-600">
        <span>Claw Parade · Platform</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
