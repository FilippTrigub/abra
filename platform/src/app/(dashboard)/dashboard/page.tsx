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
    <div className="space-y-10">
      <section className="animate-fade-up overflow-hidden border border-[var(--color-shell-border-strong)] bg-[color-mix(in_srgb,var(--color-shell-panel)_78%,black)] text-[var(--color-shell-text-strong)]">
        <div className="px-6 py-7 md:px-8 md:py-8 lg:px-10 lg:py-10">
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)] sm:text-[13px]">
            Welcome back
          </span>
          <h1 className="mt-5 max-w-3xl text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white md:text-[3.5rem]">
            Your brand command center
          </h1>
          <p className="mt-5 max-w-2xl text-[1.05rem] leading-7 text-zinc-300 md:text-[1.15rem]">
            Start one Abra runtime for your account, monitor its status, and stop it when you want to replace the instance.
          </p>
        </div>
      </section>

      {feedLoadError && (
        <FeedErrorBanner message={feedLoadError} />
      )}

      <DeploymentConsole
        initialDeployment={currentDeployment}
        persistenceWarning={feedWarning}
        telegramConfigured={telegramConfigured}
      />

      <div className="h-px bg-[color-mix(in_srgb,var(--color-shell-border-strong)_82%,transparent)]" />
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 sm:text-[12px]">
        <span>Abra · Dashboard</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
