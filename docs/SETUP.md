# Marketing Skills Setup Guide

This document lists all API keys required by the marketing skills and where to obtain them.

## Quick Reference

| Skill | Providers | Required Keys |
|-------|-----------|---------------|
| `seo-researcher` | gsc, semrush, ahrefs, dataforseo, keywords-everywhere, plausible | At least one of: GSC, SEMRUSH_API_KEY, AHREFS_API_KEY, DATAFORSEO_*, KEYWORDS_EVERYWHERE_*, PLAUSIBLE_* |
| `funnel-optimizer` | ga4, mixpanel, amplitude, hotjar, optimizely, posthog | At least one of: GA4_*, MIXPANEL_*, AMPLITUDE_*, HOTJAR_*, OPTIMIZELY_*, POSTHOG_* |
| `email-campaigner` | resend, mailchimp, sendgrid, kit, dub | At least one of: RESEND_API_KEY, MAILCHIMP_API_KEY, SENDGRID_API_KEY, KIT_API_KEY/KIT_API_SECRET, DUB_API_KEY |
| `ads-manager` | ga4, google-ads | GA4_CLIENT_ID + GA4_CLIENT_SECRET + GA4_REFRESH_TOKEN + GA4_PROPERTY_ID, GOOGLE_ADS_* |
| `revenue-manager` | hubspot, salesforce, close, outreach, crossbeam, apollo, clearbit, zoominfo, clay, segment | At least one of: HUBSPOT_*, SALESFORCE_*, CLOSE_API_KEY, OUTREACH_*, CROSSBEAM_*, APOLLO_*, CLEARBIT_*, ZOOMINFO_*, CLAY_API_KEY, SEGMENT_WRITE_KEY |

---

## Provider API Keys

### Google Analytics (ga4)

| Key | Description |
|-----|-------------|
| `GA4_CLIENT_ID` | OAuth2 client ID |
| `GA4_CLIENT_SECRET` | OAuth2 client secret |
| `GA4_REFRESH_TOKEN` | OAuth2 refresh token (long-lived) |
| `GA4_PROPERTY_ID` | GA4 numeric property ID (e.g., `123456789`) |

**How to get:**

**Step 1 — Create OAuth credentials**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create or select a project
2. Go to **APIs & Services → Library**, search for "Google Analytics Data API", and click **Enable**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Application type: **Web application**; add `https://developers.google.com/oauthplayground` as an authorized redirect URI
5. Copy the **Client ID** → `GA4_CLIENT_ID` and **Client Secret** → `GA4_CLIENT_SECRET`

**Step 2 — Get a refresh token via OAuth Playground**
1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Click the gear icon (top-right) → check **Use your own OAuth credentials** → enter your Client ID and Secret
3. In Step 1, find **Google Analytics Data API v1** and select `https://www.googleapis.com/auth/analytics.readonly`; click **Authorize APIs**
4. Sign in and grant access
5. In Step 2, click **Exchange authorization code for tokens**
6. Copy the **Refresh token** → `GA4_REFRESH_TOKEN` (does not expire unless revoked)

**Step 3 — Grant access to your GA4 property**
1. In Google Analytics, go to **Admin → Property → Property Access Management**
2. Click **+** → **Add users**, enter the Google account used in OAuth Playground
3. Assign **Viewer** role (or higher if writes are needed)

**Step 4 — Find your property ID (`GA4_PROPERTY_ID`)**
1. In Google Analytics, go to **Admin → Property Settings**
2. The property ID is shown at the top — a plain number like `123456789` (not the `G-XXXXXXXX` measurement ID)

---

### Google Ads (google-ads)

| Key | Description |
|-----|-------------|
| `GOOGLE_ADS_CLIENT_ID` | OAuth2 client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | Refresh token (long-lived; used to obtain short-lived access tokens) |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer token (22-char identifier, required on every request) |
| `GOOGLE_ADS_CUSTOMER_ID` | Google Ads customer ID (without hyphens) |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | Manager account customer ID — only required when accessing accounts via a manager |

**How to get:**

**Step 1 — Developer token (`GOOGLE_ADS_DEVELOPER_TOKEN`)**
1. You need a Google Ads **manager account** (MCC). If you don't have one, create one at [ads.google.com](https://ads.google.com) using an email not already tied to a standard Google Ads account.
2. In the manager account, go to [ads.google.com/aw/apicenter](https://ads.google.com/aw/apicenter)
3. Complete the API Access form and accept the Terms of Service
4. Copy the 22-character developer token shown on that page
5. New tokens start at **Explorer access** (limited daily quota). Apply for Basic access when you're ready for production use.

**Step 2 — OAuth2 credentials (`GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`)**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (or select an existing one)
2. Go to **APIs & Services → Library**, search for "Google Ads API", and click **Enable**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Select **Desktop app** as the application type
5. Copy the **Client ID** and **Client Secret**
6. Go to **APIs & Services → OAuth consent screen** and add your Google account as a test user if the app is not published

**Step 3 — Refresh token (`GOOGLE_ADS_REFRESH_TOKEN`)**

Use the [Google OAuth2 Playground](https://developers.google.com/oauthplayground):
1. Open the playground and click the **gear icon** (top right) → check **Use your own OAuth credentials**
2. Enter your Client ID and Client Secret
3. In the scope list, find **Google Ads API** and select `https://www.googleapis.com/auth/adwords` — or paste it into the input box
4. Click **Authorize APIs** and sign in with the Google account that has access to your Google Ads account
5. Click **Exchange authorization code for tokens**
6. Copy the `refresh_token` from the response — this is long-lived and won't expire unless revoked

**Step 4 — Customer ID (`GOOGLE_ADS_CUSTOMER_ID`)**
1. Sign in to [ads.google.com](https://ads.google.com)
2. The customer ID is shown in the top-right corner in the format `XXX-XXX-XXXX`
3. Set the env var without hyphens (e.g. `1234567890`)

**Step 5 — Login customer ID (`GOOGLE_ADS_LOGIN_CUSTOMER_ID`) — optional**

Only needed if you're accessing a client account through a manager (MCC) account:
1. The login customer ID is the manager account's customer ID, found the same way as above
2. Set it without hyphens
3. Leave unset if you're authenticating directly as the account owner

---

### Google Search Console (gsc)

| Key | Description |
|-----|-------------|
| `GSC_CLIENT_ID` | OAuth2 client ID |
| `GSC_CLIENT_SECRET` | OAuth2 client secret |
| `GSC_REFRESH_TOKEN` | Long-lived refresh token |

**How to get:**

**Step 1 — OAuth2 credentials (`GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`)**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create or select a project
2. Go to **APIs & Services → Library**, search for "Google Search Console API", and click **Enable**
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Select **Desktop app** as the application type
5. Copy the **Client ID** and **Client Secret**
6. If the OAuth consent screen is in testing mode, add your Google account as a test user under **APIs & Services → OAuth consent screen → Test users**

**Step 2 — Refresh token (`GSC_REFRESH_TOKEN`)**

Use the [Google OAuth2 Playground](https://developers.google.com/oauthplayground):
1. Click the **gear icon** → check **Use your own OAuth credentials**, enter your Client ID and Secret
2. Find **Search Console API v1** in the scope list and select `https://www.googleapis.com/auth/webmasters.readonly` (read-only is sufficient for querying)
3. Click **Authorize APIs** and sign in with the Google account that owns the Search Console property
4. Click **Exchange authorization code for tokens**
5. Copy the `refresh_token` — it does not expire unless access is revoked

---

### Resend (resend)

| Key | Description |
|-----|-------------|
| `RESEND_API_KEY` | Resend API key |

**How to get:**
1. Sign up at [resend.com](https://resend.com) and verify your domain (required before sending)
2. Go to **API Keys** in the left sidebar
3. Click **Create API Key**
4. Give it a name and select permission: **Full access** (for all operations) or **Sending access** (send-only, more restricted)
5. Copy the key immediately — it is only shown once

---

### Mailchimp (mailchimp)

| Key | Description |
|-----|-------------|
| `MAILCHIMP_API_KEY` | Mailchimp API key |
| `MAILCHIMP_SERVER_PREFIX` | Data center prefix (e.g., `us1`, `us19`) |

**How to get:**

**`MAILCHIMP_API_KEY`**
1. Sign in to [mailchimp.com](https://mailchimp.com)
2. Click your profile icon (bottom-left) → **Account & billing → Extras → API keys**
3. Click **Create A Key**, give it a name, and copy the key — it is only shown once

**`MAILCHIMP_SERVER_PREFIX`**
1. Look at your browser's URL bar while logged into Mailchimp — it will look like `https://us19.admin.mailchimp.com/`
2. The prefix is the part before `.admin.mailchimp.com` — in this example, `us19`
3. This identifies your Mailchimp data center and must match the account your API key belongs to

---

### SendGrid (sendgrid)

| Key | Description |
|-----|-------------|
| `SENDGRID_API_KEY` | SendGrid API key |

**How to get:**
1. Sign in at [app.sendgrid.com](https://app.sendgrid.com)
2. Go to **Settings → API Keys**
3. Click **Create API Key**
4. Choose **Restricted Access** and enable at minimum: **Mail Send → Full Access**
5. For read operations (stats, templates), also enable the relevant read permissions
6. Copy the key immediately — it is only shown once

---

### Kit (kit)

| Key | Description |
|-----|-------------|
| `KIT_API_KEY` | Public API key — required for form/sequence/tag subscribe endpoints |
| `KIT_API_SECRET` | Private API secret — required for subscriber read/update, broadcasts, and unsubscribe endpoints |

**How to get:**
1. Sign in at [app.kit.com](https://app.kit.com) (formerly convertkit.com)
2. Click your profile icon → **Settings → Developer**
3. Under **API**, copy both your **API Key** (`KIT_API_KEY`) and **API Secret** (`KIT_API_SECRET`)
4. The API Key is sufficient for public actions (subscribing to forms, sequences, tags); the API Secret is required for reading subscriber data, updating subscribers, and creating broadcasts

---

### Dub (dub)

| Key | Description |
|-----|-------------|
| `DUB_API_KEY` | Dub.co API key |

**How to get:**
1. Sign in at [app.dub.co](https://app.dub.co)
2. Go to **Settings → API Keys**
3. Click **Create API Key**, give it a name
4. Copy the key — it is only shown once

---

### SEMRUSH (semrush)

| Key | Description |
|-----|-------------|
| `SEMRUSH_API_KEY` | Semrush API key |

**How to get:**
1. Sign in at [semrush.com](https://www.semrush.com) — API access requires a **Pro plan or higher**
2. Click your profile icon → **Profile** → scroll to the **API Key** section, or go directly to [semrush.com/api](https://www.semrush.com/api/)
3. Copy your API key — it is tied to your account and does not expire
4. API units are consumed per request; check your daily limit under the same page

---

### Ahrefs (ahrefs)

| Key | Description |
|-----|-------------|
| `AHREFS_API_KEY` | Ahrefs API key |

**How to get:**
1. Sign in at [app.ahrefs.com](https://app.ahrefs.com) — API access requires an **Advanced plan or higher** (the v3 API supports free test queries on any plan)
2. Go to **Account Settings → API Keys** (or via the profile menu)
3. Click **Generate API key**, give it a label, and copy it
4. The key is scoped to your account; you can create multiple keys and revoke them individually

---

### DataForSEO (dataforseo)

| Key | Description |
|-----|-------------|
| `DATAFORSEO_LOGIN` | DataForSEO account login (email address) |
| `DATAFORSEO_PASSWORD` | DataForSEO account password |

**How to get:**
1. Sign up at [dataforseo.com](https://dataforseo.com) — a free trial is available
2. Your `DATAFORSEO_LOGIN` is the **email address** you registered with
3. Your `DATAFORSEO_PASSWORD` is your **account password**
4. The API uses HTTP Basic Auth with these credentials directly — there is no separate API key
5. You can verify your credentials at [app.dataforseo.com/api-access](https://app.dataforseo.com/api-access)

---

### Keywords Everywhere (keywords-everywhere)

| Key | Description |
|-----|-------------|
| `KEYWORDS_EVERYWHERE_API_KEY` | Keywords Everywhere API key |

**How to get:**
1. Sign up at [keywordseverywhere.com](https://keywordseverywhere.com) — a paid plan is required for API access
2. Sign in and go to **Settings → API Key** (in the top navigation after signing in)
3. Your API key is displayed there — copy it
4. API credits are consumed per keyword lookup; check your balance on the same page

---

### Plausible (plausible)

| Key | Description |
|-----|-------------|
| `PLAUSIBLE_API_KEY` | Plausible Stats API key |
| `PLAUSIBLE_SITE_ID` | Your site's domain as registered in Plausible (e.g., `example.com`) |

**How to get:**

**`PLAUSIBLE_API_KEY`**
1. Sign in at [plausible.io](https://plausible.io)
2. Click your account name (top-right) → **Settings**
3. Scroll to **API Keys** in the left sidebar → click **New API Key**
4. Select **Stats API**, give it a name, and save — copy it immediately, it is shown only once

**`PLAUSIBLE_SITE_ID`**
1. The site ID is the **domain** you entered when adding your site to Plausible, e.g. `example.com` or `blog.example.com`
2. You can verify it under **Sites** — it matches the domain shown in your dashboard list exactly (no `https://`, no trailing slash)

---

### Mixpanel (mixpanel)

| Key | Description |
|-----|-------------|
| `MIXPANEL_SA_USERNAME` | Mixpanel service account username |
| `MIXPANEL_SECRET` | Mixpanel service account secret |

**How to get:**
1. Sign in at [mixpanel.com](https://mixpanel.com) and open your project
2. Go to **Settings → Project Settings → Service Accounts**
3. Click **Add Service Account**, give it a name, and select a role:
   - **Analyst** — read-only access to data (sufficient for funnel-optimizer)
   - **Admin** — full access
4. After creating, copy:
   - **Username** — looks like `service-account-name.abc123.mp-service-account` → set as `MIXPANEL_SA_USERNAME`
   - **Secret** — shown only once at creation → set as `MIXPANEL_SECRET`
5. Authentication uses HTTP Basic Auth with `username:secret` — both are always required together

---

### Amplitude (amplitude)

| Key | Description |
|-----|-------------|
| `AMPLITUDE_API_KEY` | Amplitude project API key |
| `AMPLITUDE_SECRET_KEY` | Amplitude project secret key |

**How to get:**
1. Sign in at [amplitude.com](https://amplitude.com)
2. Click **Organization Settings** (gear icon, top-right) → **Projects**
3. Select your project from the list
4. You will see the **API Key** directly — copy it as `AMPLITUDE_API_KEY`
5. For the **Secret Key**: click the project name to open project settings, then find **Secret Key** and click **Regenerate** or **Show** to reveal it — copy it as `AMPLITUDE_SECRET_KEY`
6. The API key alone is sufficient for event ingestion; both keys together (as Basic Auth `api_key:secret_key`) are required for the Dashboard REST API (queries, exports, retention)

---

### Hotjar (hotjar)

| Key | Description |
|-----|-------------|
| `HOTJAR_SITE_ID` | Hotjar numeric site ID |
| `HOTJAR_API_TOKEN` | Hotjar personal API token |

**How to get:**

**`HOTJAR_SITE_ID`**
1. Sign in at [insights.hotjar.com](https://insights.hotjar.com)
2. Go to **Sites & Organizations** — the numeric ID is shown under each site name
3. Alternatively, look at the URL when on a site dashboard: `.../site/12345/` — the number is your site ID

**`HOTJAR_API_TOKEN`**
1. In Hotjar, go to **Profile → Personal API Token** (top-right profile menu)
2. Click **Generate New Token**, give it a label
3. Copy the token — it is shown only once

---

### Optimizely (optimizely)

| Key | Description |
|-----|-------------|
| `OPTIMIZELY_SDK_KEY` | Feature Experimentation environment SDK key |
| `OPTIMIZELY_ACCESS_TOKEN` | Personal access token for the REST API |

**How to get:**

**`OPTIMIZELY_SDK_KEY`** (used to initialize the Feature Experimentation SDK and pull flag/experiment configs)
1. Sign in at [app.optimizely.com](https://app.optimizely.com)
2. Go to **Feature Experimentation → Settings → Environments**
3. Select the environment (e.g., Production or Development)
4. Copy the **SDK Key** for that environment — each environment has its own key

**`OPTIMIZELY_ACCESS_TOKEN`** (used for REST API calls: listing experiments, results, etc.)
1. In Optimizely, click your profile picture (top-right) → **Profile**
2. Scroll to **API Access Tokens** → click **Generate new token**
3. Give it a name and copy the token — it is shown only once and does not expire unless revoked

---

### PostHog (posthog)

| Key | Description |
|-----|-------------|
| `POSTHOG_PROJECT_TOKEN` | Project token for event capture and public flag evaluation |
| `POSTHOG_PROJECT_ID` | Numeric PostHog project ID for private Query API reads |
| `POSTHOG_PERSONAL_API_KEY` | Personal API key for Query API, persons, insights, feature flags, and experiments reads |
| `POSTHOG_HOST` | Optional PostHog app/self-hosted host override; defaults to `https://us.posthog.com` |

**How to get:**

1. Sign in at [app.posthog.com](https://app.posthog.com) and open your project.
2. Go to **Project settings → Project variables** and copy the project token as `POSTHOG_PROJECT_TOKEN`.
3. Copy the numeric project ID from **Project settings** or the project URL and set it as `POSTHOG_PROJECT_ID` if you want private analytics reads.
4. Go to your profile or organization API settings, create a personal API key with read access, and set it as `POSTHOG_PERSONAL_API_KEY` if you want private analytics reads.
5. Leave `POSTHOG_HOST` unset for PostHog Cloud US. For EU Cloud set `POSTHOG_HOST=https://eu.posthog.com`; for self-hosted PostHog set it to your instance URL.

---

### HubSpot (hubspot)

| Key | Description |
|-----|-------------|
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app access token |

**How to get:**
1. Sign in at [app.hubspot.com](https://app.hubspot.com) — you must have **Super Admin** access
2. Go to **Settings** (gear icon) → **Integrations → Private Apps**
3. Click **Create a private app**
4. On the **Basic Info** tab: enter a name and description
5. On the **Scopes** tab, add the permissions your use case needs. For CRM/revenue use: `crm.objects.contacts.read`, `crm.objects.companies.read`, `crm.objects.deals.read`, `crm.schemas.read`
6. Click **Create app** → confirm by clicking **Continue creating**
7. On the app details page, click the **Auth** tab → **Show token** → copy it
8. The token does not expire unless you rotate it manually

---

### Salesforce (salesforce)

| Key | Description |
|-----|-------------|
| `SALESFORCE_CLIENT_ID` | Connected App consumer key |
| `SALESFORCE_CLIENT_SECRET` | Connected App consumer secret |
| `SALESFORCE_USERNAME` | Salesforce login username (email) |
| `SALESFORCE_PASSWORD` | Salesforce login password |
| `SALESFORCE_SECURITY_TOKEN` | Account security token (appended to password for API login) |

**How to get:**

**Step 1 — Connected App (`SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`)**
1. In Salesforce, click the **gear icon** → **Setup**
2. In the left sidebar, go to **Apps → App Manager**
3. Click **New Connected App** (top-right)
4. Fill in **Connected App Name**, **API Name**, and **Contact Email**
5. Under **API (Enable OAuth Settings)**: check **Enable OAuth Settings**
6. Set **Callback URL** to `https://login.salesforce.com/services/oauth2/success`
7. Under **Selected OAuth Scopes**, add: **Manage user data via APIs (api)** and **Perform requests at any time (refresh_token, offline_access)**
8. Click **Save** → wait a few minutes for the app to propagate
9. Go back to **App Manager**, find your app, click the dropdown → **View**
10. Copy **Consumer Key** as `SALESFORCE_CLIENT_ID` and **Consumer Secret** (click to reveal) as `SALESFORCE_CLIENT_SECRET`

**Step 2 — Username and password**
- `SALESFORCE_USERNAME` is your Salesforce login email
- `SALESFORCE_PASSWORD` is your Salesforce password

**Step 3 — Security token (`SALESFORCE_SECURITY_TOKEN`)**
1. The security token is appended to your password for IP-unrestricted API logins
2. Go to **Profile → Settings → Reset My Security Token** → click **Reset Security Token**
3. A new token will be emailed to your Salesforce login address — copy it
4. If your org has trusted IP ranges configured that include your server's IP, the security token may not be required

---

### Close (close)

| Key | Description |
|-----|-------------|
| `CLOSE_API_KEY` | Close CRM API key |

**How to get:**
1. Sign in at [app.close.com](https://app.close.com)
2. Click your name (bottom-left) → **Settings → Developer → API Keys**
3. Click **Generate New API Key**, give it a label
4. Copy the key — it is shown only once
5. The key provides access scoped to your user account; admin users can also create organization-level keys

---

### Outreach (outreach)

| Key | Description |
|-----|-------------|
| `OUTREACH_CLIENT_ID` | Outreach OAuth2 application ID |
| `OUTREACH_CLIENT_SECRET` | Outreach OAuth2 application secret |
| `OUTREACH_REFRESH_TOKEN` | Outreach OAuth2 refresh token (long-lived) |

**How to get:**

Outreach uses OAuth2 with refresh tokens. The provider exchanges the refresh token for a short-lived access token automatically on each call.

**Step 1 — Create an OAuth app**
1. Sign in at [outreach.io](https://outreach.io) as an admin
2. Go to **Settings → Integrations → API** → click **Create OAuth Application**
3. Set the redirect URI to `https://localhost` (for manual token generation)
4. Copy the **Application ID** → `OUTREACH_CLIENT_ID` and **Secret** → `OUTREACH_CLIENT_SECRET`

**Step 2 — Authorize and get a refresh token**
1. Build the authorization URL:
   ```
   https://api.outreach.io/oauth/authorize?client_id=YOUR_APP_ID&redirect_uri=https://localhost&response_type=code&scope=prospects.read+sequences.read+opportunities.read
   ```
2. Open this URL in a browser, sign in, and approve access
3. You will be redirected to `https://localhost?code=AUTH_CODE` — copy the `code` parameter
4. Exchange the code for tokens:
   ```bash
   curl -X POST https://api.outreach.io/oauth/token \
     -d "client_id=YOUR_APP_ID&client_secret=YOUR_SECRET&redirect_uri=https://localhost&grant_type=authorization_code&code=AUTH_CODE"
   ```
5. Copy `refresh_token` → `OUTREACH_REFRESH_TOKEN` (the access token is short-lived; store only the refresh token)

---

### Crossbeam (crossbeam)

| Key | Description |
|-----|-------------|
| `CROSSBEAM_API_KEY` | Crossbeam API key |

**How to get:**
1. Sign in at [app.crossbeam.com](https://app.crossbeam.com)
2. Go to **Settings → API Keys**
3. Click **Create API Key**, give it a name
4. Copy the key — it is shown only once
5. The key provides read access to partner overlap data for your organization

---

### Apollo (apollo)

| Key | Description |
|-----|-------------|
| `APOLLO_API_KEY` | Apollo.io API key |

**How to get:**
1. Sign in at [app.apollo.io](https://app.apollo.io)
2. Click your profile icon (top-right) → **Settings → Integrations → API**
3. Under **API Keys**, click **Create New Key**
4. Give it a label and copy the key
5. The free plan includes limited API credits; paid plans have higher limits

---

### Clearbit (clearbit)

| Key | Description |
|-----|-------------|
| `CLEARBIT_API_KEY` | Clearbit (now HubSpot Breeze Intelligence) API key |

**How to get:**
1. Clearbit was acquired by HubSpot in 2024 and rebranded as **Breeze Intelligence**. Existing Clearbit API keys continue to work for legacy customers.
2. For legacy accounts: sign in at [dashboard.clearbit.com](https://dashboard.clearbit.com) → **API** in the left sidebar → copy your secret key
3. For new access: the enrichment functionality is now available via the HubSpot Data Enrichment API — use your `HUBSPOT_ACCESS_TOKEN` with the Breeze Intelligence endpoints instead

---

### ZoomInfo (zoominfo)

| Key | Description |
|-----|-------------|
| `ZOOMINFO_USERNAME` | ZoomInfo account email address |
| `ZOOMINFO_PASSWORD` | ZoomInfo account password |

**How to get:**

ZoomInfo uses username/password authentication to generate a short-lived JWT on each call. The provider handles token generation automatically — you only need to store your credentials.

1. Sign in at [app.zoominfo.com](https://app.zoominfo.com) — API access requires an **Advanced** or **Elite** plan
2. Your `ZOOMINFO_USERNAME` is the email address you use to sign in
3. Your `ZOOMINFO_PASSWORD` is your account password
4. The provider calls `https://api.zoominfo.com/authenticate` automatically before each API request to obtain a fresh JWT (valid for 1 hour)

---

### Clay (clay)

| Key | Description |
|-----|-------------|
| `CLAY_API_KEY` | Clay API key |

**How to get:**
1. Sign in at [clay.com](https://clay.com)
2. Click your workspace name (top-left) → **Settings → API**
3. Click **Generate New API Key**, give it a name
4. Copy the key — it is tied to your workspace and provides access to tables and enrichment

---

### Segment (segment)

| Key | Description |
|-----|-------------|
| `SEGMENT_WRITE_KEY` | Segment source write key |

**How to get:**

The write key is **per source** (not per workspace). Each source has its own write key.

1. Sign in at [app.segment.com](https://app.segment.com)
2. Go to **Connections → Sources**
3. Select the source you want to write events to (or click **Add Source** to create one — choose **HTTP API** for server-side use)
4. Go to the source's **Settings** tab
5. Copy the **Write Key** under **API Keys**
6. The write key only allows writing (tracking) events to that specific source — it cannot read data

---

## Setting Up in OpenClaw

After obtaining your API keys, you can configure them in `~/.openclaw/openclaw.json`:

```json
{
  "env": {
    "GA4_CLIENT_ID": "your-ga4-client-id",
    "GA4_CLIENT_SECRET": "your-ga4-client-secret",
    "GA4_REFRESH_TOKEN": "your-ga4-refresh-token",
    "GA4_PROPERTY_ID": "123456789",
    "GOOGLE_ADS_CLIENT_ID": "your-client-id",
    "GOOGLE_ADS_CLIENT_SECRET": "your-client-secret",
    "GOOGLE_ADS_REFRESH_TOKEN": "your-refresh-token",
    "GOOGLE_ADS_DEVELOPER_TOKEN": "your-developer-token",
    "GOOGLE_ADS_CUSTOMER_ID": "1234567890",
    "RESEND_API_KEY": "your-resend-key",
    "MAILCHIMP_API_KEY": "your-mailchimp-key",
    "MAILCHIMP_SERVER_PREFIX": "us1",
    "SENDGRID_API_KEY": "your-sendgrid-key",
    "KIT_API_KEY": "your-kit-key",
    "KIT_API_SECRET": "your-kit-secret",
    "DUB_API_KEY": "your-dub-key",
    "SEMRUSH_API_KEY": "your-semrush-key",
    "AHREFS_API_KEY": "your-ahrefs-key",
    "MIXPANEL_SA_USERNAME": "your-mixpanel-sa-username",
    "MIXPANEL_SECRET": "your-mixpanel-secret",
    "AMPLITUDE_API_KEY": "your-amplitude-key",
    "AMPLITUDE_SECRET_KEY": "your-amplitude-secret",
    "HOTJAR_SITE_ID": "your-hotjar-site-id",
    "HOTJAR_API_TOKEN": "your-hotjar-token",
    "OPTIMIZELY_SDK_KEY": "your-optimizely-sdk-key",
    "OPTIMIZELY_ACCESS_TOKEN": "your-optimizely-token",
    "POSTHOG_PROJECT_TOKEN": "your-posthog-project-token",
    "POSTHOG_PROJECT_ID": "12345",
    "POSTHOG_PERSONAL_API_KEY": "your-posthog-personal-api-key",
    "HUBSPOT_ACCESS_TOKEN": "your-hubspot-token",
    "CLOSE_API_KEY": "your-close-key",
    "OUTREACH_CLIENT_ID": "your-outreach-client-id",
    "OUTREACH_CLIENT_SECRET": "your-outreach-client-secret",
    "OUTREACH_REFRESH_TOKEN": "your-outreach-refresh-token",
    "APOLLO_API_KEY": "your-apollo-key",
    "CLEARBIT_API_KEY": "your-clearbit-key",
    "ZOOMINFO_USERNAME": "your@email.com",
    "ZOOMINFO_PASSWORD": "your-zoominfo-password",
    "CLAY_API_KEY": "your-clay-key",
    "SEGMENT_WRITE_KEY": "your-segment-key"
  }
}
```

Or run `./installers/install-abra-on-openclaw.sh` interactively to be prompted for each key.
