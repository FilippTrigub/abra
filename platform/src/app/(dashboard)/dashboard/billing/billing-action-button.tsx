"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui";
import type { BrowserSafeBillingSummary } from "@/lib/billing/billing-summary";

interface BillingActionButtonProps {
  action: BrowserSafeBillingSummary["action"];
}

export function BillingActionButton({ action }: BillingActionButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage(null);

    try {
      const response = await fetch(action.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.planKey ? { planKey: action.planKey } : {}),
      });
      const payload = await response.json() as { url?: unknown; error?: { message?: string } };

      if (!response.ok || typeof payload.url !== "string") {
        throw new Error(payload.error?.message ?? "Billing action is not available right now.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Billing action is not available right now.");
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <Button type="submit" size="lg" variant={action.kind === "upgrade" ? "primary" : "ghost"} disabled={state === "loading"}>
        {state === "loading" ? "Opening…" : action.label}
      </Button>
      {state === "error" && message && (
        <p className="max-w-md text-caption text-danger-100" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
