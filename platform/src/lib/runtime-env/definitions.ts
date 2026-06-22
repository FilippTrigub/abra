/**
 * Runtime environment variables that users may manage for Abra runtimes.
 *
 * The allowlist mirrors the Hermes Abra installer profile env contract. Platform
 * and infrastructure-owned variables are modeled as reserved so import flows can
 * reject them with a specific reason instead of silently ignoring dangerous keys.
 * A few keys are reserved for a different reason: they're owned by a dedicated
 * settings flow elsewhere (e.g. Telegram identity lives in Settings -> Telegram
 * bot, backed by agent-config) rather than this generic registry, so a stale
 * value saved here can never silently shadow the dedicated flow's value.
 */

export const RUNTIME_ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type RuntimeEnvGroup =
  | "llm"
  | "observability"
  | "telegram"
  | "utilities"
  | "contentMedia"
  | "runpod"
  | "analytics"
  | "emailMarketing"
  | "seo"
  | "productAnalytics"
  | "crmRevenue"
  | "reserved";

export interface RuntimeEnvValidationMetadata {
  envNamePattern: string;
  allowEmptyValue: boolean;
}

export type RuntimeEnvReservedReason = "platform" | "dedicated-flow";

export interface RuntimeEnvDefinition {
  key: string;
  label: string;
  group: RuntimeEnvGroup;
  description: string;
  reserved: boolean;
  /** Why this key isn't user-managed via this registry. Null when reserved is false. */
  reservedReason: RuntimeEnvReservedReason | null;
  secret: boolean;
  injectIntoDotenv: boolean;
  injectAsProcessEnv: boolean;
  validation: RuntimeEnvValidationMetadata;
  /** Set on the handful of optional keys that are functionally critical (not just nice-to-have). */
  necessity: "critical" | null;
}

const DEFAULT_VALIDATION: RuntimeEnvValidationMetadata = {
  envNamePattern: RUNTIME_ENV_NAME_PATTERN.source,
  allowEmptyValue: true,
};

function runtimeEnvDefinition<const Key extends string>(
  key: Key,
  label: string,
  group: RuntimeEnvGroup,
  description: string,
  options: Partial<Pick<RuntimeEnvDefinition, "reserved" | "reservedReason" | "secret" | "injectIntoDotenv" | "injectAsProcessEnv" | "necessity">> = {},
): RuntimeEnvDefinition & { key: Key } {
  const reserved = options.reserved ?? false;

  return {
    key,
    label,
    group,
    description,
    reserved,
    reservedReason: options.reservedReason ?? (reserved ? "platform" : null),
    secret: options.secret ?? true,
    injectIntoDotenv: options.injectIntoDotenv ?? !reserved,
    injectAsProcessEnv: options.injectAsProcessEnv ?? !reserved,
    validation: DEFAULT_VALIDATION,
    necessity: options.necessity ?? null,
  };
}

const nonSecret = { secret: false };
const reserved = {
  reserved: true,
  secret: true,
  injectIntoDotenv: false,
  injectAsProcessEnv: false,
};
const reservedNonSecret = { ...reserved, secret: false };
// Some reserved keys still need to reach the running container, just not
// from a user-editable value in this registry — injectIntoDotenv/
// injectAsProcessEnv stay true (overriding the `reserved` object's
// defaults of false, which is correct for true platform secrets like
// KUBECONFIG that should never reach the Hermes container at all).
const reservedInjectable = {
  ...reserved,
  injectIntoDotenv: true,
  injectAsProcessEnv: true,
};
// Telegram identity is owned by the dedicated Bot Setup flow (agent-config),
// not this generic registry, so it's excluded from the UI/import/save surface
// the same way platform secrets are.
const reservedDedicatedFlow = { ...reservedInjectable, reservedReason: "dedicated-flow" as const };
const reservedDedicatedFlowNonSecret = { ...reservedDedicatedFlow, secret: false };
const critical = { necessity: "critical" as const };

export const RUNTIME_ENV_DEFINITIONS = [
  // The model provider is chosen and managed entirely by the platform — there
  // is no user-facing override. AZURE_FOUNDRY_API_KEY stays reserved (sourced
  // from the platform's own Vercel env, see lib/runtime-env/platform-defaults.ts)
  // but still needs to reach the deployed container, hence reservedInjectable.
  runtimeEnvDefinition("AZURE_FOUNDRY_API_KEY", "Azure Foundry API key", "llm", "Platform-managed model provider credential. Not user-configurable.", reservedInjectable),

  runtimeEnvDefinition("LANGFUSE_HOST", "Langfuse host", "observability", "Langfuse instance base URL for LLM tracing.", nonSecret),
  runtimeEnvDefinition("LANGFUSE_PUBLIC_KEY", "Langfuse public key", "observability", "Langfuse project public key.", nonSecret),
  runtimeEnvDefinition("LANGFUSE_SECRET_KEY", "Langfuse secret key", "observability", "Langfuse project secret key."),

  runtimeEnvDefinition("TELEGRAM_BOT_TOKEN", "Telegram bot token", "telegram", "Bot token used by the Hermes Telegram gateway. Managed in Settings → Telegram bot, not here.", reservedDedicatedFlow),
  runtimeEnvDefinition("TELEGRAM_ALLOWED_USERS", "Telegram allowed users", "telegram", "Comma-separated allowlist of Telegram users permitted to access the bot. Managed in Settings → Telegram bot, not here.", reservedDedicatedFlowNonSecret),
  runtimeEnvDefinition("TELEGRAM_HOME_CHANNEL", "Telegram home channel", "telegram", "Default Telegram channel or chat identifier. Managed in Settings → Telegram bot, not here.", reservedDedicatedFlowNonSecret),
  runtimeEnvDefinition("TELEGRAM_HOME_CHANNEL_THREAD_ID", "Telegram home channel thread ID", "telegram", "Optional Telegram forum topic/thread ID for the home channel.", nonSecret),
  runtimeEnvDefinition("TELEGRAM_HOME_CHANNEL_NAME", "Telegram home channel name", "telegram", "Human-readable Telegram home channel name.", nonSecret),

  runtimeEnvDefinition("BRAVE_API_KEY", "Brave API key", "utilities", "Brave Search API key used by research utilities."),
  runtimeEnvDefinition("GH_TOKEN", "GitHub token", "utilities", "GitHub token used by automation that needs repository access."),
  runtimeEnvDefinition("OBSIDIAN_VAULT_PATH", "Obsidian vault path", "utilities", "Filesystem path to the Obsidian vault used by note-taking utilities.", nonSecret),
  runtimeEnvDefinition("BROWSERBASE_PROXIES", "Browserbase proxies", "utilities", "Proxy configuration forwarded to Browserbase browser sessions."),
  runtimeEnvDefinition("BROWSERBASE_ADVANCED_STEALTH", "Browserbase advanced stealth", "utilities", "Toggle for Browserbase advanced stealth browser mode.", nonSecret),
  runtimeEnvDefinition("BROWSER_SESSION_TIMEOUT", "Browser session timeout", "utilities", "Browser automation session timeout in milliseconds.", nonSecret),
  runtimeEnvDefinition("BROWSER_INACTIVITY_TIMEOUT", "Browser inactivity timeout", "utilities", "Browser automation inactivity timeout in milliseconds.", nonSecret),
  runtimeEnvDefinition("LINKUP_API_KEY", "Linkup API key", "utilities", "Linkup API key used by web research utilities."),
  runtimeEnvDefinition("TODOIST_API_KEY", "Todoist API key", "utilities", "Todoist API key used by productivity automation."),
  runtimeEnvDefinition("CLOUDFLARE_API_TOKEN", "Cloudflare API token", "utilities", "Cloudflare API token used by Cloudflare automation."),
  runtimeEnvDefinition("CLOUDFLARE_ACCOUNT_ID", "Cloudflare account ID", "utilities", "Cloudflare account identifier used by Cloudflare automation.", nonSecret),

  runtimeEnvDefinition("BUFFER_API_KEY", "Buffer API key", "contentMedia", "Buffer Publish key used by post scheduling.", critical),
  runtimeEnvDefinition("GIPHY_API_KEY", "Giphy API key", "contentMedia", "Giphy API key used by GIF overlay skills."),
  runtimeEnvDefinition("FREESOUND_API_KEY", "Freesound API key", "contentMedia", "Freesound API key used by audio effect skills."),
  runtimeEnvDefinition("PIXABAY_API_KEY", "Pixabay API key", "contentMedia", "Pixabay API key used by stock media overlay skills."),
  runtimeEnvDefinition("HF_TOKEN", "Hugging Face token", "contentMedia", "Hugging Face token used by ML model skills."),
  runtimeEnvDefinition("REPLICATE_API_TOKEN", "Replicate API token", "contentMedia", "Replicate token used by hosted model skills."),
  runtimeEnvDefinition("FAL_API_KEY", "fal.ai API key", "contentMedia", "fal.ai key used by image animation skills."),
  runtimeEnvDefinition("BACKBLAZE_B2_KEY_ID", "Backblaze B2 key ID", "contentMedia", "Backblaze B2 application key ID used by post scheduling video staging.", nonSecret),
  runtimeEnvDefinition("BACKBLAZE_B2_APPLICATION_KEY", "Backblaze B2 application key", "contentMedia", "Backblaze B2 application key used by post scheduling video staging."),
  runtimeEnvDefinition("BACKBLAZE_B2_BUCKET_ID", "Backblaze B2 bucket ID", "contentMedia", "Backblaze B2 bucket identifier used by post scheduling video staging.", nonSecret),
  runtimeEnvDefinition("BACKBLAZE_B2_BUCKET_NAME", "Backblaze B2 bucket name", "contentMedia", "Backblaze B2 bucket name used by post scheduling video staging.", nonSecret),

  runtimeEnvDefinition("RUNPOD_API_KEY", "RunPod API key", "runpod", "RunPod API key for GPU inference endpoints."),
  runtimeEnvDefinition("RUNPOD_ENDPOINT_ID_VIDEO_EDITOR", "RunPod video editor endpoint", "runpod", "RunPod endpoint ID for video editing.", nonSecret),
  runtimeEnvDefinition("RUNPOD_ENDPOINT_ID_VIDEO_MATTE", "RunPod video matte endpoint", "runpod", "RunPod endpoint ID for video matte processing.", nonSecret),
  runtimeEnvDefinition("RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR", "RunPod frame interpolator endpoint", "runpod", "RunPod endpoint ID for frame interpolation.", nonSecret),
  runtimeEnvDefinition("RUNPOD_ENDPOINT_ID_BOKEH_EFFECT", "RunPod bokeh effect endpoint", "runpod", "RunPod endpoint ID for synthetic bokeh effects.", nonSecret),
  runtimeEnvDefinition("RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER", "RunPod background remover endpoint", "runpod", "RunPod endpoint ID for background removal.", nonSecret),
  runtimeEnvDefinition("RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER", "RunPod audio splitter endpoint", "runpod", "RunPod endpoint ID for audio splitting.", nonSecret),
  runtimeEnvDefinition("RUNPOD_ENDPOINT_ID_PHOTO_PICKER", "RunPod photo picker endpoint", "runpod", "RunPod endpoint ID for photo scoring.", nonSecret),
  runtimeEnvDefinition("BACKBLAZE_B2_RUNPOD_KEY_ID", "Backblaze B2 RunPod key ID", "runpod", "Backblaze B2 application key ID used by RunPod staging.", nonSecret),
  runtimeEnvDefinition("BACKBLAZE_B2_RUNPOD_APPLICATION_KEY", "Backblaze B2 RunPod application key", "runpod", "Backblaze B2 application key used by RunPod staging."),
  runtimeEnvDefinition("BACKBLAZE_B2_RUNPOD_BUCKET_NAME", "Backblaze B2 RunPod bucket name", "runpod", "Backblaze B2 bucket name used by RunPod staging.", nonSecret),

  runtimeEnvDefinition("GA4_CLIENT_ID", "GA4 client ID", "analytics", "Google Analytics 4 OAuth client ID.", nonSecret),
  runtimeEnvDefinition("GA4_CLIENT_SECRET", "GA4 client secret", "analytics", "Google Analytics 4 OAuth client secret."),
  runtimeEnvDefinition("GA4_REFRESH_TOKEN", "GA4 refresh token", "analytics", "Google Analytics 4 OAuth refresh token."),
  runtimeEnvDefinition("GA4_PROPERTY_ID", "GA4 property ID", "analytics", "Google Analytics 4 property identifier.", nonSecret),
  runtimeEnvDefinition("GOOGLE_ADS_CLIENT_ID", "Google Ads client ID", "analytics", "Google Ads OAuth client ID.", nonSecret),
  runtimeEnvDefinition("GOOGLE_ADS_CLIENT_SECRET", "Google Ads client secret", "analytics", "Google Ads OAuth client secret."),
  runtimeEnvDefinition("GOOGLE_ADS_REFRESH_TOKEN", "Google Ads refresh token", "analytics", "Google Ads OAuth refresh token."),
  runtimeEnvDefinition("GOOGLE_ADS_DEVELOPER_TOKEN", "Google Ads developer token", "analytics", "Google Ads developer token."),
  runtimeEnvDefinition("GOOGLE_ADS_CUSTOMER_ID", "Google Ads customer ID", "analytics", "Google Ads customer account ID.", nonSecret),
  runtimeEnvDefinition("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "Google Ads login customer ID", "analytics", "Optional manager account login customer ID.", nonSecret),
  runtimeEnvDefinition("GSC_CLIENT_ID", "Google Search Console client ID", "analytics", "Google Search Console OAuth client ID.", nonSecret),
  runtimeEnvDefinition("GSC_CLIENT_SECRET", "Google Search Console client secret", "analytics", "Google Search Console OAuth client secret."),
  runtimeEnvDefinition("GSC_REFRESH_TOKEN", "Google Search Console refresh token", "analytics", "Google Search Console OAuth refresh token."),

  runtimeEnvDefinition("RESEND_API_KEY", "Resend API key", "emailMarketing", "Resend API key for email campaigns."),
  runtimeEnvDefinition("MAILCHIMP_API_KEY", "Mailchimp API key", "emailMarketing", "Mailchimp API key for email campaigns."),
  runtimeEnvDefinition("MAILCHIMP_SERVER_PREFIX", "Mailchimp server prefix", "emailMarketing", "Mailchimp data center/server prefix.", nonSecret),
  runtimeEnvDefinition("SENDGRID_API_KEY", "SendGrid API key", "emailMarketing", "SendGrid API key for email campaigns."),
  runtimeEnvDefinition("KIT_API_KEY", "Kit API key", "emailMarketing", "Kit API key for creator email campaigns."),
  runtimeEnvDefinition("KIT_API_SECRET", "Kit API secret", "emailMarketing", "Kit API secret for creator email campaigns."),
  runtimeEnvDefinition("DUB_API_KEY", "Dub API key", "emailMarketing", "Dub API key for link management."),

  runtimeEnvDefinition("SEMRUSH_API_KEY", "Semrush API key", "seo", "Semrush API key for SEO research."),
  runtimeEnvDefinition("AHREFS_API_KEY", "Ahrefs API key", "seo", "Ahrefs API key for SEO research."),
  runtimeEnvDefinition("DATAFORSEO_LOGIN", "DataForSEO login", "seo", "DataForSEO account login.", nonSecret),
  runtimeEnvDefinition("DATAFORSEO_PASSWORD", "DataForSEO password", "seo", "DataForSEO account password."),
  runtimeEnvDefinition("KEYWORDS_EVERYWHERE_API_KEY", "Keywords Everywhere API key", "seo", "Keywords Everywhere API key."),
  runtimeEnvDefinition("PLAUSIBLE_API_KEY", "Plausible API key", "seo", "Plausible Analytics API key."),
  runtimeEnvDefinition("PLAUSIBLE_SITE_ID", "Plausible site ID", "seo", "Plausible Analytics site identifier.", nonSecret),

  runtimeEnvDefinition("MIXPANEL_SA_USERNAME", "Mixpanel service-account username", "productAnalytics", "Mixpanel service-account username.", nonSecret),
  runtimeEnvDefinition("MIXPANEL_SECRET", "Mixpanel secret", "productAnalytics", "Mixpanel service-account secret."),
  runtimeEnvDefinition("AMPLITUDE_API_KEY", "Amplitude API key", "productAnalytics", "Amplitude project API key."),
  runtimeEnvDefinition("AMPLITUDE_SECRET_KEY", "Amplitude secret key", "productAnalytics", "Amplitude project secret key."),
  runtimeEnvDefinition("HOTJAR_SITE_ID", "Hotjar site ID", "productAnalytics", "Hotjar site identifier.", nonSecret),
  runtimeEnvDefinition("HOTJAR_API_TOKEN", "Hotjar API token", "productAnalytics", "Hotjar API token."),
  runtimeEnvDefinition("OPTIMIZELY_SDK_KEY", "Optimizely SDK key", "productAnalytics", "Optimizely SDK key."),
  runtimeEnvDefinition("OPTIMIZELY_ACCESS_TOKEN", "Optimizely access token", "productAnalytics", "Optimizely access token."),
  runtimeEnvDefinition("POSTHOG_PROJECT_ID", "PostHog project ID", "productAnalytics", "PostHog project identifier.", nonSecret),
  runtimeEnvDefinition("POSTHOG_PERSONAL_API_KEY", "PostHog personal API key", "productAnalytics", "PostHog personal API key."),
  runtimeEnvDefinition("POSTHOG_PROJECT_TOKEN", "PostHog project token", "productAnalytics", "PostHog project token."),
  runtimeEnvDefinition("POSTHOG_HOST", "PostHog host", "productAnalytics", "PostHog host URL.", nonSecret),

  runtimeEnvDefinition("HUBSPOT_ACCESS_TOKEN", "HubSpot access token", "crmRevenue", "HubSpot private app access token."),
  runtimeEnvDefinition("SALESFORCE_CLIENT_ID", "Salesforce client ID", "crmRevenue", "Salesforce OAuth client ID.", nonSecret),
  runtimeEnvDefinition("SALESFORCE_CLIENT_SECRET", "Salesforce client secret", "crmRevenue", "Salesforce OAuth client secret."),
  runtimeEnvDefinition("SALESFORCE_USERNAME", "Salesforce username", "crmRevenue", "Salesforce integration username.", nonSecret),
  runtimeEnvDefinition("SALESFORCE_PASSWORD", "Salesforce password", "crmRevenue", "Salesforce integration password."),
  runtimeEnvDefinition("SALESFORCE_SECURITY_TOKEN", "Salesforce security token", "crmRevenue", "Salesforce integration security token."),
  runtimeEnvDefinition("CLOSE_API_KEY", "Close API key", "crmRevenue", "Close CRM API key."),
  runtimeEnvDefinition("OUTREACH_CLIENT_ID", "Outreach client ID", "crmRevenue", "Outreach OAuth client ID.", nonSecret),
  runtimeEnvDefinition("OUTREACH_CLIENT_SECRET", "Outreach client secret", "crmRevenue", "Outreach OAuth client secret."),
  runtimeEnvDefinition("OUTREACH_REFRESH_TOKEN", "Outreach refresh token", "crmRevenue", "Outreach OAuth refresh token."),
  runtimeEnvDefinition("CROSSBEAM_API_KEY", "Crossbeam API key", "crmRevenue", "Crossbeam API key."),
  runtimeEnvDefinition("APOLLO_API_KEY", "Apollo API key", "crmRevenue", "Apollo API key."),
  runtimeEnvDefinition("CLEARBIT_API_KEY", "Clearbit API key", "crmRevenue", "Clearbit API key."),
  runtimeEnvDefinition("ZOOMINFO_USERNAME", "ZoomInfo username", "crmRevenue", "ZoomInfo integration username.", nonSecret),
  runtimeEnvDefinition("ZOOMINFO_PASSWORD", "ZoomInfo password", "crmRevenue", "ZoomInfo integration password."),
  runtimeEnvDefinition("CLAY_API_KEY", "Clay API key", "crmRevenue", "Clay API key."),
  runtimeEnvDefinition("SEGMENT_WRITE_KEY", "Segment write key", "crmRevenue", "Segment write key for revenue analytics."),

  runtimeEnvDefinition("KUBECONFIG_B64", "Kubeconfig (base64)", "reserved", "Platform-owned Kubernetes credential; never user-managed.", reserved),
  runtimeEnvDefinition("KUBECONFIG", "Kubeconfig", "reserved", "Platform-owned Kubernetes credential path/content; never user-managed.", reserved),
  runtimeEnvDefinition("AKS_RUNTIME_IMAGE", "AKS runtime image", "reserved", "Platform-owned runtime image override.", reservedNonSecret),
  runtimeEnvDefinition("ABRA_RUNTIME_IMAGE", "Abra runtime image", "reserved", "Platform-owned compatibility runtime image override.", reservedNonSecret),
  runtimeEnvDefinition("AZURE_TENANT_ID", "Azure tenant ID", "reserved", "Platform-owned Azure workload identity setting.", reservedNonSecret),
  runtimeEnvDefinition("AZURE_CLIENT_ID", "Azure client ID", "reserved", "Platform-owned Azure workload identity setting.", reservedNonSecret),
  runtimeEnvDefinition("AZURE_FEDERATED_TOKEN_FILE", "Azure federated token file", "reserved", "Platform-owned Azure workload identity token path.", reserved),
  runtimeEnvDefinition("HERMES_HOME", "Hermes home", "reserved", "Platform-owned Hermes runtime home path.", reservedNonSecret),
] as const;

export type RuntimeEnvDefinitionKey = (typeof RUNTIME_ENV_DEFINITIONS)[number]["key"];

export const RESERVED_RUNTIME_ENV_KEYS = [
  "KUBECONFIG_B64",
  "KUBECONFIG",
  "AKS_RUNTIME_IMAGE",
  "ABRA_RUNTIME_IMAGE",
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_ID",
  "AZURE_FEDERATED_TOKEN_FILE",
  "HERMES_HOME",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_ALLOWED_USERS",
  "TELEGRAM_HOME_CHANNEL",
  "AZURE_FOUNDRY_API_KEY",
] as const;

export type ReservedRuntimeEnvKey = (typeof RESERVED_RUNTIME_ENV_KEYS)[number];
export type RuntimeEnvKey = Exclude<RuntimeEnvDefinitionKey, ReservedRuntimeEnvKey>;

export const SUPPORTED_RUNTIME_ENV_DEFINITIONS = RUNTIME_ENV_DEFINITIONS.filter(
  (definition) => !definition.reserved,
);

export const RESERVED_RUNTIME_ENV_DEFINITIONS = RUNTIME_ENV_DEFINITIONS.filter(
  (definition) => definition.reserved,
);

export const SUPPORTED_RUNTIME_ENV_KEYS = SUPPORTED_RUNTIME_ENV_DEFINITIONS.map(
  (definition) => definition.key,
) as RuntimeEnvKey[];

/**
 * Definitions eligible to reach the deployed runtime (.env content, Secret
 * process env, config.yaml forwarding) — broader than SUPPORTED_RUNTIME_ENV_DEFINITIONS,
 * since dedicated-flow keys like Telegram still need injection even though
 * they're excluded from the generic user-editable registry. True platform
 * secrets (KUBECONFIG etc.) stay excluded via their injectIntoDotenv/
 * injectAsProcessEnv defaults of false.
 */
export const RUNTIME_INJECTABLE_DEFINITIONS = RUNTIME_ENV_DEFINITIONS.filter(
  (definition) => definition.injectIntoDotenv || definition.injectAsProcessEnv,
);

const RUNTIME_ENV_DEFINITION_BY_KEY = new Map<string, RuntimeEnvDefinition>(
  RUNTIME_ENV_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function getRuntimeEnvDefinition(key: string): RuntimeEnvDefinition | null {
  return RUNTIME_ENV_DEFINITION_BY_KEY.get(key) ?? null;
}

export function isSupportedRuntimeEnvKey(key: string): key is RuntimeEnvKey {
  const definition = getRuntimeEnvDefinition(key);
  return definition !== null && !definition.reserved;
}

export function isReservedRuntimeEnvKey(key: string): boolean {
  return getRuntimeEnvDefinition(key)?.reserved ?? false;
}

export function getRuntimeEnvDefinitionsByGroup(
  group: RuntimeEnvGroup,
  options: { includeReserved?: boolean } = {},
): RuntimeEnvDefinition[] {
  return RUNTIME_ENV_DEFINITIONS.filter((definition) => (
    definition.group === group && (options.includeReserved || !definition.reserved)
  ));
}

export function getRuntimeEnvGroupOrder(): RuntimeEnvGroup[] {
  return [
    "llm",
    "observability",
    "telegram",
    "utilities",
    "contentMedia",
    "runpod",
    "analytics",
    "emailMarketing",
    "seo",
    "productAnalytics",
    "crmRevenue",
    "reserved",
  ];
}

export function getRuntimeEnvGroupLabel(group: RuntimeEnvGroup): string {
  const labels: Record<RuntimeEnvGroup, string> = {
    llm: "LLM providers",
    observability: "LLM observability",
    telegram: "Telegram",
    utilities: "Utilities",
    contentMedia: "Content and media skills",
    runpod: "RunPod GPU inference",
    analytics: "Google analytics and ads",
    emailMarketing: "Email and marketing",
    seo: "SEO providers",
    productAnalytics: "Product analytics",
    crmRevenue: "CRM and revenue",
    reserved: "Reserved platform keys",
  };

  return labels[group];
}

/** One-line "what this unlocks" intro shown above each optional skill-integration group. */
export function getRuntimeEnvGroupSummary(group: RuntimeEnvGroup): string {
  const summaries: Record<RuntimeEnvGroup, string> = {
    llm: "Lets Abra call your own model provider account instead of the platform default.",
    observability: "Sends LLM call traces to your own Langfuse project for debugging and cost tracking.",
    telegram: "Advanced, optional Telegram tuning. The bot token, home channel, and allowed users themselves are managed in Settings → Telegram bot, above.",
    utilities: "Research, browser automation, and productivity tools Abra's skills can call on.",
    contentMedia: "Stock media, audio, and hosted-model keys for image/video/audio generation skills.",
    runpod: "GPU inference for heavier media skills (video editing, background removal, frame interpolation).",
    analytics: "Lets Abra pull your site/ad performance data into drafts and reports.",
    emailMarketing: "Lets Abra send campaigns or manage links through your email/marketing tools.",
    seo: "Lets Abra pull keyword and ranking data from your SEO research tools.",
    productAnalytics: "Lets Abra read product usage data from your analytics tools.",
    crmRevenue: "Lets Abra read or update records in your CRM and revenue tools.",
    reserved: "Platform-owned. Never user-managed.",
  };

  return summaries[group];
}
