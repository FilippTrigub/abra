import { Panel } from "@/components/ui";
import { getUser } from "@/lib/auth/firebase-auth";
import { getDeploymentFeed } from "@/lib/deployments";
import { hasAgentConfig } from "@/lib/agent-config/service";
import { DeploymentConsole } from "./deployment-console";

function AuthErrorBanner({ message }: { message: string }) {
  return (
    <Panel bordered className="border-[color-mix(in_srgb,var(--color-danger-400)_40%,var(--color-shell-border-strong))] bg-[color-mix(in_srgb,var(--color-danger-900)_26%,var(--color-shell-panel))] p-6 text-left">
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
    <Panel bordered className="border-[color-mix(in_srgb,var(--color-danger-400)_40%,var(--color-shell-border-strong))] bg-[color-mix(in_srgb,var(--color-danger-900)_22%,var(--color-shell-panel))] p-6">
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

  const telegramConfigured = await hasAgentConfig(user.id);

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="animate-fade-up space-y-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-shell-signal)]">
          Control room
        </p>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <h1 className="text-h3 font-display font-bold tracking-[-0.03em] text-white sm:text-h2">
              Dashboard
            </h1>
            <p className="mt-3 text-body text-zinc-400">
              Start, stop, and review the Abra runtime without losing sight of what still needs approval.
            </p>
          </div>
        </div>
      </section>

      {feedLoadError && (
        <FeedErrorBanner message={feedLoadError} />
      )}

      <div className="animate-fade-up stagger-2">
        <DeploymentConsole
          initialDeployment={currentDeployment}
          persistenceWarning={feedWarning}
          telegramConfigured={telegramConfigured}
        />
      </div>

      <div className="h-px bg-[color-mix(in_srgb,var(--color-shell-border-strong)_82%,transparent)]" />
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 sm:text-[12px]">
        <span>Abra · Dashboard</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
