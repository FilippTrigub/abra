import { Badge, Card } from "@/components/ui";

interface ModelProviderCardProps {
  platformDefaultConfigured: boolean;
}

export function ModelProviderCard({ platformDefaultConfigured }: ModelProviderCardProps) {
  return (
    <Card id="model-provider">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-shell-border-strong)] pb-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-shell-signal)]">
            Model provider
          </p>
          <h2 className="mt-3 text-h5 font-display font-bold text-white">Azure Foundry</h2>
        </div>
        <Badge variant={platformDefaultConfigured ? "success" : "danger"}>
          {platformDefaultConfigured ? "Configured by Abra" : "Not configured"}
        </Badge>
      </div>

      <p className="max-w-2xl text-body leading-7 text-zinc-300">
        {platformDefaultConfigured
          ? "Abra's model connection is provided and managed by the platform. There's nothing to set up here, and no key to choose — this isn't a user setting."
          : "Abra's model connection isn't configured right now. This is managed by the platform operator, not something you can fix here."}
      </p>
    </Card>
  );
}
