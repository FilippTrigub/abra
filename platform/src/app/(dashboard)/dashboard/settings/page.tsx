import dynamic from "next/dynamic";
import { hasPlatformAzureFoundryDefault } from "@/lib/runtime-env/platform-defaults";
import { BotSetupCard } from "./bot-setup-card";
import { PublishingCard } from "./publishing-card";
import { ModelProviderCard } from "./model-provider-card";

const OptionalIntegrationsCard = dynamic(
  () => import("./optional-integrations-card").then((mod) => mod.OptionalIntegrationsCard),
  { loading: () => <p className="text-body text-zinc-400">Loading skill integrations…</p> },
);

export default function SettingsPage() {
  const platformDefaultConfigured = hasPlatformAzureFoundryDefault();

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-sm border border-[var(--color-shell-border-strong)] bg-[var(--color-shell-canvas)] text-[var(--color-shell-text-strong)]">
        <div className="px-8 py-8 md:px-10 md:py-10">
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-[var(--color-shell-signal)] sm:text-[13px]">
            Configuration
          </span>
          <h1 className="mt-5 text-[2.75rem] leading-[1.02] font-display font-bold tracking-[-0.04em] text-white md:text-[3.4rem]">
            Settings
          </h1>
          <p className="mt-5 max-w-2xl text-[1.05rem] leading-7 text-zinc-300 md:text-[1.15rem]">
            Required to deploy, what already works out of the box, and what&apos;s optional —
            in that order.
          </p>
        </div>
      </section>

      <BotSetupCard />
      <PublishingCard />
      <ModelProviderCard platformDefaultConfigured={platformDefaultConfigured} />
      <OptionalIntegrationsCard />

      <div className="h-px bg-[color-mix(in_srgb,var(--color-shell-border-strong)_82%,transparent)]" />
      <div className="flex items-center justify-between text-caption text-zinc-500">
        <span>Abra · Settings</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
