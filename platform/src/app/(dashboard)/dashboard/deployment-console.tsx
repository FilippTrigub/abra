"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Panel } from "@/components/ui";
import type { DashboardDeployment } from "@/lib/deployments";
import { deleteAbraInstance, submitDeploymentRequest } from "./actions";
import { canDeploy } from "./deployment-rules";
import { initialDeploymentFormState } from "./deployment-form-state";
import { TelegramBotForm, type TelegramBotStatus } from "./telegram-bot-form";

interface DeploymentConsoleProps {
  initialDeployment: DashboardDeployment | null;
  persistenceWarning: string | null;
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

function isPollingStatus(deployment: DashboardDeployment | null): deployment is DashboardDeployment {
  return deployment?.status === "queued" || deployment?.status === "running" || deployment?.status === "deleting";
}

function hasDeletableInstance(deployment: DashboardDeployment | null) {
  return Boolean(deployment && deployment.status !== "deleted" && deployment.status !== "deleting");
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SubmitButton({ pending }: { pending: boolean }) {
  return <Button type="submit" disabled={pending}>{pending ? "Deploying Abra…" : "Deploy Abra"}</Button>;
}

function DeleteButton({
  pending,
  disabled,
  confirming,
  onRequestConfirm,
  onCancel,
}: {
  pending: boolean;
  disabled: boolean;
  confirming: boolean;
  onRequestConfirm: () => void;
  onCancel: () => void;
}) {
  if (!confirming) {
    return (
      <Button type="button" variant="danger" disabled={disabled} onClick={onRequestConfirm}>
        Delete instance
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" variant="danger" disabled={pending || disabled}>
        {pending ? "Deleting…" : "Confirm delete"}
      </Button>
    </div>
  );
}

function InstanceStatusBox({ deployment }: { deployment: DashboardDeployment | null }) {
  const badge = STATUS_BADGES[deployment?.status ?? "idle"];
  const isTransitioning = deployment?.status === "queued" || deployment?.status === "running" || deployment?.status === "deleting";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-shell-border-strong)] pb-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Abra instance</p>
          <h2 className="mt-4 text-h4 font-display font-bold text-white">
            {deployment ? deployment.request.name : "No instance deployed"}
          </h2>
          <p className="mt-3 max-w-2xl text-body leading-7 text-zinc-300">
            {deployment
              ? "This is the single Abra runtime for your account. Delete it before deploying another instance."
              : "Deploy one Abra runtime for this account. History is kept separately from the live instance."}
          </p>
        </div>
        <Badge variant={badge.variant} className={isTransitioning ? "animate-pulse-slow" : ""}>
          {badge.label}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Panel bordered muted className="rounded-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Created</p>
          <p className="mt-2 text-caption text-white">
            {deployment ? formatTimestamp(deployment.createdAt) : "Never"}
          </p>
        </Panel>
        <Panel bordered muted className="rounded-sm">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Last update</p>
          <p className="mt-2 text-caption text-white">
            {deployment ? formatTimestamp(deployment.updatedAt) : "Never"}
          </p>
        </Panel>
      </div>

      {deployment?.errorMessage && (
        <Panel bordered className="mt-5 border-danger-400/40 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-danger-200">Failure detail</p>
          <p className="mt-2 text-caption text-danger-50">{deployment.errorMessage}</p>
        </Panel>
      )}
    </Card>
  );
}

export function DeploymentConsole({
  initialDeployment,
  persistenceWarning,
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
  const [telegramStatus, setTelegramStatus] = useState<TelegramBotStatus>({ loaded: false, configured: false });
  const [confirmingDeleteFor, setConfirmingDeleteFor] = useState<string | null>(null);

  const deployment = useMemo(
    () => [initialDeployment, deployState.deployment, deleteState.deployment, polledDeployment]
      .filter((item): item is DashboardDeployment => item !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null,
    [deleteState.deployment, deployState.deployment, initialDeployment, polledDeployment],
  );
  const latestMessage = deleteState.message ?? deployState.message;
  const latestStatus = deleteState.message ? deleteState.status : deployState.status;
  const latestWarning = deleteState.warning ?? deployState.warning ?? persistenceWarning;
  // Keyed to the deployment id (rather than reset via effect) so confirmation
  // state can't leak across a delete-then-redeploy cycle in the same session.
  const confirmingDelete = deployment !== null && confirmingDeleteFor === deployment.id;

  const skipNextRefresh = useRef(true);
  useEffect(() => {
    // The dashboard hero status/CTA is rendered server-side from the initial
    // deployment snapshot; refresh it whenever a deploy/delete action here
    // resolves so it doesn't go stale until the next full navigation.
    if (skipNextRefresh.current) {
      skipNextRefresh.current = false;
      return;
    }
    router.refresh();
  }, [deployState, deleteState, router]);

  useEffect(() => {
    const pollingDeployment = deployment;

    if (!isPollingStatus(pollingDeployment) || !pollingDeployment.orchestration?.operationId) {
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

  const shouldShowDeployForm = canDeploy(deployment);

  return (
    <div className="animate-fade-up space-y-6" id="deployment-request">
      <InstanceStatusBox deployment={deployment} />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-shell-border-strong)] pb-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Instance controls</p>
            <h3 className="mt-4 text-h5 font-display font-bold text-white">
              {shouldShowDeployForm ? "Deploy your Abra runtime" : "Manage current runtime"}
            </h3>
            <p className="mt-3 max-w-2xl text-body leading-7 text-zinc-300">
              {shouldShowDeployForm
                ? "Create the only Abra instance for this account."
                : "A runtime already exists. Delete it before deploying another one."}
            </p>
          </div>
        </div>

        {latestWarning && (
          <Panel bordered className="mt-6 border-warning-400/40 bg-[color-mix(in_srgb,var(--color-warning-900)_30%,var(--color-shell-panel))]">
            <p className="text-caption font-semibold uppercase tracking-wide text-warning-200">Storage notice</p>
            <p className="mt-2 text-body text-warning-100/90">{latestWarning}</p>
          </Panel>
        )}

        {latestMessage && (
          <Panel
            bordered
            className={`mt-6 ${
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

        {shouldShowDeployForm ? (
          telegramStatus.loaded && telegramStatus.configured ? (
            <form action={deployAction} className="mt-8">
              <Panel bordered muted className="flex flex-wrap items-center justify-between gap-4 rounded-sm">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Deployment contract</p>
                  <p className="mt-1 text-body text-zinc-300">
                    One click creates the single Abra instance for this account.
                  </p>
                </div>
                <SubmitButton pending={deployPending} />
              </Panel>
            </form>
          ) : (
            <div className="mt-8">
              <TelegramBotForm onStatusChange={setTelegramStatus} />
            </div>
          )
        ) : (
          <form action={deleteAction} className="mt-8">
            <Panel bordered muted className="flex flex-wrap items-center justify-between gap-4 rounded-sm">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Delete instance</p>
                <p className="mt-1 text-body text-zinc-300">
                  This removes AKS compute resources. Persistent storage follows the configured retention policy.
                </p>
              </div>
              <DeleteButton
                pending={deletePending}
                disabled={!hasDeletableInstance(deployment)}
                confirming={confirmingDelete}
                onRequestConfirm={() => setConfirmingDeleteFor(deployment?.id ?? null)}
                onCancel={() => setConfirmingDeleteFor(null)}
              />
            </Panel>
          </form>
        )}
      </Card>
    </div>
  );
}
