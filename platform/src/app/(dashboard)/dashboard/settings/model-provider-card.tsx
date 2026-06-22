"use client";

import { useState } from "react";
import { Badge, Button, Card, Disclosure, Input, Label, Panel } from "@/components/ui";
import { getRuntimeEnvDefinitionsByGroup, type RuntimeEnvKey } from "@/lib/runtime-env/definitions";
import { useRuntimeEnvFields } from "@/lib/runtime-env/use-runtime-env-fields";

const LLM_GROUP_DEFINITIONS = getRuntimeEnvDefinitionsByGroup("llm");

interface ModelProviderCardProps {
  platformDefaultConfigured: boolean;
}

export function ModelProviderCard({ platformDefaultConfigured }: ModelProviderCardProps) {
  const { summary, configuredByKey, fieldValues, setFieldValues, status, message, saveFields, busy } =
    useRuntimeEnvFields();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Partial<Record<RuntimeEnvKey, boolean>>>({});

  const hasOwnKey = LLM_GROUP_DEFINITIONS.some(
    (definition) => configuredByKey.get(definition.key as RuntimeEnvKey)?.configured,
  );
  const changedFieldCount = Object.values(fieldValues).filter((value) => (value ?? "").length > 0).length;

  const badgeVariant = hasOwnKey || platformDefaultConfigured ? "success" : "danger";
  const badgeLabel = hasOwnKey
    ? "Using your key"
    : platformDefaultConfigured
      ? "Using platform default"
      : "No default configured";

  return (
    <Card id="model-provider">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-shell-border-strong)] pb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-shell-signal)]">
            Model provider
          </p>
          <h2 className="mt-3 text-h5 font-display font-bold text-white">Azure Foundry (default)</h2>
        </div>
        {summary && <Badge variant={badgeVariant}>{badgeLabel}</Badge>}
      </div>

      <p className="mb-5 max-w-2xl text-body leading-7 text-zinc-300">
        {hasOwnKey
          ? "Abra is using the model key you saved below instead of the platform default."
          : platformDefaultConfigured
            ? "Abra already has a working model connection through the platform's shared credential. You don't need to set anything here."
            : "The platform's shared model credential isn't configured right now. Abra won't be able to generate drafts until a model key is set, either below or by the platform operator."}
      </p>

      <Disclosure
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        summary={<span className="text-body font-semibold text-white">Use your own key instead</span>}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveFields(fieldValues);
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
                  status === "error"
                    ? "text-body font-medium text-danger-50"
                    : "text-body font-medium text-success-50"
                }
              >
                {message}
              </p>
            </Panel>
          )}

          {LLM_GROUP_DEFINITIONS.map((definition) => {
            const key = definition.key as RuntimeEnvKey;
            const configured = configuredByKey.get(key);
            const inputId = `model-provider-${key}`;
            const revealed = Boolean(revealedKeys[key]);

            return (
              <div key={key}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor={inputId} className="mb-0">
                    {definition.label}
                  </Label>
                  {configured?.configured && <Badge variant="success">Saved</Badge>}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    id={inputId}
                    type={revealed ? "text" : "password"}
                    value={fieldValues[key] ?? ""}
                    onChange={(event) =>
                      setFieldValues((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                    placeholder={configured?.configured ? "Enter replacement value" : "Enter value"}
                    disabled={busy}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRevealedKeys((prev) => ({ ...prev, [key]: !prev[key] }))}
                    disabled={busy}
                  >
                    {revealed ? "Hide" : "Show"}
                  </Button>
                </div>
                <p className="mt-2 text-caption text-zinc-500">{definition.description}</p>
              </div>
            );
          })}

          <div className="flex items-center justify-end">
            <Button variant="primary" type="submit" disabled={busy || changedFieldCount === 0}>
              {status === "saving" ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Disclosure>
    </Card>
  );
}
