import { Badge, Card, Panel } from "@/components/ui";
import { getUser } from "@/lib/auth/firebase-auth";
import { getDeploymentFeed, type DashboardDeployment } from "@/lib/deployments";

const STATUS_BADGES: Record<
  DashboardDeployment["status"],
  { variant: "warning" | "info" | "success" | "danger" | "default"; label: string }
> = {
  queued: { variant: "warning", label: "Queued" },
  running: { variant: "info", label: "Deploying" },
  succeeded: { variant: "success", label: "Ready" },
  failed: { variant: "danger", label: "Failed" },
  deleting: { variant: "warning", label: "Deleting" },
  deleted: { variant: "default", label: "Deleted" },
};

const shellCardClassName =
  "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none";

const shellInsetClassName =
  "border border-[var(--color-shell-border-strong)] bg-black/20";

const shellLabelClassName =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500";

function formatTimestamp(value: string) {
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

export default async function DeploymentLogsPage() {
  const { user, error } = await getUser();

  if (error || !user) {
    return (
      <div className="space-y-8">
        <AuthErrorBanner message="You need to be signed in to view deployment logs." />
      </div>
    );
  }

  let deployments: DashboardDeployment[] = [];
  let loadError: string | null = null;

  try {
    const feed = await getDeploymentFeed(user.id);
    deployments = feed.deployments;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load deployment logs.";
  }

  return (
    <div className="space-y-8">
      <section className="animate-fade-up overflow-hidden border border-[var(--color-shell-border-strong)] bg-[color-mix(in_srgb,var(--color-shell-panel)_78%,black)] px-6 py-7 text-[var(--color-shell-text-strong)] md:px-8 md:py-8 lg:px-10 lg:py-10">
        <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)] sm:text-[13px]">
          Deployment logs
        </p>
        <h1 className="mt-5 max-w-3xl text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white md:text-[3.5rem]">
          Instance history
        </h1>
        <p className="mt-5 max-w-2xl text-[1.05rem] leading-7 text-zinc-300 md:text-[1.15rem]">
          Logs are separate from the live Abra instance so the dashboard can stay focused on deploy, status, and delete.
        </p>
      </section>

      {loadError && (
        <Panel className="border border-[color-mix(in_srgb,var(--color-danger-400)_40%,var(--color-shell-border-strong))] bg-[color-mix(in_srgb,var(--color-danger-900)_22%,var(--color-shell-panel))] p-6 text-[var(--color-shell-text-strong)] shadow-none">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-danger-200">
            Logs unavailable
          </p>
          <p className="mt-3 max-w-2xl text-[1rem] leading-7 text-danger-50/88">
            {loadError}
          </p>
        </Panel>
      )}

      <Card className={shellCardClassName}>
        <div className="border-b border-[var(--color-shell-border-strong)] pb-5">
          <p className={shellLabelClassName}>Recent records</p>
          <h2 className="mt-4 text-h5 font-display font-bold text-white">
            Deployment log entries
          </h2>
        </div>

        <div className="mt-5 space-y-3">
          {deployments.length === 0 ? (
            <div className={`px-5 py-6 ${shellInsetClassName}`}>
              <p className={shellLabelClassName}>No logs</p>
              <p className="mt-2 text-body text-zinc-300">
                Deployment records will appear here after the first Abra instance action.
              </p>
            </div>
          ) : (
            deployments.map((deployment) => {
              const badge = STATUS_BADGES[deployment.status];
              return (
                <Panel
                  key={deployment.id}
                  bordered
                  className="rounded-sm border-[var(--color-shell-border-strong)] bg-black/20 text-[var(--color-shell-text-strong)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-body font-semibold text-white">
                        {deployment.request.name}
                      </p>
                      <p className="mt-2 text-caption text-zinc-400">
                        {formatTimestamp(deployment.createdAt)} · updated {formatTimestamp(deployment.updatedAt)}
                      </p>
                      {deployment.errorMessage && (
                        <p className="mt-3 text-caption text-danger-100">
                          {deployment.errorMessage}
                        </p>
                      )}
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                </Panel>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
