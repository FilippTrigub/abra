"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Input, Label, Panel, Select, Textarea } from "@/components/ui";
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

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending}>
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
      <Card className="border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-shell-signal)]">
              Deployment request
            </p>
            <h2 className="mt-4 text-h4 font-display font-bold text-white">
              Queue a new rollout
            </h2>
            <p className="mt-3 max-w-2xl text-body leading-7 text-zinc-300">
              Persist the request first, then hand orchestration off to the background adapter. The dashboard keeps polling the mock contract until the rollout settles.
            </p>
          </div>
          <Badge variant="brand">Async dispatch</Badge>
        </div>

        {(persistenceWarning || state.warning) && (
          <Panel bordered muted className="mt-6 border-warning-200 bg-warning-50/60 text-warning-900">
            <p className="text-caption font-semibold uppercase tracking-wide">
              Resiliency mode
            </p>
            <p className="mt-2 text-body text-warning-900">
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
                ? "border-success-200 bg-success-50/70"
                : "border-danger-200 bg-danger-50/70"
            }`}
          >
            <p className="text-body font-medium text-content-100">{state.message}</p>
          </Panel>
        )}

        <form action={formAction} className="mt-8 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deployment-name">Deployment name</Label>
              <Input
                id="deployment-name"
                name="name"
                defaultValue={state.fields.name}
                placeholder="Brand landing page"
                variant={state.fieldErrors.name ? "error" : "default"}
                errorText={state.fieldErrors.name}
              />
            </div>

            <div className="space-y-2">
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deployment-source-ref">Branch / tag / version</Label>
              <Input
                id="deployment-source-ref"
                name="sourceRef"
                defaultValue={state.fields.sourceRef}
                placeholder="main"
                variant={state.fieldErrors.sourceRef ? "error" : "default"}
                errorText={state.fieldErrors.sourceRef}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deployment-mock-outcome">Mock outcome</Label>
              <Select
                id="deployment-mock-outcome"
                name="mockOutcome"
                defaultValue={state.fields.mockOutcome}
                options={[
                  { value: "succeeded", label: "Succeeded" },
                  { value: "failed", label: "Failed" },
                ]}
                variant={state.fieldErrors.mockOutcome ? "error" : "default"}
                errorText={state.fieldErrors.mockOutcome}
              />
            </div>
          </div>

          <div className="space-y-2">
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
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
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
        <Card className="border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Deployment feed
              </p>
              <h3 className="mt-4 text-h5 font-display font-bold text-white">
                Latest request states
              </h3>
            </div>
            <Badge variant={activeDeployments.length > 0 ? "info" : "default"}>
              {activeDeployments.length > 0
                ? `${activeDeployments.length} active`
                : "Idle"}
            </Badge>
          </div>

          <div className="mt-5 space-y-4">
            {deployments.length === 0 ? (
              <EmptyState
                variant="teaser"
                icon="🚀"
                title="No deployment requests yet"
                description="Submit your first rollout from the form to see queued, running, and terminal states render here."
              />
            ) : (
              deployments.map((deployment) => {
                const badge = STATUS_BADGES[deployment.status];

                return (
                  <Panel key={deployment.id} bordered className="space-y-4 border-white/10 bg-black/10 text-[var(--color-shell-text-strong)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-body font-semibold text-white">
                            {deployment.request.name}
                          </h4>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          <Badge variant="default">
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
                      <div className="text-right text-caption text-zinc-500">
                        <p>Request ID</p>
                        <p className="mt-1 font-mono text-[11px] text-zinc-300">
                          {deployment.orchestration?.requestId ?? "pending"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Dispatch
                        </p>
                        <p className="mt-2 text-caption text-white">
                          {deployment.orchestration?.operationId ? "Scheduled" : "Persisted only"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Adapter
                        </p>
                        <p className="mt-2 text-caption text-white">
                          {deployment.orchestration?.adapter ?? "pending"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
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
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          Rollout notes
                        </p>
                        <p className="mt-2 text-caption leading-6 text-zinc-300">
                          {deployment.request.notes}
                        </p>
                      </div>
                    )}

                    {deployment.resultUrl && (
                      <div className="rounded-2xl border border-success-200 bg-success-50/70 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-success-700">
                          Result handle
                        </p>
                        <p className="mt-2 break-all font-mono text-caption text-success-800">
                          {deployment.resultUrl}
                        </p>
                      </div>
                    )}

                    {deployment.errorMessage && (
                      <div className="rounded-2xl border border-danger-200 bg-danger-50/70 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-danger-700">
                          Failure detail
                        </p>
                        <p className="mt-2 text-caption text-danger-800">
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
