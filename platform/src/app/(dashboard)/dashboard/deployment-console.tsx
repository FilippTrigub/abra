"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Panel } from "@/components/ui";
import type { DashboardDeployment } from "@/lib/deployments";
import { deleteAbraInstance, submitDeploymentRequest } from "./actions";
import { initialDeploymentFormState } from "./deployment-form-state";
import { loadUserAgentConfig, saveUserAgentConfig } from "@/lib/agent-config/actions";

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

const shellCardClassName =
  "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none";

const shellInsetClassName =
  "border border-[var(--color-shell-border-strong)] bg-black/20";

const shellLabelClassName =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500";

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

  /* ── Telegram config (self-contained, no settings link) ── */
  const [telegramState, setTelegramState] = useState<{
    loaded: boolean;
    configured: boolean;
    token: string;
    allowedUsers: string;
    saveStatus: "idle" | "saving" | "success" | "error";
    saveMessage: string;
    revealed: boolean;
  }>({
    loaded: false,
    configured: false,
    token: "",
    allowedUsers: "",
    saveStatus: "idle",
    saveMessage: "",
    revealed: false,
  });

  useEffect(() => {
    let cancelled = false;
    loadUserAgentConfig().then((result) => {
      if (cancelled) return;
      setTelegramState((prev) => ({
        ...prev,
        loaded: true,
        configured: result.configured,
        token: result.token ?? "",
        allowedUsers: result.allowedUsers ?? "",
      }));
    });
    return () => { cancelled = true; };
  }, []);

  async function handleTelegramSave(e: React.FormEvent) {
    e.preventDefault();
    setTelegramState((prev) => ({ ...prev, saveStatus: "saving", saveMessage: "" }));

    const result = await saveUserAgentConfig(telegramState.token, telegramState.allowedUsers);
    if (result.success) {
      setTelegramState((prev) => ({
        ...prev,
        configured: true,
        saveStatus: "success",
        saveMessage: "Telegram configuration saved.",
      }));
    } else {
      setTelegramState((prev) => ({
        ...prev,
        saveStatus: "error",
        saveMessage: result.error ?? "Could not save Telegram config.",
      }));
    }

    setTimeout(() => {
      setTelegramState((prev) => ({ ...prev, saveStatus: "idle", saveMessage: "" }));
    }, 4000);
  }

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

  const shouldShowDeployForm = canDeploy(deployment);

  return (
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
            telegramState.loaded && telegramState.configured ? (
              <form action={deployAction} className="mt-8">
                <div className={`flex flex-wrap items-center justify-between gap-4 px-4 py-4 ${shellInsetClassName}`}>
                  <div>
                    <p className={shellLabelClassName}>Deployment contract</p>
                    <p className="mt-1 text-body text-zinc-300">
                      One click creates the single Abra instance for this account.
                    </p>
                  </div>
                  <SubmitButton pending={deployPending} />
                </div>
              </form>
            ) : telegramState.loaded ? (
              <form onSubmit={handleTelegramSave} className="mt-8 space-y-4">
                <div className={`rounded-sm px-4 py-4 ${shellInsetClassName}`}>
                  <p className={shellLabelClassName}>botToken</p>
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type={telegramState.revealed ? "text" : "password"}
                        value={telegramState.token}
                        onChange={(e) =>
                          setTelegramState((prev) => ({ ...prev, token: e.target.value }))
                        }
                        placeholder="123456:ABC-DEF..."
                        disabled={telegramState.saveStatus === "saving"}
                        className="w-full rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-3 py-2 text-body text-white transition-all duration-150 ease-smooth placeholder:text-zinc-500 hover:border-white/20 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setTelegramState((prev) => ({ ...prev, revealed: !prev.revealed }))
                        }
                        className="shrink-0 rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 hover:border-white/20 hover:text-white"
                      >
                        {telegramState.revealed ? "Hide" : "Show"}
                      </button>
                    </div>
                    <p className="text-caption text-zinc-500">
                      Enter the token from @BotFather. Stored securely and injected at deploy time.
                    </p>
                  </div>
                </div>

                <div className={`rounded-sm px-4 py-4 ${shellInsetClassName}`}>
                  <p className={shellLabelClassName}>TELEGRAM_ALLOWED_USERS</p>
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      value={telegramState.allowedUsers}
                      onChange={(e) =>
                        setTelegramState((prev) => ({ ...prev, allowedUsers: e.target.value }))
                      }
                      placeholder="123456789"
                      disabled={telegramState.saveStatus === "saving"}
                      className="w-full rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-3 py-2 text-body text-white transition-all duration-150 ease-smooth placeholder:text-zinc-500 hover:border-white/20 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      autoComplete="off"
                    />
                    <p className="text-caption text-zinc-500">
                      Enter the Telegram user id or allowlist that may talk to this runtime.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    {telegramState.saveStatus === "success" && (
                      <p className="text-caption text-success-400">{telegramState.saveMessage}</p>
                    )}
                    {telegramState.saveStatus === "error" && (
                      <p className="text-caption text-danger-400">{telegramState.saveMessage}</p>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={
                      telegramState.saveStatus === "saving" ||
                      !telegramState.token.trim() ||
                      !telegramState.allowedUsers.trim()
                    }
                    className="rounded-sm shadow-none"
                  >
                    {telegramState.saveStatus === "saving" ? "Saving…" : "Save Telegram config"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className={`mt-8 px-4 py-4 ${shellInsetClassName}`}>
                <p className="text-body text-zinc-400">Checking Telegram configuration…</p>
              </div>
            )
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
  );
}
