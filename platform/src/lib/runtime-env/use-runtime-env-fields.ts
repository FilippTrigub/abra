"use client";

import { useEffect, useState } from "react";
import {
  loadRuntimeEnvSummaryAction,
  saveRuntimeEnvFieldsAction,
  type RuntimeEnvDeploymentActionStatus,
} from "./actions";
import type { RuntimeEnvKey } from "./definitions";
import type { RuntimeEnvKeySummary, RuntimeEnvSummary } from "./types";

export type RuntimeEnvFieldsStatus = "idle" | "loading" | "saving" | "success" | "error";
export type RuntimeEnvFieldState = Partial<Record<RuntimeEnvKey, string>>;

/**
 * Shared load/save behavior for the Settings cards that each manage a slice
 * of the runtime-env registry (Publishing, Model provider, Optional
 * integrations). All slices read/write the same underlying account doc, so
 * each card independently loads the full summary but only ever saves the
 * keys it renders.
 */
export function useRuntimeEnvFields() {
  const [summary, setSummary] = useState<RuntimeEnvSummary | null>(null);
  const [fieldValues, setFieldValues] = useState<RuntimeEnvFieldState>({});
  const [status, setStatus] = useState<RuntimeEnvFieldsStatus>("loading");
  const [message, setMessage] = useState("");
  const [deploymentUpdate, setDeploymentUpdate] = useState<RuntimeEnvDeploymentActionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadRuntimeEnvSummaryAction().then((result) => {
      if (cancelled) return;

      if (result.success) {
        setSummary(result.summary);
        setStatus("idle");
      } else {
        setStatus("error");
        setMessage(result.error?.message ?? "Could not load runtime environment values.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const configuredByKey = new Map<RuntimeEnvKey, RuntimeEnvKeySummary>(
    summary?.values.map((entry) => [entry.key, entry]) ?? [],
  );

  async function saveFields(values: RuntimeEnvFieldState) {
    const changed = Object.fromEntries(
      Object.entries(values).filter(([, value]) => (value ?? "").length > 0),
    ) as RuntimeEnvFieldState;
    if (Object.keys(changed).length === 0) return;

    setStatus("saving");
    setMessage("");

    const result = await saveRuntimeEnvFieldsAction({ values: changed });
    if (!result.success) {
      setStatus("error");
      setMessage(result.error?.message ?? result.errors[0] ?? "Could not save runtime environment values.");
      return;
    }

    setFieldValues({});
    setSummary(result.summary);
    setDeploymentUpdate(result.deploymentUpdate);
    setStatus("success");
    setMessage(result.deploymentUpdate?.message ?? "Saved.");
  }

  return {
    summary,
    configuredByKey,
    fieldValues,
    setFieldValues,
    status,
    message,
    deploymentUpdate,
    saveFields,
    busy: status === "loading" || status === "saving",
  };
}
