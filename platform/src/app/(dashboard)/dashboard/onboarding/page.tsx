import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { hasCompletedBrandProfile, loadBrandProfile } from "@/lib/brand-profile/service";
import { loadAgentConfig } from "@/lib/agent-config/service";
import { loadRuntimeEnvSummary } from "@/lib/runtime-env/service";
import { OnboardingWizard } from "./onboarding-wizard";

async function loadBufferConfigured(authUserId: string): Promise<boolean> {
  try {
    const summary = await loadRuntimeEnvSummary(authUserId);
    return summary.values.some(
      (entry) => entry.key === "BUFFER_API_KEY" && entry.configured,
    );
  } catch {
    return false;
  }
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ restart?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const restart = params?.restart === "1";
  const [brandProfile, brandComplete, agentConfig, bufferConfigured] = await Promise.all([
    loadBrandProfile(user.id),
    hasCompletedBrandProfile(user.id),
    loadAgentConfig(user.id),
    loadBufferConfigured(user.id),
  ]);

  if (brandComplete && agentConfig && !restart) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initialBrandProfile={brandProfile}
      initialTelegramConfigured={Boolean(agentConfig)}
      initialTelegramHomeChannel={agentConfig?.telegramHomeChannel ?? ""}
      initialBufferConfigured={bufferConfigured}
    />
  );
}
