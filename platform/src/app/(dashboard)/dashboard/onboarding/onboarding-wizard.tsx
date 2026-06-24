"use client";

import { useActionState, useMemo, useState } from "react";
import type { BrandProfile } from "@/lib/brand-profile/types";
import { completeOnboarding, initialOnboardingFormState } from "./actions";

interface OnboardingWizardProps {
  initialBrandProfile: BrandProfile | null;
  initialTelegramConfigured: boolean;
  initialTelegramHomeChannel: string;
}

interface WizardValues {
  brandName: string;
  audience: string;
  offer: string;
  voice: string;
  differentiators: string;
  sourceNotes: string;
  telegramBotToken: string;
  telegramHomeChannel: string;
  telegramAllowedUsers: string;
  bufferApiKey: string;
}

const stepMeta = [
  {
    label: "Brand brief",
    eyebrow: "01 · Brand profile",
    title: "Give Abra the context it needs to sound like you.",
    summary: "A concise brand profile becomes the runtime BRAND.md that brand-manager reads before content work.",
  },
  {
    label: "Telegram",
    eyebrow: "02 · Runtime access",
    title: "Connect the private room where Abra operates.",
    summary: "Telegram is required before deployment, so the runtime can receive instructions from you safely.",
  },
  {
    label: "Publishing",
    eyebrow: "03 · Publishing rail",
    title: "Add Buffer now, or keep publishing manual for the first run.",
    summary: "Buffer is optional but unlocks scheduled posts once drafts are approved.",
  },
  {
    label: "Review",
    eyebrow: "04 · Ready state",
    title: "Review the setup before Abra prepares your instance.",
    summary: "Everything stays user-scoped: brand context as profile text, secrets through existing encrypted settings.",
  },
] as const;

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  secret = false,
}: {
  id: keyof WizardValues;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  secret?: boolean;
}) {
  const fieldClassName =
    "mt-2 w-full rounded-[1.35rem] bg-[#0d0d0f]/88 px-5 py-4 text-[15px] leading-7 text-white outline-none ring-1 ring-white/10 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] placeholder:text-zinc-600 focus:ring-[var(--color-shell-signal)]/55 motion-reduce:transition-none";

  return (
    <label htmlFor={id} className="block">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
        {label}
      </span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`${fieldClassName} resize-none`}
        />
      ) : (
        <input
          id={id}
          type={secret ? "password" : "text"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={fieldClassName}
        />
      )}
    </label>
  );
}

function MagneticButton({
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
      className={`group inline-flex min-h-12 items-center gap-3 rounded-full px-4 py-2 pl-6 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 motion-reduce:transition-none ${
        primary
          ? "bg-white text-black shadow-[0_20px_80px_rgba(255,255,255,0.14)]"
          : "bg-white/[0.04] text-zinc-200 ring-1 ring-white/10 hover:bg-white/[0.07]"
      }`}
    >
      <span>{children}</span>
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-[1px] group-hover:scale-105 motion-reduce:transition-none ${
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
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [formState, formAction, pending] = useActionState(
    completeOnboarding,
    initialOnboardingFormState,
  );
  const [values, setValues] = useState<WizardValues>({
    brandName: initialBrandProfile?.brandName ?? "",
    audience: initialBrandProfile?.audience ?? "",
    offer: initialBrandProfile?.offer ?? "",
    voice: initialBrandProfile?.voice ?? "Clear, credible, quietly capable.",
    differentiators: initialBrandProfile?.differentiators ?? "",
    sourceNotes: initialBrandProfile?.sourceNotes ?? "",
    telegramBotToken: "",
    telegramHomeChannel: initialTelegramHomeChannel,
    telegramAllowedUsers: initialTelegramHomeChannel,
    bufferApiKey: "",
  });

  const active = stepMeta[step];
  const completion = useMemo(() => Math.round(((step + 1) / stepMeta.length) * 100), [step]);

  function setValue(key: keyof WizardValues, nextValue: string) {
    setValues((previous) => ({ ...previous, [key]: nextValue }));
  }

  const brandReady = values.brandName.trim() && values.audience.trim() && values.offer.trim() && values.voice.trim();
  const telegramReady = initialTelegramConfigured || (values.telegramBotToken.trim() && values.telegramHomeChannel.trim());
  const canAdvance = step === 0 ? Boolean(brandReady) : step === 1 ? Boolean(telegramReady) : true;

  return (
    <section className="relative -mx-4 -my-8 min-h-[100dvh] overflow-hidden bg-[#050505] px-4 py-8 text-white sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
      <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full bg-emerald-400/14 blur-[96px]" />
      <div className="pointer-events-none absolute right-0 top-1/4 h-96 w-96 rounded-full bg-brand-500/16 blur-[112px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/10 blur-[104px]" />

      <form action={formAction} className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl grid-cols-1 items-center gap-8 py-10 md:grid-cols-[0.86fr_1.14fr] md:py-16">
        {Object.entries(values).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        <aside className="space-y-8 md:pr-8">
          <div className="inline-flex rounded-full bg-white/[0.04] p-1.5 ring-1 ring-white/10">
            <div className="rounded-full bg-[#0f1113] px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
              Abra onboarding
            </div>
          </div>
          <div className="space-y-5 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)]">
              {active.eyebrow}
            </p>
            <h1 className="max-w-xl text-[3.35rem] font-display font-bold leading-[0.92] tracking-[-0.065em] text-white sm:text-[4.6rem] md:text-[5.2rem]">
              {active.title}
            </h1>
            <p className="max-w-lg text-[1.05rem] leading-8 text-zinc-300">
              {active.summary}
            </p>
          </div>

          <div className="space-y-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[var(--color-shell-signal)] transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
                style={{ transform: `translateX(-${100 - completion}%)` }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {stepMeta.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                    index <= step ? "text-zinc-100" : "text-zinc-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="rounded-[2.2rem] bg-white/[0.045] p-2 ring-1 ring-white/10 shadow-[0_34px_140px_rgba(0,0,0,0.58)]">
          <div className="min-h-[34rem] rounded-[calc(2.2rem-0.5rem)] bg-[#08090a]/96 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] sm:p-8 md:p-10">
            <div className="flex min-h-[30rem] flex-col justify-between gap-8">
              <div className="transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none">
                {step === 0 && (
                  <div className="grid gap-5">
                    <Field id="brandName" label="Brand or expert name" value={values.brandName} onChange={(value) => setValue("brandName", value)} placeholder="e.g. North Star Advisory" />
                    <Field id="audience" label="Who you serve" value={values.audience} onChange={(value) => setValue("audience", value)} placeholder="Time-poor B2B founders, operators, or expert consultants…" multiline />
                    <Field id="offer" label="What you help them do" value={values.offer} onChange={(value) => setValue("offer", value)} placeholder="Turn messy operating problems into repeatable systems…" multiline />
                    <Field id="voice" label="Voice" value={values.voice} onChange={(value) => setValue("voice", value)} placeholder="Calm, sharp, specific, low-hype…" />
                    <Field id="differentiators" label="What makes you trusted" value={values.differentiators} onChange={(value) => setValue("differentiators", value)} placeholder="Hard-earned operator experience, original frameworks, client proof…" multiline />
                  </div>
                )}

                {step === 1 && (
                  <div className="grid gap-5">
                    {initialTelegramConfigured && (
                      <div className="rounded-[1.5rem] bg-emerald-400/10 p-5 text-sm leading-6 text-emerald-50 ring-1 ring-emerald-300/20">
                        Telegram is already configured. Add replacement values only if you want to rotate the runtime connection.
                      </div>
                    )}
                    <Field id="telegramBotToken" label="Telegram bot token" value={values.telegramBotToken} onChange={(value) => setValue("telegramBotToken", value)} placeholder={initialTelegramConfigured ? "Already saved — leave blank to keep current" : "123456:ABC-DEF…"} secret />
                    <Field id="telegramHomeChannel" label="Home channel or chat ID" value={values.telegramHomeChannel} onChange={(value) => { setValue("telegramHomeChannel", value); if (!values.telegramAllowedUsers) setValue("telegramAllowedUsers", value); }} placeholder="388259993" />
                    <Field id="telegramAllowedUsers" label="Allowed users" value={values.telegramAllowedUsers} onChange={(value) => setValue("telegramAllowedUsers", value)} placeholder="Comma-separated user/chat IDs; defaults to home channel" />
                  </div>
                )}

                {step === 2 && (
                  <div className="grid gap-5">
                    <div className="rounded-[1.5rem] bg-white/[0.035] p-5 text-sm leading-7 text-zinc-300 ring-1 ring-white/10">
                      Buffer lets Abra schedule approved drafts. If you skip this now, drafts still work and you can add the key later in Settings.
                    </div>
                    <Field id="bufferApiKey" label="Buffer API key" value={values.bufferApiKey} onChange={(value) => setValue("bufferApiKey", value)} placeholder="Paste Buffer token" secret />
                  </div>
                )}

                {step === 3 && (
                  <div className="grid gap-4">
                    {[
                      ["Brand", values.brandName || "Missing"],
                      ["Audience", values.audience || "Missing"],
                      ["Telegram", telegramReady ? "Ready for deployment" : "Missing required values"],
                      ["Buffer", values.bufferApiKey ? "Will be saved" : "Skipped for now"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[1.4rem] bg-white/[0.035] p-5 ring-1 ring-white/10">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
                        <p className="mt-2 text-[1rem] leading-7 text-zinc-100">{value}</p>
                      </div>
                    ))}
                    <Field id="sourceNotes" label="Extra brand notes" value={values.sourceNotes} onChange={(value) => setValue("sourceNotes", value)} placeholder="Paste a short bio, positioning note, content preferences, or objections you hear often…" multiline />
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {formState.status === "error" && (
                  <div className="rounded-[1.35rem] bg-red-500/10 p-4 text-sm leading-6 text-red-100 ring-1 ring-red-300/20">
                    {formState.message}
                    {Object.values(formState.fieldErrors).map((error) => error ? (
                      <p key={error} className="mt-2 text-red-100/80">{error}</p>
                    ) : null)}
                  </div>
                )}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <MagneticButton variant="ghost" disabled={step === 0 || pending} onClick={() => setStep((current) => Math.max(0, current - 1))}>
                    Back
                  </MagneticButton>
                  {step < stepMeta.length - 1 ? (
                    <MagneticButton disabled={!canAdvance || pending} onClick={() => setStep((current) => Math.min(stepMeta.length - 1, current + 1))}>
                      Continue
                    </MagneticButton>
                  ) : (
                    <MagneticButton type="submit" disabled={pending || !brandReady || !telegramReady}>
                      {pending ? "Saving" : "Finish setup"}
                    </MagneticButton>
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
