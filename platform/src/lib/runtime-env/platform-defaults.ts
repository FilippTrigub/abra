/**
 * Whether the platform itself (Vercel env, not anything user-configured) has a
 * default Azure Foundry model credential set. When true, Abra deploys with a
 * working model provider even if the user never touches Settings — see
 * aks-adapter.ts's buildManifestInput, which injects process.env.AZURE_FOUNDRY_API_KEY
 * as the default runtimeEnv.azureFoundryApiKey unless the user has saved their own.
 */
export function hasPlatformAzureFoundryDefault(): boolean {
  return Boolean(process.env.AZURE_FOUNDRY_API_KEY?.trim());
}
