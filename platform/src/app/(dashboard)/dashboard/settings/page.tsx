"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorState, Input, Label, Panel, Select, ToggleSwitch } from "@/components/ui";
import type {
  SettingsResponse,
  ConfigSnapshot,
  SettingDefinition,
  SettingsKey,
  SettingValue,
} from "@/lib/settings/schema";
import {
  loadUserSettings,
  updateUserSetting,
  revertToDefaults,
} from "@/lib/settings/actions";
import {
  getSettingsBySection,
  getSectionOrder,
  getSectionLabel,
  getDefinitionByKey,
} from "@/lib/settings/definitions";

type FieldState = Record<SettingsKey, SettingValue>;
type FieldErrors = Record<SettingsKey, string>;

function initialFieldState(snapshot: ConfigSnapshot | null): FieldState {
  const defaults: FieldState = {
    defaultEnvironment: "preview",
    mockOutcome: "succeeded",
    deploymentAutoPoll: true,
    deploymentPollInterval: 1500,
    notificationsEnabled: true,
    brandAccentColor: "coral",
    dashboardLocale: "en-US",
  };

  if (!snapshot?.values) return defaults;

  const merged = { ...defaults };
  for (const [key, value] of Object.entries(snapshot.values)) {
    const settingsKey = key as SettingsKey;
    if (settingsKey in defaults) {
      merged[settingsKey] = value;
    }
  }
  return merged;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SettingControl({
  definition,
  value,
  onChange,
  errorText,
  disabled,
}: {
  definition: SettingDefinition;
  value: SettingValue;
  onChange: (key: SettingsKey, value: SettingValue) => void;
  errorText?: string;
  disabled: boolean;
}) {
  const id = `setting-${definition.key}`;

  switch (definition.type) {
    case "toggle":
      return (
        <ToggleSwitch
          id={id}
          checked={value as boolean}
          onChange={(e) => onChange(definition.key, e.target.checked)}
          label={definition.label}
          disabled={disabled}
        />
      );

    case "select":
      return (
        <div>
          <Label htmlFor={id} required>
            {definition.label}
          </Label>
          <Select
            id={id}
            value={String(value)}
            onChange={(e) => onChange(definition.key, e.target.value)}
            options={definition.options ?? []}
            disabled={disabled}
            variant={errorText ? "error" : "default"}
            errorText={errorText}
            helperText={definition.description}
          />
        </div>
      );

    case "slider":
      return (
        <div className="space-y-2">
          <Label htmlFor={id} required>
            {definition.label}
          </Label>
          <div className="flex items-center gap-3">
            <input
              id={id}
              type="number"
              min={definition.min}
              max={definition.max}
              step={definition.step}
              value={Number(value)}
              onChange={(e) => onChange(definition.key, Number(e.target.value))}
              disabled={disabled}
              className="w-28 rounded-xl border border-border-default bg-surface-default px-3 py-2 text-body text-content-100 transition-all duration-150 ease-smooth hover:border-border-subtle focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <span className="text-caption text-content-500">ms</span>
          </div>
          {errorText ? (
            <p className="text-caption text-danger-600">{errorText}</p>
          ) : (
            <p className="text-caption text-content-500">{definition.description}</p>
          )}
        </div>
      );

    default:
      return (
        <div className="space-y-2">
          <Label htmlFor={id} required>
            {definition.label}
          </Label>
          <Input
            id={id}
            type="text"
            value={String(value)}
            onChange={(e) => onChange(definition.key, e.target.value)}
            disabled={disabled}
            variant={errorText ? "error" : "default"}
            errorText={errorText}
            helperText={definition.description}
          />
        </div>
      );
  }
}

function RestartBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <Panel bordered muted className="border-warning-200 bg-warning-50/60">
      <div className="flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div>
          <p className="text-body font-semibold text-content-100">
            Restart required
          </p>
          <p className="mt-1 text-caption text-content-600">
            Changing the default deployment environment requires a runtime restart
            to take effect. Deployment requests queued after this change will
            use the new environment.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export default function SettingsPage() {
  const defaultEnvironmentDefinition = getDefinitionByKey("defaultEnvironment");
  const [settingsData, setSettingsData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldState, setFieldState] = useState<FieldState>({} as FieldState);
  const [previousValues, setPreviousValues] = useState<FieldState>({} as FieldState);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(
    {} as FieldErrors,
  );
  const [lastSnapshot, setLastSnapshot] = useState<ConfigSnapshot | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchSettings() {
      try {
        const data = await loadUserSettings();
        if (!cancelled) {
          setSettingsData(data);
          const state = initialFieldState(data.snapshot);
          setFieldState(state);
          setPreviousValues(state);
          setLastSnapshot(data.snapshot);
          setLoading(false);
        }
      } catch (err) {
        console.error("[settings] failed to load:", err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load settings.");
          setLoading(false);
        }
      }
    }

    fetchSettings();
    return () => { cancelled = true; };
  }, []);

  function dirtyCount(): number {
    return Object.keys(fieldState).reduce((count, k) => {
      const key = k as SettingsKey;
      return count + (previousValues[key] !== fieldState[key] ? 1 : 0);
    }, 0);
  }

  function clearAllFieldErrors() {
    setFieldErrors({} as FieldErrors);
  }

  function onChange(key: SettingsKey, value: SettingValue) {
    setFieldState((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    setSaveMessage("");

    const dirtyKeys = (Object.keys(fieldState) as SettingsKey[]).filter(
      (key) => previousValues[key] !== fieldState[key],
    );

    let hadError = false;
    let restartRequiredChanged = false;
    let nextRestartRequired = restartRequired;
    let saveWarning: string | null = null;

    function syncPersistenceState(result: { snapshot: ConfigSnapshot | null; warning: string | null }) {
      setSettingsData((prev) =>
        prev
          ? {
              ...prev,
              persistence: result.snapshot ? "database" : result.warning ? "memory" : prev.persistence,
              warning: result.warning,
            }
          : prev,
      );
    }

    for (const key of dirtyKeys) {
      const current = fieldState[key];
      try {
        const result = await updateUserSetting({ key, value: current });
        if (!result.success) {
          setFieldErrors((prev) => ({
            ...prev,
            [key]: result.errors[0]?.message ?? "Save failed.",
          }));
          hadError = true;
        } else {
          setFieldErrors((prev) => ({ ...prev, [key]: "" }));
          if (result.snapshot) {
            setPreviousValues((prev) => ({ ...prev, [key]: current }));
            setLastSnapshot(result.snapshot);
          }
          syncPersistenceState(result);
          saveWarning = result.warning ?? saveWarning;
          if (key === "defaultEnvironment") {
            const persistedDefaultEnvironment =
              result.snapshot?.values.defaultEnvironment ?? current;
            nextRestartRequired =
              persistedDefaultEnvironment !== defaultEnvironmentDefinition?.defaultValue;
            restartRequiredChanged = true;
          }
        }
      } catch {
        setFieldErrors((prev) => ({
          ...prev,
          [key]: "Network error. Could not save setting.",
        }));
        hadError = true;
      }
    }

    if (hadError) {
      setSaveStatus("error");
      setSaveMessage("Some settings could not be saved.");
    } else {
      setSaveStatus("success");
      setSaveMessage(saveWarning ?? "Settings saved successfully.");
    }
    if (restartRequiredChanged) {
      setRestartRequired(nextRestartRequired);
    }

    setTimeout(() => {
      setSaveStatus("idle");
      setSaveMessage("");
    }, 4000);
  }

  async function handleRevert(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const result = await revertToDefaults();
      if (result.success) {
        const state = initialFieldState(result.snapshot);
        setFieldState(state);
        clearAllFieldErrors();
        if (result.snapshot) {
          setPreviousValues(state);
          setLastSnapshot(result.snapshot);
        }
        setSettingsData((prev) =>
          prev
            ? {
                ...prev,
                persistence: result.snapshot ? "database" : result.warning ? "memory" : prev.persistence,
                warning: result.warning,
              }
            : prev,
        );
        setRestartRequired(result.restartRequired);
        setSaveStatus("success");
        setSaveMessage(result.warning ?? "Defaults restored.");
      } else {
        setSaveStatus("error");
        setSaveMessage(result.errors[0]?.message ?? "Could not restore defaults.");
      }
    } catch {
      setSaveStatus("error");
      setSaveMessage("Network error. Could not restore defaults.");
    }

    setTimeout(() => {
      setSaveStatus("idle");
      setSaveMessage("");
    }, 4000);
  }

  const sections = getSectionOrder();
  const dc = dirtyCount();
  const hasDirtyState = dc > 0;
  const canSave = saveStatus === "idle" && hasDirtyState;

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-h2 font-display font-extrabold text-content-100">
            Settings
          </h1>
          <p className="mt-2 text-body text-content-500">
            Loading configuration…
          </p>
        </div>
        <div className="space-y-6">
          <Card>
            <div className="space-y-4 animate-pulse">
              <div className="h-5 w-48 rounded bg-surface-200" />
              <div className="h-10 w-full rounded-xl bg-surface-200" />
              <div className="h-5 w-40 rounded bg-surface-200" />
              <div className="h-10 w-full rounded-xl bg-surface-200" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-h2 font-display font-extrabold text-content-100">
            Settings
          </h1>
          <p className="mt-2 text-body text-content-500">
            Could not load your configuration.
          </p>
        </div>
        <ErrorState
          title="Failed to load settings"
          description={loadError}
          retryLabel="Retry loading"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-canvas)] text-[var(--color-shell-text-strong)]">
        <div className="grid gap-8 px-8 py-8 md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] md:px-10 md:py-10">
          <div>
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)] sm:text-[13px]">
              Configuration
            </span>
            <h1 className="mt-5 text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white md:text-[3.4rem]">
              Dashboard settings
            </h1>
            <p className="mt-5 max-w-2xl text-[1.05rem] leading-7 text-zinc-300 md:text-[1.15rem]">
              Manage your user-editable configuration. Changes are persisted securely and applied immediately — except where noted.
            </p>
          </div>

          <div className="grid gap-3 self-start border border-white/10 bg-white/[0.03] p-5">
            {lastSnapshot && (
              <div className="border border-white/10 bg-black/10 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  Last updated
                </p>
                <p className="mt-3 text-base font-semibold text-white">
                  {formatTimestamp(lastSnapshot.updatedAt)}
                </p>
              </div>
            )}

            <div className="border border-white/10 bg-black/10 px-4 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Persistence
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {settingsData?.persistence === "memory" && (
                  <Badge variant="warning">In-memory fallback</Badge>
                )}
                {settingsData?.persistence === "database" && (
                  <Badge variant="success">Database</Badge>
                )}
                {!settingsData?.persistence && <Badge variant="default">Unknown</Badge>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Status messages */}
      {saveStatus === "success" && (
        <Panel bordered muted className="border-success-200 bg-success-50/70">
          <p className="text-body font-medium text-content-100">{saveMessage}</p>
        </Panel>
      )}
      {saveStatus === "error" && (
        <Panel bordered muted className="border-danger-200 bg-danger-50/70">
          <p className="text-body font-medium text-content-100">{saveMessage}</p>
        </Panel>
      )}

      <RestartBanner visible={restartRequired} />

      {settingsData?.warning && (
        <Panel bordered muted className="border-warning-200 bg-warning-50/60">
          <p className="text-caption font-semibold uppercase tracking-wide text-warning-700">
            Persistence notice
          </p>
          <p className="mt-2 text-body text-warning-900">
            {settingsData.warning}
          </p>
        </Panel>
      )}

      {/* Settings form */}
      <form onSubmit={handleSave} className="space-y-6">
        {sections.map((section) => {
          const definitions = getSettingsBySection(section);
          if (definitions.length === 0) return null;

          return (
            <Card key={section} className="border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-shell-signal)]">
                    {getSectionLabel(section)}
                  </p>
                  <h2 className="mt-3 text-h5 font-display font-bold text-white">
                    {getSectionLabel(section)} settings
                  </h2>
                </div>
                <Badge variant="secondary">
                  {definitions.length} setting{definitions.length > 1 ? "s" : ""}
                </Badge>
              </div>

              <div className="space-y-6">
                {definitions.map((definition) => {
                  const value = fieldState[definition.key] ?? definition.defaultValue;
                  const error = fieldErrors[definition.key];

                  return (
                    <SettingControl
                      key={definition.key}
                      definition={definition}
                      value={value}
                      onChange={onChange}
                      errorText={error}
                      disabled={saveStatus === "saving"}
                    />
                  );
                })}
              </div>
            </Card>
          );
        })}

        {/* Action bar */}
        <Panel bordered className="border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Pending changes
              </p>
              <p className="mt-2 text-body text-zinc-300">
                {hasDirtyState
                  ? `${dc} setting${dc > 1 ? "s" : ""} unsaved`
                  : settingsData?.warning ?? "All settings saved"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                type="button"
                onClick={handleRevert}
                disabled={saveStatus === "saving"}
                className="border border-white/12 bg-white/[0.03] text-zinc-100 hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
              >
                Reset to defaults
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={!canSave}
              >
                {saveStatus === "saving" ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </Panel>
      </form>

      <div className="section-divider" />
      <div className="flex items-center justify-between text-caption text-content-600">
        <span>Abra · Settings</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
