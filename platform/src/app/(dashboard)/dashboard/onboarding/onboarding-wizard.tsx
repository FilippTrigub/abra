"use client";

import { useActionState, useMemo, useState } from "react";
import type { BrandProfile } from "@/lib/brand-profile/types";
import { completeOnboarding } from "./actions";
import { initialOnboardingFormState } from "./form-state";

interface OnboardingWizardProps {
  initialBrandProfile: BrandProfile | null;
  initialTelegramConfigured: boolean;
  initialTelegramHomeChannel: string;
  initialBufferConfigured: boolean;
}

interface WizardValues {
  brandDescription: string;
  telegramBotToken: string;
  telegramHomeChannel: string;
  telegramAllowedUsers: string;
  bufferApiKey: string;
}

const steps = [
  {
    label: "Brand",
    eyebrow: "01 · Brand context",
    title: "Describe the brand once.",
    summary: "A few clear sentences become the BRAND.md that Abra injects into the runtime.",
  },
  {
    label: "Telegram",
    eyebrow: "02 · Command channel",
    title: "Connect Telegram.",
    summary: "Add the bot token and the chat or channel where this Abra instance should operate.",
  },
  {
    label: "Buffer",
    eyebrow: "03 · Publishing",
    title: "Add Buffer if you want scheduling.",
    summary: "Optional. Skip it now and Abra can still draft; add it later to schedule approved posts.",
  },
] as const;

function SecretField({
  id,
  label,
  value,
  placeholder,
  onChange,
  configured = false,
}: {
  id: keyof WizardValues;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  configured?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const showReveal = value.length > 0;
  return (
    <label htmlFor={id} className="block">
      <span className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          {label}
        </span>
        {configured && !value && (
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-100 ring-1 ring-emerald-300/20">
            Saved
          </span>
        )}
      </span>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="min-h-12 flex-1 rounded-[1.1rem] bg-[#0d0d0f]/90 px-4 text-[14px] text-white outline-none ring-1 ring-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] placeholder:text-zinc-600 focus:ring-[var(--color-shell-signal)]/55 motion-reduce:transition-none"
        />
        {showReveal && (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            className="rounded-full bg-white/[0.05] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300 ring-1 ring-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.08] motion-reduce:transition-none"
          >
            {revealed ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {configured && !value && (
        <p className="mt-2 text-caption leading-6 text-zinc-500">
          Saved secrets cannot be revealed. Leave blank to keep the current value, or type a replacement.
        </p>
      )}
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: keyof WizardValues;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-2 min-h-12 w-full rounded-[1.1rem] bg-[#0d0d0f]/90 px-4 text-[14px] text-white outline-none ring-1 ring-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] placeholder:text-zinc-600 focus:ring-[var(--color-shell-signal)]/55 motion-reduce:transition-none"
      />
    </label>
  );
}

function PillButton({
  children,
  disabled,
  type = "button",
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  variant?: "primary" | "ghost";
}) {
  const primary = variant === "primary";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`group inline-flex min-h-11 items-center gap-3 rounded-full px-4 py-2 pl-5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none ${
        primary ? "bg-white text-black" : "bg-white/[0.04] text-zinc-200 ring-1 ring-white/10 hover:bg-white/[0.07]"
      }`}
    >
      <span>{children}</span>
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 motion-reduce:transition-none ${
          primary ? "bg-black text-white" : "bg-white/10 text-white"
        }`}
        aria-hidden="true"
      >
        →
      </span>
    </button>
  );
}

export function OnboardingWizard({
  initialBrandProfile,
  initialTelegramConfigured,
  initialTelegramHomeChannel,
  initialBufferConfigured,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [formState, formAction, pending] = useActionState(
    completeOnboarding,
    initialOnboardingFormState,
  );
  const [confirmed, setConfirmed] = useState(false);
  const [values, setValues] = useState<WizardValues>({
    brandDescription: initialBrandProfile?.brandDescription ?? "",
    telegramBotToken: "",
    telegramHomeChannel: initialTelegramHomeChannel,
    telegramAllowedUsers: initialTelegramHomeChannel,
    bufferApiKey: "",
  });

  const active = steps[step];
  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  function setValue(key: keyof WizardValues, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  function goToStep(nextStep: number) {
    setConfirmed(false);
    setStep(nextStep);
  }

  const brandReady = values.brandDescription.trim().length >= 24;
  const telegramReady = initialTelegramConfigured || (values.telegramBotToken.trim() && values.telegramHomeChannel.trim());
  const canAdvance = step === 0 ? brandReady : step === 1 ? Boolean(telegramReady) : true;

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-[#050505] px-4 py-4 text-white sm:px-6">
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
      <div className="pointer-events-none absolute -left-28 top-8 h-72 w-72 rounded-full bg-emerald-400/14 blur-[94px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-brand-500/14 blur-[108px]" />

      <form action={formAction} className="relative mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl grid-cols-1 items-center gap-5 md:grid-cols-[0.8fr_1.2fr]">
        {Object.entries(values).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <input type="hidden" name="confirmOnboarding" value={confirmed ? "yes" : "no"} />

        <aside className="space-y-5 md:pr-6">
          <div className="inline-flex rounded-full bg-white/[0.04] p-1.5 ring-1 ring-white/10">
            <div className="rounded-full bg-[#0f1113] px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
              Abra setup
            </div>
          </div>
          <div className="space-y-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)]">
              {active.eyebrow}
            </p>
            <h1 className="max-w-xl text-[3rem] font-display font-bold leading-[0.94] tracking-[-0.06em] text-white sm:text-[4.3rem] md:text-[5rem]">
              {active.title}
            </h1>
            <p className="max-w-lg text-[1rem] leading-7 text-zinc-300">
              {active.summary}
            </p>
          </div>

          <div className="space-y-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[var(--color-shell-signal)] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
                style={{ transform: `translateX(-${100 - progress}%)` }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {steps.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => goToStep(index)}
                  className={`transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${index <= step ? "text-zinc-100" : "text-zinc-600"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="rounded-[2rem] bg-white/[0.045] p-2 ring-1 ring-white/10 shadow-[0_34px_140px_rgba(0,0,0,0.58)]">
          <div className="rounded-[calc(2rem-0.5rem)] bg-[#08090a]/96 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] sm:p-7 md:p-8">
            <div className="flex min-h-[29rem] flex-col justify-between gap-5">
              <div className="transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none">
                {step === 0 && (
                  <label htmlFor="brandDescription" className="block">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                      Brand description
                    </span>
                    <textarea
                      id="brandDescription"
                      value={values.brandDescription}
                      onChange={(event) => setValue("brandDescription", event.target.value)}
                      placeholder="Describe your brand in one short brief: who you are, who you serve, what you help them do, how you sound, and what should never feel generic."
                      rows={11}
                      className="mt-2 min-h-[21rem] w-full resize-none rounded-[1.35rem] bg-[#0d0d0f]/90 px-5 py-4 text-[15px] leading-7 text-white outline-none ring-1 ring-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] placeholder:text-zinc-600 focus:ring-[var(--color-shell-signal)]/55 motion-reduce:transition-none"
                    />
                  </label>
                )}

                {step === 1 && (
                  <div className="grid gap-4">
                    {initialTelegramConfigured && (
                      <div className="rounded-[1.35rem] bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50 ring-1 ring-emerald-300/20">
                        Telegram is already configured. Add replacement values only if you want to rotate the runtime connection.
                      </div>
                    )}
                    <SecretField id="telegramBotToken" label="Telegram bot token" value={values.telegramBotToken} onChange={(value) => setValue("telegramBotToken", value)} placeholder={initialTelegramConfigured ? "Leave blank to keep current" : "123456:ABC-DEF…"} configured={initialTelegramConfigured} />
                    <TextField id="telegramHomeChannel" label="Home channel or chat ID" value={values.telegramHomeChannel} onChange={(value) => { setValue("telegramHomeChannel", value); if (!values.telegramAllowedUsers) setValue("telegramAllowedUsers", value); }} placeholder="388259993" />
                    <TextField id="telegramAllowedUsers" label="Allowed users" value={values.telegramAllowedUsers} onChange={(value) => setValue("telegramAllowedUsers", value)} placeholder="Comma-separated IDs; defaults to home channel" />
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-5">
                    <div className="rounded-[1.35rem] bg-white/[0.035] p-4 text-sm leading-7 text-zinc-300 ring-1 ring-white/10">
                      Buffer is optional. Save it now to schedule approved posts, or leave it blank and add it later in Settings.
                    </div>
                    <SecretField id="bufferApiKey" label="Buffer API key" value={values.bufferApiKey} onChange={(value) => setValue("bufferApiKey", value)} placeholder={initialBufferConfigured ? "Leave blank to keep current" : "Paste Buffer token"} configured={initialBufferConfigured} />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {formState.status === "error" && (
                  <div className="rounded-[1.2rem] bg-red-500/10 p-3 text-sm leading-6 text-red-100 ring-1 ring-red-300/20">
                    {formState.message}
                    {Object.values(formState.fieldErrors).map((error) => error ? (
                      <p key={error} className="mt-1 text-red-100/80">{error}</p>
                    ) : null)}
                  </div>
                )}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <PillButton variant="ghost" disabled={step === 0 || pending} onClick={() => goToStep(Math.max(0, step - 1))}>
                    Back
                  </PillButton>
                  {step < steps.length - 1 ? (
                    <PillButton disabled={!canAdvance || pending} onClick={() => goToStep(Math.min(steps.length - 1, step + 1))}>
                      Continue
                    </PillButton>
                  ) : (
                    <div className="flex flex-col gap-3 sm:items-end">
                      <label className="flex max-w-md items-start gap-3 rounded-[1.1rem] bg-white/[0.035] p-3 text-sm leading-6 text-zinc-300 ring-1 ring-white/10">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(event) => setConfirmed(event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-black accent-[var(--color-shell-signal)]"
                        />
                        <span>
                          Confirm this setup. Saved keys stay hidden; blank secret fields keep the current values.
                        </span>
                      </label>
                      <PillButton type="submit" disabled={pending || !brandReady || !telegramReady || !confirmed}>
                        {pending ? "Saving" : "Confirm setup"}
                      </PillButton>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
