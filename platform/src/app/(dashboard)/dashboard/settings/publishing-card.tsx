"use client";

import { useState } from "react";
import { Badge, Button, Card, Input, Label, Panel } from "@/components/ui";
import { getRuntimeEnvDefinition } from "@/lib/runtime-env/definitions";
import { useRuntimeEnvFields } from "@/lib/runtime-env/use-runtime-env-fields";

const BUFFER_KEY = "BUFFER_API_KEY" as const;

export function PublishingCard() {
  const definition = getRuntimeEnvDefinition(BUFFER_KEY);
  const { summary, configuredByKey, fieldValues, setFieldValues, status, message, saveFields, busy } =
    useRuntimeEnvFields();
  const [revealed, setRevealed] = useState(false);

  if (!definition) return null;

  const configured = configuredByKey.get(BUFFER_KEY);
  const hasValue = (fieldValues[BUFFER_KEY] ?? "").length > 0;

  return (
    <Card id="publishing">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-shell-border-strong)] pb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-shell-signal)]">
            Publishing
          </p>
          <h2 className="mt-3 text-h5 font-display font-bold text-white">Buffer</h2>
        </div>
        {summary && (
          <Badge variant={configured?.configured ? "success" : "warning"}>
            {configured?.configured ? "Configured" : "Not set"}
          </Badge>
        )}
      </div>

      <p className="mb-5 max-w-2xl text-body leading-7 text-zinc-300">
        Buffer turns an approved draft into a scheduled post. Without it, Abra can still draft and
        review content with you, but can&apos;t publish it. This is not required to deploy.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void saveFields({ [BUFFER_KEY]: fieldValues[BUFFER_KEY] ?? "" });
        }}
        className="space-y-4"
      >
        {message && status !== "idle" && status !== "loading" && (
          <Panel
            bordered
            muted
            className={
              status === "error"
                ? "border-danger-300 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))]"
                : "border-success-300 bg-[color-mix(in_srgb,var(--color-success-900)_30%,var(--color-shell-panel))]"
            }
          >
            <p
              className={
                status === "error" ? "text-body font-medium text-danger-50" : "text-body font-medium text-success-50"
              }
            >
              {message}
            </p>
          </Panel>
        )}

        <div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="publishing-buffer-key" className="mb-0">
              {definition.label}
            </Label>
            {configured?.configured && !hasValue && (
              <Badge variant="success" className="px-2 py-0.5 text-[10px]">
                Saved
              </Badge>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              id="publishing-buffer-key"
              type={hasValue && revealed ? "text" : "password"}
              value={fieldValues[BUFFER_KEY] ?? ""}
              onChange={(event) =>
                setFieldValues((prev) => ({ ...prev, [BUFFER_KEY]: event.target.value }))
              }
              placeholder={configured?.configured ? "Enter replacement value" : "Enter value"}
              disabled={busy}
              autoComplete="off"
            />
            {hasValue && (
              <Button type="button" variant="ghost" onClick={() => setRevealed((prev) => !prev)} disabled={busy}>
                {revealed ? "Hide" : "Show"}
              </Button>
            )}
          </div>
          <p className="mt-2 text-caption text-zinc-500">
            {configured?.configured && !hasValue
              ? "Saved secrets cannot be revealed. Leave blank to keep the current key, or enter a replacement value."
              : definition.description}
          </p>
        </div>

        <div className="flex items-center justify-end">
          <Button variant="primary" type="submit" disabled={busy || !hasValue}>
            {status === "saving" ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
