"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Panel } from "@/components/ui";
import type { DashboardDeployment } from "@/lib/deployments";
import { deleteAbraInstance, submitDeploymentRequest } from "./actions";
import { canDeploy } from "./deployment-rules";
import { initialDeploymentFormState } from "./deployment-form-state";

interface DeploymentConsoleProps {
  initialDeployment: DashboardDeployment | null;
  persistenceWarning: string | null;
  telegramConfigured: boolean;
}

const STATUS_BADGES: Record<
  DashboardDeployment["status"] | "idle",
  { variant: "warning" | "info" | "success" | "danger" | "default"; label: string }
> = {
  idle: { variant: "default", label: "Not deployed" },
  queued: { variant: "warning", label: "Queued" },
  running: { variant: "info", label: "Deploying" },
  succeeded: { variant: "success", label: "Ready" },
  failed: { variant: "danger", label: "Failed" },
  deleting: { variant: "warning", label: "Deleting" },
  deleted: { variant: "default", label: "Deleted" },
};

function isTransitioning(deployment: DashboardDeployment | null) {
  return (
    deployment?.status === "queued" ||
    deployment?.status === "running" ||
    deployment?.status === "deleting"
  );
}

function canStop(deployment: DashboardDeployment | null) {
  return !canDeploy(deployment) && !isTransitioning(deployment);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DeploymentConsole({
  initialDeployment,
  persistenceWarning,
  telegramConfigured,
}: DeploymentConsoleProps) {
  const router = useRouter();
  const [deployState, deployAction, deployPending] = useActionState(
    submitDeploymentRequest,
    initialDeploymentFormState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAbraInstance,
    initialDeploymentFormState,
  );
  const [polledDeployment, setPolledDeployment] = useState<DashboardDeployment | null>(null);
  // Keyed to the deployment id (rather than reset via effect) so confirmation
  // state can't leak across a stop-then-restart cycle in the same session.
  const [confirmingStopFor, setConfirmingStopFor] = useState<string | null>(null);

  const deployment = useMemo(
    () => [initialDeployment, deployState.deployment, deleteState.deployment, polledDeployment]
      .filter((item): item is DashboardDeployment => item !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null,
    [deleteState.deployment, deployState.deployment, initialDeployment, polledDeployment],
  );
  const latestMessage = deleteState.message ?? deployState.message;
  const latestStatus = deleteState.message ? deleteState.status : deployState.status;
  const latestWarning = deleteState.warning ?? deployState.warning ?? persistenceWarning;
  // Once the stop actually starts processing (status flips to "deleting"),
  // fall through to the disabled "Stopping…" state instead of leaving the
  // confirm step active and re-clickable.
  const confirmingStop =
    deployment !== null && confirmingStopFor === deployment.id && !isTransitioning(deployment);

  const skipNextRefresh = useRef(true);
  useEffect(() => {
    // The dashboard hero is rendered server-side; refresh it whenever a
    // start/stop action here resolves so it doesn't go stale until the next
    // full navigation.
    if (skipNextRefresh.current) {
      skipNextRefresh.current = false;
      return;
    }
    router.refresh();
  }, [deployState, deleteState, router]);

  useEffect(() => {
    const pollingDeployment = deployment;

    if (!isTransitioning(pollingDeployment) || !pollingDeployment?.orchestration?.operationId) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const response = await fetch(
        `/api/dashboard/deployments/${pollingDeployment.id}/status`,
        { cache: "no-store" },
      );

      if (response.ok) {
        const next = (await response.json()) as DashboardDeployment;
        setPolledDeployment(next);
        if (next.status !== pollingDeployment.status) {
          router.refresh();
        }
      }
    }, Math.max(800, pollingDeployment.orchestration.pollAfterMs));

    return () => window.clearTimeout(timer);
  }, [deployment, router]);

  const badge = STATUS_BADGES[deployment?.status ?? "idle"];
  const transitioning = isTransitioning(deployment);
  const shouldShowStart = canDeploy(deployment);

  let actionRow: React.ReactNode;
  if (confirmingStop) {
    actionRow = (
      <>
        <Button
          type="button"
          variant="ghost"
          className="w-full sm:w-auto"
          disabled={deletePending}
          onClick={() => setConfirmingStopFor(null)}
        >
          Cancel
        </Button>
        <form action={deleteAction} className="flex sm:inline-flex">
          <Button type="submit" variant="danger" size="lg" className="w-full sm:w-auto" disabled={deletePending}>
            {deletePending ? "Stopping…" : "Confirm stop"}
          </Button>
        </form>
      </>
    );
  } else if (shouldShowStart) {
    actionRow = (
      <form action={deployAction} className="flex sm:inline-flex">
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={deployPending || !telegramConfigured}>
          {deployPending ? "Starting…" : "Start"}
        </Button>
      </form>
    );
  } else {
    const startingUp = deployment?.status === "queued" || deployment?.status === "running";
    actionRow = (
      <Button
        type="button"
        variant={startingUp ? "primary" : "danger"}
        size="lg"
        className="w-full sm:w-auto"
        disabled={!canStop(deployment)}
        onClick={() => setConfirmingStopFor(deployment?.id ?? null)}
      >
        {startingUp ? "Starting…" : transitioning ? "Stopping…" : "Stop"}
      </Button>
    );
  }

  return (
    <Card id="deployment-request" className="relative overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-brand-500/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-5 border-b border-white/10 pb-7">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-shell-signal)]">Abra instance</p>
          <h2 className="mt-4 max-w-2xl text-h4 font-display font-bold tracking-[-0.025em] text-white">
            {deployment ? deployment.request.name : "No instance deployed"}
          </h2>
        </div>
        <Badge variant={badge.variant} className={transitioning ? "animate-pulse-slow" : ""}>
          {badge.label}
        </Badge>
      </div>

      {deployment?.errorMessage && (
        <Panel bordered className="mt-5 border-danger-400/40 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-danger-200">Failure detail</p>
          <p className="mt-2 text-caption text-danger-50">{deployment.errorMessage}</p>
        </Panel>
      )}

      {latestWarning && (
        <Panel bordered className="mt-5 border-warning-400/40 bg-[color-mix(in_srgb,var(--color-warning-900)_30%,var(--color-shell-panel))]">
          <p className="text-caption font-semibold uppercase tracking-wide text-warning-200">Storage notice</p>
          <p className="mt-2 text-body text-warning-100/90">{latestWarning}</p>
        </Panel>
      )}

      {latestMessage && (
        <Panel
          bordered
          className={`mt-5 ${
            latestStatus === "success"
              ? "border-success-400/40 bg-[color-mix(in_srgb,var(--color-success-900)_30%,var(--color-shell-panel))]"
              : "border-danger-400/40 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))]"
          }`}
        >
          <p className={`text-body font-medium ${latestStatus === "success" ? "text-success-50" : "text-danger-50"}`}>
            {latestMessage}
          </p>
        </Panel>
      )}

      <div className="relative mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {actionRow}
        <Button variant="ghost" href="/dashboard/settings" className="w-full sm:w-auto">
          Settings
        </Button>
      </div>

      {shouldShowStart && !telegramConfigured && (
        <p className="mt-4 text-center text-caption text-zinc-500">
          Set up Telegram in{" "}
          <a href="/dashboard/settings#bot-setup" className="underline hover:text-zinc-300">
            Settings
          </a>{" "}
          to enable Start.
        </p>
      )}

      {deployment && (
        <p className="mt-7 border-t border-white/10 pt-5 text-center font-mono text-[11px] uppercase tracking-[0.13em] text-zinc-500">
          Created {formatTimestamp(deployment.createdAt)} · Updated {formatTimestamp(deployment.updatedAt)}
        </p>
      )}
    </Card>
  );
}
