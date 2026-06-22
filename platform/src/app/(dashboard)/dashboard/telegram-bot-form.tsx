"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Toast } from "@/components/ui";
import { loadUserAgentConfig, saveUserAgentConfig } from "@/lib/agent-config/actions";

export interface TelegramBotStatus {
  loaded: boolean;
  configured: boolean;
}

export interface TelegramBotFormProps {
  onStatusChange?: (status: TelegramBotStatus) => void;
}

interface TelegramBotFormState {
  loaded: boolean;
  configured: boolean;
  token: string;
  homeChannel: string;
  revealed: boolean;
  saveStatus: "idle" | "saving" | "success" | "error";
  saveMessage: string;
}

const INITIAL_STATE: TelegramBotFormState = {
  loaded: false,
  configured: false,
  token: "",
  homeChannel: "",
  revealed: false,
  saveStatus: "idle",
  saveMessage: "",
};

/**
 * Single implementation of the Telegram bot connection form, shared between
 * the dashboard's inline deploy-gating step and the Settings page so there
 * is exactly one place that reads/writes this configuration.
 */
export function TelegramBotForm({ onStatusChange }: TelegramBotFormProps) {
  const router = useRouter();
  const [state, setState] = useState<TelegramBotFormState>(INITIAL_STATE);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    let cancelled = false;
    loadUserAgentConfig().then((result) => {
      if (cancelled) return;
      setState((prev) => ({
        ...prev,
        loaded: true,
        configured: result.configured,
        token: result.token ?? "",
        homeChannel: result.homeChannel ?? "",
      }));
      onStatusChangeRef.current?.({ loaded: true, configured: result.configured });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setState((prev) => ({ ...prev, saveStatus: "saving", saveMessage: "" }));

    const result = await saveUserAgentConfig(state.token, state.homeChannel);
    if (result.success) {
      setState((prev) => ({
        ...prev,
        configured: true,
        saveStatus: "success",
        saveMessage: "Telegram configuration saved.",
      }));
      onStatusChangeRef.current?.({ loaded: true, configured: true });
      // The dashboard hero CTA is decided server-side from hasAgentConfig();
      // refresh so it reflects this save without requiring a full reload.
      router.refresh();
    } else {
      setState((prev) => ({
        ...prev,
        saveStatus: "error",
        saveMessage: result.error ?? "Could not save Telegram config.",
      }));
    }

    setTimeout(() => {
      setState((prev) => ({ ...prev, saveStatus: "idle", saveMessage: "" }));
    }, 4000);
  }

  if (!state.loaded) {
    return <p className="text-body text-zinc-400">Checking Telegram configuration…</p>;
  }

  return (
    <>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <Label htmlFor="telegram-bot-token">Bot token</Label>
          <div className="flex gap-2">
            <Input
              id="telegram-bot-token"
              type={state.revealed ? "text" : "password"}
              value={state.token}
              onChange={(e) => setState((prev) => ({ ...prev, token: e.target.value }))}
              placeholder="123456:ABC-DEF..."
              disabled={state.saveStatus === "saving"}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setState((prev) => ({ ...prev, revealed: !prev.revealed }))}
            >
              {state.revealed ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="mt-1.5 text-caption text-zinc-500">
            From @BotFather. Stored securely and injected at deploy time.
          </p>
        </div>

        <div>
          <Label htmlFor="telegram-home-channel">Telegram channel / chat ID</Label>
          <Input
            id="telegram-home-channel"
            type="text"
            value={state.homeChannel}
            onChange={(e) => setState((prev) => ({ ...prev, homeChannel: e.target.value }))}
            placeholder="388259993"
            disabled={state.saveStatus === "saving"}
            autoComplete="off"
            helperText="Where this Abra instance will operate."
          />
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            type="submit"
            disabled={
              state.saveStatus === "saving" || !state.token.trim() || !state.homeChannel.trim()
            }
          >
            {state.saveStatus === "saving" ? "Saving…" : "Save Telegram config"}
          </Button>
        </div>
      </form>
      <Toast
        tone={state.saveStatus === "error" ? "error" : "success"}
        message={state.saveStatus === "success" || state.saveStatus === "error" ? state.saveMessage : null}
      />
    </>
  );
}
