"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Panel } from "@/components/ui";
import { loadUserAgentConfig, saveUserAgentConfig } from "@/lib/agent-config/actions";

const shellCardClassName =
  "border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-panel)] text-[var(--color-shell-text-strong)] shadow-none";

const shellInsetClassName =
  "border border-[var(--color-shell-border-strong)] bg-black/20";

const shellLabelClassName =
  "font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500";

export function BotSetupCard() {
  const [configured, setConfigured] = useState(false);
  const [token, setToken] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadUserAgentConfig().then((result) => {
      if (cancelled) return;
      setConfigured(result.configured);
      setToken(result.token ?? "");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    setSaveMessage("");

    const result = await saveUserAgentConfig(token);
    if (result.success) {
      setConfigured(true);
      setSaveStatus("success");
      setSaveMessage("Bot token saved.");
    } else {
      setSaveStatus("error");
      setSaveMessage(result.error ?? "Could not save token.");
    }

    setTimeout(() => {
      setSaveStatus("idle");
      setSaveMessage("");
    }, 4000);
  }

  const inputClassName =
    "w-full rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-3 py-2 text-body text-white transition-all duration-150 ease-smooth placeholder:text-zinc-500 hover:border-white/20 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200";

  return (
    <Card className={shellCardClassName} id="bot-setup">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-shell-border-strong)] pb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-shell-signal)]">
            Agent
          </p>
          <h2 className="mt-3 text-h5 font-display font-bold text-white">
            Telegram bot
          </h2>
        </div>
        {!loading && (
          configured
            ? <Badge variant="success">Configured</Badge>
            : <Badge variant="warning">Not set</Badge>
        )}
      </div>

      {saveStatus === "success" && (
        <Panel
          bordered
          muted
          className="mb-6 border-success-300 bg-[color-mix(in_srgb,var(--color-success-900)_30%,var(--color-shell-panel))]"
        >
          <p className="text-body font-medium text-success-50">{saveMessage}</p>
        </Panel>
      )}
      {saveStatus === "error" && (
        <Panel
          bordered
          muted
          className="mb-6 border-danger-300 bg-[color-mix(in_srgb,var(--color-danger-900)_28%,var(--color-shell-panel))]"
        >
          <p className="text-body font-medium text-danger-50">{saveMessage}</p>
        </Panel>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className={`rounded-sm px-4 py-4 ${shellInsetClassName}`}>
          <p className={shellLabelClassName}>botToken</p>
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                type={revealed ? "text" : "password"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456:ABC-DEF..."
                disabled={loading || saveStatus === "saving"}
                className={inputClassName}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="shrink-0 rounded-sm border border-[var(--color-shell-border-strong)] bg-black/20 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 hover:border-white/20 hover:text-white"
              >
                {revealed ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-caption text-zinc-500">
              Enter the token from @BotFather. Stored securely and injected at deploy time.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            type="submit"
            disabled={saveStatus === "saving" || loading || !token.trim()}
            className="rounded-sm shadow-none"
          >
            {saveStatus === "saving" ? "Saving…" : "Save token"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
