"use client";

import { useState } from "react";
import { Badge, Card } from "@/components/ui";
import { TelegramBotForm, type TelegramBotStatus } from "../telegram-bot-form";

export function BotSetupCard() {
  const [status, setStatus] = useState<TelegramBotStatus>({ loaded: false, configured: false });

  return (
    <Card id="bot-setup">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-shell-border-strong)] pb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-shell-signal)]">
            Agent
          </p>
          <h2 className="mt-3 text-h5 font-display font-bold text-white">Telegram bot</h2>
        </div>
        {status.loaded && (
          <Badge variant={status.configured ? "success" : "warning"}>
            {status.configured ? "Configured" : "Not set"}
          </Badge>
        )}
      </div>

      <TelegramBotForm onStatusChange={setStatus} />
    </Card>
  );
}
