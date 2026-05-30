"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input, Label, Panel, Select, Textarea } from "@/components/ui";
import type { DashboardDeployment } from "@/lib/deployments";
import { deleteAbraInstance, submitDeploymentRequest } from "./actions";
import { initialDeploymentFormState } from "./deployment-form-state";

interface DeploymentConsoleProps {
  initialDeployment: DashboardDeployment | null;
  deploymentHistory: DashboardDeployment[];
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

const shellCardClassName =
  "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none";

const shellInsetClassName =
  "border border-[var(--color-shell-border-strong)] bg-black/20";

const shellLabelClassName =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500";

const shellFieldClassName =
  "rounded-sm border-[var(--color-shell-border-strong)] bg-black/20 text-white placeholder:text-zinc-500 hover:border-white/20 focus:border-brand-300";

function isPollingStatus(deployment: DashboardDeployment | null): deployment is DashboardDeployment {
  return deployment?.status === "queued" || deployment?.status === "running" || deployment?.status === "deleting";
}

function hasDeletableInstance(deployment: DashboardDeployment | null) {
  return Boolean(deployment && deployment.status !== "deleted" && deployment.status !== "deleting");
}

function canDeploy(deployment: DashboardDeployment | null) {
  return !deployment || deployment.status === "deleted" ||
    (deployment.status === "failed" && deployment.orchestration?.action !== "destroy");
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} className="rounded-sm shadow-none">
      {pending ? "Deploying Abra…" : "Deploy Abra"}
    </Button>
  );
}

function DeleteButton({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <Button type="submit" variant="danger" disabled={pending || disabled} className="rounded-sm shadow-none">
      {pending ? "Deleting…" : "Delete instance"}
    </Button>
  );
}

function InstanceStatusBox({ deployment }: { deployment: DashboardDeployment | null }) {
  const badge = STATUS_BADGES[deployment?.status ?? "idle"];

  return (
    <Card className={shellCardClassName}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-shell-border-strong)] pb-6">
        <div>
          <p className={shellLabelClassName}>Abra instance</p>
          <h2 className="mt-4 text-h4 font-display font-bold text-white">
            {deployment ? deployment.request.name : "No instance deployed"}
          </h2>
          <p className="mt-3 max-w-2xl text-body leading-7 text-zinc-300">
            {deployment
              ? "This is the single Abra runtime for your account. Delete it before deploying another instance."
              : "Deploy one Abra runtime for this account. History is kept separately from the live instance."}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className={`px-4 py-4 ${shellInsetClassName}`}>
          <p className={shellLabelClassName}>Runtime</p>
          <p className="mt-2 text-caption text-white">
            {deployment?.resultUrl ?? "Not provisioned"}
          </p>
        </div>
        <div className={`px-4 py-4 ${shellInsetClassName}`}>
          <p className={shellLabelClassName}>Adapter</p>
          <p className="mt-2 text-caption text-white">
            {deployment?.orchestration?.adapter ?? "pending"}
          </p>
        </div>
        <div className={`px-4 py-4 ${shellInsetClassName}`}>
          <p className={shellLabelClassName}>Last update</p>
          <p className="mt-2 text-caption text-white">
            {deployment ? formatTimestamp(deployment.updatedAt) : "Never"}
          </p>
        </div>
      </div>

      {deployment?.errorMessage && (
        <div className="mt-5 rounded-sm border border-danger-300 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-danger-200">
            Failure detail
          </p>
          <p className="mt-2 text-caption text-danger-50">
            {deployment.errorMessage}
          </p>
        </div>
      )}
    </Card>
  );
}

export function DeploymentConsole({
  initialDeployment,
  deploymentHistory,
  persistenceWarning,
}: DeploymentConsoleProps) {
  const [deployState, deployAction, deployPending] = useActionState(
    submitDeploymentRequest,
    initialDeploymentFormState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAbraInstance,
    initialDeploymentFormState,
  );
  const [polledDeployment, setPolledDeployment] = useState<DashboardDeployment | null>(null);

  const deployment = useMemo(
    () => [initialDeployment, deployState.deployment, deleteState.deployment, polledDeployment]
      .filter((item): item is DashboardDeployment => item !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null,
    [deleteState.deployment, deployState.deployment, initialDeployment, polledDeployment],
  );
  const latestMessage = deleteState.message ?? deployState.message;
  const latestStatus = deleteState.message ? deleteState.status : deployState.status;
  const latestWarning = deleteState.warning ?? deployState.warning ?? persistenceWarning;

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
        setPolledDeployment((await response.json()) as DashboardDeployment);
      }
    }, Math.max(800, pollingDeployment.orchestration.pollAfterMs));

    return () => window.clearTimeout(timer);
  }, [deployment]);

  const history = useMemo(
    () => deploymentHistory.filter((item) => item.id !== deployment?.id),
    [deployment?.id, deploymentHistory],
  );
  const shouldShowDeployForm = canDeploy(deployment);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="space-y-6">
        <InstanceStatusBox deployment={deployment} />

        <Card className={shellCardClassName}>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-shell-border-strong)] pb-6">
            <div>
              <p className={shellLabelClassName}>Instance controls</p>
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
            <Panel
              bordered
              muted
              className="mt-6 border-warning-300 bg-[color-mix(in_srgb,var(--color-warning-900)_30%,var(--color-shell-panel))]"
            >
              <p className="text-caption font-semibold uppercase tracking-wide text-warning-200">
                Storage notice
              </p>
              <p className="mt-2 text-body text-warning-100/90">
                {latestWarning}
              </p>
            </Panel>
          )}

          {latestMessage && (
            <Panel
              bordered
              muted
              className={`mt-6 ${
                latestStatus === "success"
                  ? "border-success-300 bg-[color-mix(in_srgb,var(--color-success-900)_30%,var(--color-shell-panel))]"
                  : "border-danger-300 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))]"
              }`}
            >
              <p
                className={`text-body font-medium ${
                  latestStatus === "success" ? "text-success-50" : "text-danger-50"
                }`}
              >
                {latestMessage}
              </p>
            </Panel>
          )}

          {shouldShowDeployForm ? (
            <form action={deployAction} className="mt-8 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className={`space-y-2 px-4 py-4 ${shellInsetClassName}`}>
                  <Label htmlFor="deployment-name">Instance name</Label>
                  <Input
                    id="deployment-name"
                    name="name"
                    defaultValue={deployState.fields.name}
                    placeholder="Abra brand runtime"
                    variant={deployState.fieldErrors.name ? "error" : "default"}
                    errorText={deployState.fieldErrors.name}
                    className={shellFieldClassName}
                  />
                </div>

                <div className={`space-y-2 px-4 py-4 ${shellInsetClassName}`}>
                  <Label htmlFor="deployment-environment">Environment</Label>
                  <Select
                    id="deployment-environment"
                    name="environment"
                    defaultValue={deployState.fields.environment}
                    options={[
                      { value: "preview", label: "Preview" },
                      { value: "staging", label: "Staging" },
                      { value: "production", label: "Production" },
                    ]}
                    variant={deployState.fieldErrors.environment ? "error" : "default"}
                    errorText={deployState.fieldErrors.environment}
                    className={shellFieldClassName}
                  />
                </div>

                <div className={`space-y-2 px-4 py-4 ${shellInsetClassName}`}>
                  <Label htmlFor="deployment-source-ref">Branch / tag / version</Label>
                  <Input
                    id="deployment-source-ref"
                    name="sourceRef"
                    defaultValue={deployState.fields.sourceRef}
                    placeholder="main"
                    variant={deployState.fieldErrors.sourceRef ? "error" : "default"}
                    errorText={deployState.fieldErrors.sourceRef}
                    className={shellFieldClassName}
                  />
                </div>
              </div>

              <div className={`space-y-2 px-4 py-4 ${shellInsetClassName}`}>
                <Label htmlFor="deployment-notes">Deployment notes</Label>
                <Textarea
                  id="deployment-notes"
                  name="notes"
                  defaultValue={deployState.fields.notes}
                  rows={5}
                  placeholder="Optional runtime setup notes."
                  variant={deployState.fieldErrors.notes ? "error" : "default"}
                  errorText={deployState.fieldErrors.notes}
                  className={shellFieldClassName}
                />
              </div>

              <div className={`flex flex-wrap items-center justify-between gap-4 px-4 py-4 ${shellInsetClassName}`}>
                <div>
                  <p className={shellLabelClassName}>Deployment contract</p>
                  <p className="mt-1 text-body text-zinc-300">
                    One account → one Abra instance → one status box
                  </p>
                </div>
                <SubmitButton pending={deployPending} />
              </div>
            </form>
          ) : (
            <form action={deleteAction} className={`mt-8 flex flex-wrap items-center justify-between gap-4 px-4 py-4 ${shellInsetClassName}`}>
              <div>
                <p className={shellLabelClassName}>Delete instance</p>
                <p className="mt-1 text-body text-zinc-300">
                  This removes AKS compute resources. Persistent storage follows the configured retention policy.
                </p>
              </div>
              <DeleteButton pending={deletePending} disabled={!hasDeletableInstance(deployment)} />
            </form>
          )}
        </Card>
      </div>

      <Card className={shellCardClassName}>
        <div className="border-b border-[var(--color-shell-border-strong)] pb-5">
          <p className={shellLabelClassName}>Deployment history</p>
          <h3 className="mt-4 text-h5 font-display font-bold text-white">
            Logs and previous requests
          </h3>
          <p className="mt-3 text-body text-zinc-300">
            History is secondary to the live instance. Use it for troubleshooting, not as the source of truth.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {history.length === 0 ? (
            <div className={`px-5 py-6 ${shellInsetClassName}`}>
              <p className={shellLabelClassName}>No history</p>
              <p className="mt-2 text-body text-zinc-300">
                Previous deployment requests will appear here after the live instance changes.
              </p>
            </div>
          ) : (
            history.map((item) => {
              const badge = STATUS_BADGES[item.status];
              return (
                <Panel
                  key={item.id}
                  bordered
                  className="rounded-sm border-[var(--color-shell-border-strong)] bg-black/20 text-[var(--color-shell-text-strong)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-body font-semibold text-white">{item.request.name}</p>
                      <p className="mt-2 text-caption text-zinc-400">
                        {item.request.sourceRef} · {formatTimestamp(item.createdAt)}
                      </p>
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
