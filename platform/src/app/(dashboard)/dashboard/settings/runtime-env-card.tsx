"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input, Label, Panel, Textarea } from "@/components/ui";
import {
  applyRuntimeEnvAction,
  loadRuntimeEnvSummaryAction,
  previewRuntimeEnvDotenvImport,
  saveRuntimeEnvFieldsAction,
  saveRuntimeEnvImportAction,
  type RuntimeEnvDeploymentActionStatus,
  type RuntimeEnvDotenvAcceptedPreview,
  type RuntimeEnvDotenvPreviewResult,
} from "@/lib/runtime-env/actions";
import {
  getRuntimeEnvGroupLabel,
  getRuntimeEnvGroupOrder,
  SUPPORTED_RUNTIME_ENV_DEFINITIONS,
  type RuntimeEnvDefinition,
  type RuntimeEnvGroup,
  type RuntimeEnvKey,
} from "@/lib/runtime-env/definitions";
import type { RuntimeEnvKeySummary, RuntimeEnvSummary } from "@/lib/runtime-env/types";

type RuntimeEnvMode = "fields" | "import";
type RuntimeEnvSaveStatus = "idle" | "loading" | "saving" | "applying" | "success" | "error";
type RuntimeEnvDeployStatus = "saved" | "applying" | "live" | "saved-not-deployed";
type RuntimeEnvFieldState = Partial<Record<RuntimeEnvKey, string>>;

const shellCardClassName =
  "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none";

const shellInsetClassName =
  "border border-[var(--color-shell-border-strong)] bg-black/20";

const shellLabelClassName =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500";

const inputClassName =
  "w-full rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-3 py-2 text-body text-white transition-all duration-150 ease-smooth placeholder:text-zinc-500 hover:border-white/20 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200";

const modeButtonClassName =
  "rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 shadow-none hover:border-white/20 hover:bg-white/[0.06] hover:text-white";

const sourceLabels: Record<RuntimeEnvKeySummary["source"], string> = {
  manual: "Manual entry",
  import: ".env import",
  delete: "Removed",
  rollback: "Rollback",
};

const deployStatusLabels: Record<RuntimeEnvDeployStatus, string> = {
  saved: "Saved",
  applying: "Applying to Abra",
  live: "Live on runtime",
  "saved-not-deployed": "Saved but not deployed",
};

const deployStatusVariants: Record<RuntimeEnvDeployStatus, "default" | "info" | "success" | "warning"> = {
  saved: "success",
  applying: "info",
  live: "success",
  "saved-not-deployed": "warning",
};

function formatTimestamp(value: string | null) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFingerprint(value: string) {
  const [, digest = value] = value.split(":");
  return `•••• ${digest.slice(-8)}`;
}

function groupDefinitions() {
  const supported = new Map<RuntimeEnvGroup, RuntimeEnvDefinition[]>();
  for (const group of getRuntimeEnvGroupOrder()) {
    if (group !== "reserved") {
      supported.set(group, []);
    }
  }

  for (const definition of SUPPORTED_RUNTIME_ENV_DEFINITIONS) {
    const group = supported.get(definition.group);
    if (group) {
      group.push(definition);
    }
  }

  return Array.from(supported.entries()).filter(([, definitions]) => definitions.length > 0);
}

function summaryByKey(summary: RuntimeEnvSummary | null) {
  return new Map<RuntimeEnvKey, RuntimeEnvKeySummary>(
    summary?.values.map((entry) => [entry.key, entry]) ?? [],
  );
}

function mapDeploymentUpdateStatus(update: RuntimeEnvDeploymentActionStatus | null): RuntimeEnvDeployStatus {
  if (!update) return "saved";
  const { status } = update;
  if (status === "live") return "live";
  if (status === "applying") return "applying";

  return "saved-not-deployed";
}

function PreviewIssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: RuntimeEnvDotenvPreviewResult["rejected"];
  tone: "warning" | "danger";
}) {
  if (issues.length === 0) return null;

  return (
    <div className={`rounded-sm px-4 py-4 ${shellInsetClassName}`}>
      <p className={shellLabelClassName}>{title}</p>
      <ul className="mt-3 space-y-2 text-caption text-zinc-300">
        {issues.map((issue) => (
          <li key={`${issue.code}-${issue.lineNumber}-${issue.key ?? "line"}`} className="flex gap-2">
            <Badge variant={tone} className="shrink-0 rounded-sm font-mono text-[10px] uppercase tracking-[0.12em]">
              line {issue.lineNumber}
            </Badge>
            <span>
              {issue.key ? `${issue.key}: ` : ""}{issue.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AcceptedPreviewList({ accepted }: { accepted: RuntimeEnvDotenvAcceptedPreview[] }) {
  if (accepted.length === 0) return null;

  return (
    <div className={`rounded-sm px-4 py-4 ${shellInsetClassName}`}>
      <p className={shellLabelClassName}>Accepted keys</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {accepted.map((entry) => (
          <div key={`${entry.key}-${entry.lineNumber}`} className="rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" className="rounded-sm font-mono text-[10px] uppercase tracking-[0.12em]">
                line {entry.lineNumber}
              </Badge>
              <span className="text-caption text-zinc-400">{getRuntimeEnvGroupLabel(entry.group)}</span>
            </div>
            <p className="mt-2 text-body font-semibold text-white">{entry.label}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">{entry.key}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RuntimeEnvCard() {
  const groupedDefinitions = useMemo(() => groupDefinitions(), []);
  const [mode, setMode] = useState<RuntimeEnvMode>("fields");
  const [summary, setSummary] = useState<RuntimeEnvSummary | null>(null);
  const [fieldValues, setFieldValues] = useState<RuntimeEnvFieldState>({});
  const [dotenvContent, setDotenvContent] = useState("");
  const [preview, setPreview] = useState<RuntimeEnvDotenvPreviewResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<RuntimeEnvSaveStatus>("loading");
  const [deployStatus, setDeployStatus] = useState<RuntimeEnvDeployStatus>("saved");
  const [message, setMessage] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Partial<Record<RuntimeEnvKey, boolean>>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      const result = await loadRuntimeEnvSummaryAction();
      if (cancelled) return;

      if (result.success) {
        setSummary(result.summary);
        setSaveStatus("idle");
      } else {
        setSaveStatus("error");
        setMessage(result.error?.message ?? "Could not load runtime environment values.");
      }
    }

    loadSummary();
    return () => { cancelled = true; };
  }, []);

  const configuredByKey = useMemo(() => summaryByKey(summary), [summary]);
  const configuredCount = summary?.values.filter((entry) => entry.configured).length ?? 0;
  const changedFieldValues = Object.fromEntries(
    Object.entries(fieldValues).filter(([, value]) => value.length > 0),
  ) as Partial<Record<RuntimeEnvKey, string>>;
  const changedFieldCount = Object.keys(changedFieldValues).length;
  const busy = saveStatus === "loading" || saveStatus === "saving" || saveStatus === "applying";

  function showSavedDeploymentStatus(
    nextSummary: RuntimeEnvSummary | null,
    deploymentUpdate: RuntimeEnvDeploymentActionStatus | null,
  ) {
    setSummary(nextSummary);
    const nextDeployStatus = mapDeploymentUpdateStatus(deploymentUpdate);
    setDeployStatus(nextDeployStatus);
    setSaveStatus("success");
    setMessage(deployStatusLabels[nextDeployStatus]);
  }

  async function handleApplyNow() {
    setSaveStatus("applying");
    setMessage("");

    const result = await applyRuntimeEnvAction();
    if (!result.success) {
      setSaveStatus("error");
      setMessage(result.error?.message ?? "Could not apply runtime environment values.");
      return;
    }

    setSummary(result.summary);
    setDeployStatus(mapDeploymentUpdateStatus({
      applied: result.applied,
      status: result.status,
      message: result.message,
      reason: null,
      warning: null,
    }));
    setSaveStatus("success");
    setMessage(result.message);
  }

  async function handleFieldSave(e: React.FormEvent) {
    e.preventDefault();
    if (changedFieldCount === 0) return;

    setSaveStatus("saving");
    setMessage("");

    const result = await saveRuntimeEnvFieldsAction({ values: changedFieldValues });
    if (!result.success) {
      setSaveStatus("error");
      setMessage(result.error?.message ?? result.errors[0] ?? "Could not save runtime environment values.");
      return;
    }

    setFieldValues({});
    showSavedDeploymentStatus(result.summary, result.deploymentUpdate);
  }

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    setMessage("");

    const result = await previewRuntimeEnvDotenvImport(dotenvContent);
    setPreview(result);
    setSaveStatus(result.error ? "error" : "idle");
    setMessage(result.error?.message ?? "");
  }

  async function handleImportSave() {
    if (!preview || preview.accepted.length === 0) return;

    setSaveStatus("saving");
    setMessage("");

    const result = await saveRuntimeEnvImportAction(dotenvContent);
    setPreview({
      success: result.success,
      accepted: result.accepted,
      rejected: result.rejected,
      warnings: result.warnings,
      error: result.error,
    });

    if (!result.success) {
      setSaveStatus("error");
      setMessage(result.error?.message ?? result.errors[0] ?? "Could not import runtime environment values.");
      return;
    }

    setDotenvContent("");
    showSavedDeploymentStatus(result.summary, result.deploymentUpdate);
  }

  return (
    <Card className={shellCardClassName} id="runtime-env">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-shell-border-strong)] pb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-shell-signal)]">
            Runtime
          </p>
          <h2 className="mt-3 text-h5 font-display font-bold text-white">
            Runtime environment
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={deployStatusVariants[deployStatus]}>{deployStatusLabels[deployStatus]}</Badge>
          <Badge variant={configuredCount > 0 ? "success" : "warning"}>
            {configuredCount > 0 ? `${configuredCount} saved` : "No saved values"}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            onClick={handleApplyNow}
            disabled={busy || configuredCount === 0}
            className={modeButtonClassName}
          >
            {saveStatus === "applying" ? "Applying…" : "Apply now"}
          </Button>
        </div>
      </div>

      {message && saveStatus !== "idle" && (
        <Panel
          bordered
          muted
          className={saveStatus === "error"
            ? "mb-6 border-danger-300 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))]"
            : "mb-6 border-success-300 bg-[color-mix(in_srgb,var(--color-success-900)_30%,var(--color-shell-panel))]"}
        >
          <p className={saveStatus === "error" ? "text-body font-medium text-danger-50" : "text-body font-medium text-success-50"}>
            {message}
          </p>
        </Panel>
      )}

      <div className={`mb-6 grid gap-3 px-4 py-4 md:grid-cols-3 ${shellInsetClassName}`}>
        <div>
          <p className={shellLabelClassName}>Status</p>
          <p className="mt-3 text-body font-semibold text-white">{deployStatusLabels[deployStatus]}</p>
        </div>
        <div>
          <p className={shellLabelClassName}>Last saved</p>
          <p className="mt-3 text-body font-semibold text-white">{formatTimestamp(summary?.updatedAt ?? null)}</p>
        </div>
        <div>
          <p className={shellLabelClassName}>Version</p>
          <p className="mt-3 truncate font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400">
            {summary?.versionId ?? "No version yet"}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMode("fields")}
          className={`${modeButtonClassName} ${mode === "fields" ? "border-brand-300 text-white" : ""}`}
        >
          Field entry
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setMode("import")}
          className={`${modeButtonClassName} ${mode === "import" ? "border-brand-300 text-white" : ""}`}
        >
          .env import
        </Button>
      </div>

      {mode === "fields" ? (
        <form onSubmit={handleFieldSave} className="space-y-5">
          {groupedDefinitions.map(([group, definitions]) => (
            <div key={group} className={`rounded-sm px-4 py-4 ${shellInsetClassName}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className={shellLabelClassName}>{getRuntimeEnvGroupLabel(group)}</p>
                  <p className="mt-2 text-caption text-zinc-500">
                    {definitions.length} supported key{definitions.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {definitions.map((definition) => {
                  const key = definition.key as RuntimeEnvKey;
                  const configured = configuredByKey.get(key);
                  const inputId = `runtime-env-${key}`;
                  const revealed = Boolean(revealedKeys[key]);

                  return (
                    <div key={key} className="rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Label htmlFor={inputId} className="mb-0 text-white">
                            {definition.label}
                          </Label>
                          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">{key}</p>
                        </div>
                        {configured?.configured ? (
                          <Badge variant="success">Saved</Badge>
                        ) : (
                          <Badge variant="warning">Not set</Badge>
                        )}
                      </div>

                      {configured?.configured && (
                        <div className="mt-3 grid gap-2 text-caption text-zinc-400 md:grid-cols-3">
                          <span>Stored: {formatFingerprint(configured.fingerprint)}</span>
                          <span>Source: {sourceLabels[configured.source]}</span>
                          <span>Updated: {formatTimestamp(configured.updatedAt)}</span>
                        </div>
                      )}

                      <div className="mt-4 flex gap-2">
                        <Input
                          id={inputId}
                          type={definition.secret && !revealed ? "password" : "text"}
                          value={fieldValues[key] ?? ""}
                          onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={configured?.configured ? "Enter replacement value" : "Enter value"}
                          disabled={busy}
                          className={inputClassName}
                          autoComplete="off"
                        />
                        {definition.secret && (
                          <button
                            type="button"
                            onClick={() => setRevealedKeys((prev) => ({ ...prev, [key]: !prev[key] }))}
                            className="shrink-0 rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 hover:border-white/20 hover:text-white"
                            aria-label={`${revealed ? "Hide" : "Show"} ${definition.label}`}
                            disabled={busy}
                          >
                            {revealed ? "Hide" : "Show"}
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-caption text-zinc-500">{definition.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-caption text-zinc-500">
              {changedFieldCount > 0
                ? `${changedFieldCount} changed value${changedFieldCount > 1 ? "s" : ""} ready to save.`
                : "Enter a value only for keys you want to add or replace."}
            </p>
            <Button
              variant="primary"
              type="submit"
              disabled={busy || changedFieldCount === 0}
              className="rounded-sm shadow-none"
            >
              {saveStatus === "saving" || saveStatus === "applying" ? "Saving…" : "Save runtime values"}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handlePreview} className="space-y-5">
          <div className={`rounded-sm px-4 py-4 ${shellInsetClassName}`}>
            <Label htmlFor="runtime-env-dotenv" className="text-white">
              Paste .env content
            </Label>
            <Textarea
              id="runtime-env-dotenv"
              value={dotenvContent}
              onChange={(e) => {
                setDotenvContent(e.target.value);
                setPreview(null);
              }}
              placeholder="BUFFER_API_KEY=..."
              disabled={busy}
              rows={8}
              className="rounded-sm border-[var(--color-shell-border-strong)] bg-black/20 font-mono text-[12px] leading-6 text-white placeholder:text-zinc-500 hover:border-white/20 focus:border-brand-300"
              autoComplete="off"
            />
            <p className="mt-2 text-caption text-zinc-500">
              Preview checks supported keys and never displays imported values back to you.
            </p>
          </div>

          {preview && (
            <div className="space-y-3">
              <AcceptedPreviewList accepted={preview.accepted} />
              <PreviewIssueList title="Warnings" issues={preview.warnings} tone="warning" />
              <PreviewIssueList title="Rejected keys" issues={preview.rejected} tone="danger" />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-caption text-zinc-500">
              {preview
                ? `${preview.accepted.length} accepted, ${preview.rejected.length} rejected, ${preview.warnings.length} warning${preview.warnings.length === 1 ? "" : "s"}.`
                : "Preview before importing so only supported runtime keys are saved."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                type="submit"
                disabled={busy || dotenvContent.trim().length === 0}
                className={modeButtonClassName}
              >
                Preview import
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={handleImportSave}
                disabled={busy || !preview || preview.accepted.length === 0}
                className="rounded-sm shadow-none"
              >
                {saveStatus === "saving" || saveStatus === "applying" ? "Saving…" : "Confirm import"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Card>
  );
}
