"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Input, Label, Panel, Select, Textarea } from "@/components/ui";
import type { DashboardDeployment } from "@/lib/deployments";
import { submitDeploymentRequest } from "./actions";
import { initialDeploymentFormState } from "./deployment-form-state";

interface DeploymentConsoleProps {
  initialDeployments: DashboardDeployment[];
  persistenceWarning: string | null;
}

const STATUS_BADGES: Record<
  DashboardDeployment["status"],
  { variant: "warning" | "info" | "success" | "danger"; label: string }
> = {
  queued: { variant: "warning", label: "Queued" },
  running: { variant: "info", label: "Running" },
  succeeded: { variant: "success", label: "Succeeded" },
  failed: { variant: "danger", label: "Failed" },
};

function upsertDeployment(
  current: DashboardDeployment[],
  nextDeployment: DashboardDeployment,
) {
  const withoutCurrent = current.filter(
    (deployment) => deployment.id !== nextDeployment.id,
  );

  return [nextDeployment, ...withoutCurrent].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const shellCardClassName =
  "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none";

const shellInsetClassName =
  "border border-[var(--color-shell-border-strong)] bg-black/20";

const shellLabelClassName =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500";

const shellFieldClassName =
  "rounded-sm border-[var(--color-shell-border-strong)] bg-black/20 text-white placeholder:text-zinc-500 hover:border-white/20 focus:border-brand-300";

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} className="rounded-sm shadow-none">
      {pending ? "Queueing request…" : "Request deployment"}
    </Button>
  );
}

export function DeploymentConsole({
  initialDeployments,
  persistenceWarning,
}: DeploymentConsoleProps) {
  const [state, formAction, pending] = useActionState(
    submitDeploymentRequest,
    initialDeploymentFormState,
  );
  const [deployments, setDeployments] = useState(initialDeployments);
  const activeDeploymentsRef = useRef(activeDeploymentsFrom(initialDeployments));

  function activeDeploymentsFrom(items: DashboardDeployment[]) {
    return items.filter(
      (deployment) =>
        (deployment.status === "queued" || deployment.status === "running") &&
        deployment.orchestration?.operationId,
    );
  }

  // Merge new deployment from the action into the list without useEffect.
  const mergedDeployments = useMemo(() => {
    if (!state.deployment) return deployments;
    return deployments.some((d) => d.id === state.deployment!.id)
      ? deployments
      : [state.deployment, ...deployments];
  }, [deployments, state.deployment]);

  const activeDeployments = useMemo(
    () => activeDeploymentsFrom(mergedDeployments),
    [mergedDeployments],
  );

  useEffect(() => {
    activeDeploymentsRef.current = activeDeployments;
  }, [activeDeployments]);

  useEffect(() => {
    if (activeDeployments.length === 0) {
      return;
    }

    const nextPollMs = Math.max(
      800,
      Math.min(...activeDeployments.map((deployment) => deployment.orchestration?.pollAfterMs ?? 1500)),
    );

    const timer = window.setTimeout(async () => {
      const nextDeployments = await Promise.all(
        activeDeploymentsRef.current.map(async (deployment) => {
          const response = await fetch(
            `/api/dashboard/deployments/${deployment.id}/status`,
            { cache: "no-store" },
          );

          if (!response.ok) {
            return deployment;
          }

          return (await response.json()) as DashboardDeployment;
        }),
      );

      setDeployments((current) => {
        let merged = current;
        for (const nextDeployment of nextDeployments) {
          merged = upsertDeployment(merged, nextDeployment);
        }
        return merged;
      });
    }, nextPollMs);

    return () => window.clearTimeout(timer);
  }, [activeDeployments]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className={shellCardClassName}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-shell-border-strong)] pb-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-shell-signal)]">
              Deployment request
            </p>
            <h2 className="mt-4 text-h4 font-display font-bold text-white">
              Queue a new rollout
            </h2>
            <p className="mt-3 max-w-2xl text-body leading-7 text-zinc-300">
              Persist the request first, then hand orchestration off to the AKS adapter. The dashboard keeps polling until the runtime is ready or fails.
            </p>
          </div>
          <Badge
            variant="default"
            className="rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-300"
          >
            Async dispatch
          </Badge>
        </div>

        {(persistenceWarning || state.warning) && (
          <Panel
            bordered
            muted
            className="mt-6 border-warning-300 bg-[color-mix(in_srgb,var(--color-warning-900)_30%,var(--color-shell-panel))]"
          >
            <p className="text-caption font-semibold uppercase tracking-wide text-warning-200">
              Resiliency mode
            </p>
            <p className="mt-2 text-body text-warning-100/90">
              {state.warning ?? persistenceWarning}
            </p>
          </Panel>
        )}

        {state.message && (
          <Panel
            bordered
            muted
            className={`mt-6 ${
              state.status === "success"
                ? "border-success-300 bg-[color-mix(in_srgb,var(--color-success-900)_30%,var(--color-shell-panel))]"
                : "border-danger-300 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))]"
            }`}
          >
            <p
              className={`text-body font-medium ${
                state.status === "success" ? "text-success-50" : "text-danger-50"
              }`}
            >
              {state.message}
            </p>
          </Panel>
        )}

        <form action={formAction} className="mt-8 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className={`space-y-2 px-4 py-4 ${shellInsetClassName}`}>
              <Label htmlFor="deployment-name">Deployment name</Label>
              <Input
                id="deployment-name"
                name="name"
                defaultValue={state.fields.name}
                placeholder="Brand landing page"
                variant={state.fieldErrors.name ? "error" : "default"}
                errorText={state.fieldErrors.name}
                className={shellFieldClassName}
              />
            </div>

            <div className={`space-y-2 px-4 py-4 ${shellInsetClassName}`}>
              <Label htmlFor="deployment-environment">Environment</Label>
              <Select
                id="deployment-environment"
                name="environment"
                defaultValue={state.fields.environment}
                options={[
                  { value: "preview", label: "Preview" },
                  { value: "staging", label: "Staging" },
                  { value: "production", label: "Production" },
                ]}
                variant={state.fieldErrors.environment ? "error" : "default"}
                errorText={state.fieldErrors.environment}
                className={shellFieldClassName}
              />
            </div>

            <div className={`space-y-2 px-4 py-4 ${shellInsetClassName}`}>
              <Label htmlFor="deployment-source-ref">Branch / tag / version</Label>
              <Input
                id="deployment-source-ref"
                name="sourceRef"
                defaultValue={state.fields.sourceRef}
                placeholder="main"
                variant={state.fieldErrors.sourceRef ? "error" : "default"}
                errorText={state.fieldErrors.sourceRef}
                className={shellFieldClassName}
              />
            </div>

          </div>

          <div className={`space-y-2 px-4 py-4 ${shellInsetClassName}`}>
            <Label htmlFor="deployment-notes">Rollout notes</Label>
            <Textarea
              id="deployment-notes"
              name="notes"
              defaultValue={state.fields.notes}
              rows={5}
              placeholder="Optional release notes, smoke checks, or coordination details."
              variant={state.fieldErrors.notes ? "error" : "default"}
              errorText={state.fieldErrors.notes}
              helperText={
                state.fieldErrors.notes
                  ? undefined
                  : "Notes are stored with the durable request record before orchestration starts."
              }
              className={shellFieldClassName}
            />
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-4 px-4 py-4 ${shellInsetClassName}`}>
            <div>
              <p className={shellLabelClassName}>
                Delivery contract
              </p>
              <p className="mt-1 text-body text-zinc-300">
                Request → durable row → async dispatch → status polling
              </p>
            </div>
            <SubmitButton pending={pending} />
          </div>
        </form>
      </Card>

      <div className="space-y-6">
        <Card className={shellCardClassName}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-shell-border-strong)] pb-5">
            <div>
              <p className={shellLabelClassName}>
                Deployment feed
              </p>
              <h3 className="mt-4 text-h5 font-display font-bold text-white">
                Latest request states
              </h3>
            </div>
            <Badge
              variant={activeDeployments.length > 0 ? "info" : "default"}
              className={activeDeployments.length > 0
                ? "rounded-sm border border-info-300 bg-[color-mix(in_srgb,var(--color-info-900)_28%,var(--color-shell-panel))] text-info-100"
                : "rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 text-zinc-300"}
            >
              {activeDeployments.length > 0
                ? `${activeDeployments.length} active`
                : "Idle"}
            </Badge>
          </div>

          <div className="mt-5 space-y-4">
            {deployments.length === 0 ? (
              <div className={`px-5 py-6 ${shellInsetClassName}`}>
                <p className={shellLabelClassName}>Awaiting requests</p>
                <h4 className="mt-3 text-h6 font-display font-bold text-white">
                  No deployment requests yet
                </h4>
                <p className="mt-2 text-body text-zinc-300">
                  Submit your first rollout from the form to see queued, running, and terminal states render here.
                </p>
              </div>
            ) : (
              deployments.map((deployment) => {
                const badge = STATUS_BADGES[deployment.status];

                return (
                  <Panel
                    key={deployment.id}
                    bordered
                    className="space-y-4 rounded-sm border-[var(--color-shell-border-strong)] bg-black/20 text-[var(--color-shell-text-strong)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-shell-border-strong)] pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-body font-semibold text-white">
                            {deployment.request.name}
                          </h4>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <Badge
                            variant="default"
                            className="rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 text-zinc-300"
                          >
                            {deployment.request.environment}
                          </Badge>
                          {deployment.persistence === "memory" && (
                            <Badge variant="warning">Fallback store</Badge>
                          )}
                        </div>
                        <p className="mt-2 text-caption text-zinc-400">
                          {deployment.request.sourceRef} · requested {formatTimestamp(deployment.createdAt)}
                        </p>
                      </div>
                      <div className={`px-3 py-3 text-right text-caption ${shellInsetClassName}`}>
                        <p>Request ID</p>
                        <p className="mt-1 font-mono text-[11px] text-zinc-300">
                          {deployment.orchestration?.requestId ?? "pending"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className={`px-3 py-3 ${shellInsetClassName}`}>
                        <p className={shellLabelClassName}>
                          Dispatch
                        </p>
                        <p className="mt-2 text-caption text-white">
                          {deployment.orchestration?.operationId ? "Scheduled" : "Persisted only"}
                        </p>
                      </div>
                      <div className={`px-3 py-3 ${shellInsetClassName}`}>
                        <p className={shellLabelClassName}>
                          Adapter
                        </p>
                        <p className="mt-2 text-caption text-white">
                          {deployment.orchestration?.adapter ?? "pending"}
                        </p>
                      </div>
                      <div className={`px-3 py-3 ${shellInsetClassName}`}>
                        <p className={shellLabelClassName}>
                          Next poll
                        </p>
                        <p className="mt-2 text-caption text-white">
                          {deployment.status === "queued" || deployment.status === "running"
                            ? `${deployment.orchestration?.pollAfterMs ?? 0} ms`
                            : "settled"}
                        </p>
                      </div>
                    </div>

                    {deployment.request.notes && (
                      <div className={`px-4 py-4 ${shellInsetClassName}`}>
                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Rollout notes
                        </p>
                        <p className="mt-2 text-caption leading-6 text-zinc-300">
                          {deployment.request.notes}
                        </p>
                      </div>
                    )}

                    {deployment.resultUrl && (
                      <div className="rounded-sm border border-success-300 bg-[color-mix(in_srgb,var(--color-success-900)_30%,var(--color-shell-panel))] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-success-200">
                          Result handle
                        </p>
                        <p className="mt-2 break-all font-mono text-caption text-success-50">
                          {deployment.resultUrl}
                        </p>
                      </div>
                    )}

                    {deployment.errorMessage && (
                      <div className="rounded-sm border border-danger-300 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-danger-200">
                          Failure detail
                        </p>
                        <p className="mt-2 text-caption text-danger-50">
                          {deployment.errorMessage}
                        </p>
                      </div>
                    )}
                  </Panel>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
