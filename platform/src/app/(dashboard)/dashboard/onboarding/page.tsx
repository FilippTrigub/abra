import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { hasCompletedBrandProfile, loadBrandProfile } from "@/lib/brand-profile/service";
import { loadAgentConfig } from "@/lib/agent-config/service";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ restart?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const restart = params?.restart === "1";
  const [brandProfile, brandComplete, agentConfig] = await Promise.all([
    loadBrandProfile(user.id),
    hasCompletedBrandProfile(user.id),
    loadAgentConfig(user.id),
  ]);

  if (brandComplete && agentConfig && !restart) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initialBrandProfile={brandProfile}
      initialTelegramConfigured={Boolean(agentConfig)}
      initialTelegramHomeChannel={agentConfig?.telegramHomeChannel ?? ""}
    />
  );
}
