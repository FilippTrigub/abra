# Marketing Skills Setup Guide

This document lists all API keys required by the marketing skills and where to obtain them.

## Quick Reference

| Skill | Providers | Required Keys |
|-------|-----------|---------------|
| `seo-researcher` | gsc, semrush, ahrefs, dataforseo, keywords-everywhere, plausible | At least one of: GSC, SEMRUSH_API_KEY, AHREFS_API_KEY, DATAFORSEO_*, KEYWORDS_EVERYWHERE_*, PLAUSIBLE_* |
| `funnel-optimizer` | ga4, mixpanel, amplitude, hotjar, optimizely | At least one of: GA4_*, MIXPANEL_*, AMPLITUDE_*, HOTJAR_*, OPTIMIZELY_* |
| `email-campaigner` | resend, mailchimp, sendgrid, kit, dub | At least one of: RESEND_API_KEY, MAILCHIMP_API_KEY, SENDGRID_API_KEY, KIT_API_KEY, DUB_API_KEY |
| `ads-manager` | ga4, google-ads | GA4_ACCESS_TOKEN + GA4_PROPERTY_ID, GOOGLE_ADS_* |
| `revenue-manager` | hubspot, salesforce, close, outreach, crossbeam, apollo, clearbit, zoominfo, clay, segment | At least one of: HUBSPOT_*, SALESFORCE_*, CLOSE_API_KEY, OUTREACH_*, CROSSBEAM_*, APOLLO_*, CLEARBIT_*, ZOOMINFO_*, CLAY_API_KEY, SEGMENT_WRITE_KEY |

---

## Provider API Keys

### Google Analytics (ga4)

| Key | Description |
|-----|-------------|
| `GA4_ACCESS_TOKEN` | Google Analytics Data API access token |
| `GA4_PROPERTY_ID` | GA4 property ID (e.g., "123456789") |

**How to get:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing
3. Enable "Google Analytics Data API"
4. Create Service Account credentials
5. Download JSON key file
6. Add Service Account to GA4 property with "Viewer" role
7. Use the `ga4` CLI to authenticate with your Google account

### Google Ads (google-ads)

| Key | Description |
|-----|-------------|
| `GOOGLE_ADS_CLIENT_ID` | OAuth2 client ID |
| `GOOGLE_ADS_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_ADS_REFRESH_TOKEN` | Refresh token for API access |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Developer token |

**How to get:**
1. Apply for Google Ads API access in [Google Ads UI](https://ads.google.com/)
2. Create a GCP project with Google Ads API enabled
3. Create OAuth2 credentials
4. Generate refresh token

### Google Search Console (gsc)

| Key | Description |
|-----|-------------|
| `GSC_CLIENT_ID` | OAuth2 client ID |
| `GSC_CLIENT_SECRET` | OAuth2 client secret |
| `GSC_REFRESH_TOKEN` | Refresh token |

**How to get:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Search Console API
3. Create OAuth2 credentials
4. Authenticate via `gsc` CLI

### Resend (resend)

| Key | Description |
|-----|-------------|
| `RESEND_API_KEY` | Resend API key |

**How to get:**
1. Sign up at [resend.com](https://resend.com)
2. Go to API Keys page
3. Create new API key

### Mailchimp (mailchimp)

| Key | Description |
|-----|-------------|
| `MAILCHIMP_API_KEY` | Mailchimp API key |
| `MAILCHIMP_SERVER_PREFIX` | Server prefix from your Mailchimp URL (e.g., "us1") |

**How to get:**
1. Sign up at [mailchimp.com](https://mailchimp.com)
2. Go to Account > Extras > API keys
3. Create new API key

### SendGrid (sendgrid)

| Key | Description |
|-----|-------------|
| `SENDGRID_API_KEY` | SendGrid API key |

**How to get:**
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Go to Settings > API Keys
3. Create new API key with Mail Send permissions

### Kit (kit)

| Key | Description |
|-----|-------------|
| `KIT_API_KEY` | Kit (formerly ConvertKit) API key |

**How to get:**
1. Sign up at [kit.com](https://kit.com)
2. Go to Settings > Advanced > API
3. Generate API key

### Dub (dub)

| Key | Description |
|-----|-------------|
| `DUB_API_KEY` | Dub.co API key |

**How to get:**
1. Sign up at [dub.co](https://dub.co)
2. Go to Settings > API
3. Create new API key

### SEMRUSH (semrush)

| Key | Description |
|-----|-------------|
| `SEMRUSH_API_KEY` | SEMRUSH API key |

**How to get:**
1. Sign up at [semrush.com](https://www.semrush.com)
2. Go to Account > API
3. Enable API access

### Ahrefs (ahrefs)

| Key | Description |
|-----|-------------|
| `AHREFS_API_KEY` | Ahrefs API key |

**How to get:**
1. Sign up at [ahrefs.com](https://ahrefs.com)
2. Go to Dashboard > API
3. Create API key

### DataForSEO (dataforseo)

| Key | Description |
|-----|-------------|
| `DATAFORSEO_LOGIN` | DataForSEO login email |
| `DATAFORSEO_PASSWORD` | DataForSEO password |

**How to get:**
1. Sign up at [dataforseo.com](https://dataforseo.com)
2. Go to API section
3. Copy credentials

### Keywords Everywhere (keywords-everywhere)

| Key | Description |
|-----|-------------|
| `KEYWORDS_EVERYWHERE_API_KEY` | Keywords Everywhere API key |

**How to get:**
1. Sign up at [keywords.ai](https://keywords.ai)
2. Go to Settings > API
3. Create API key

### Plausible (plausible)

| Key | Description |
|-----|-------------|
| `PLAUSIBLE_API_KEY` | Plausible API key |
| `PLAUSIBLE_SITE_ID` | Site ID from your Plausible dashboard |

**How to get:**
1. Sign up at [plausible.io](https://plausible.io)
2. Go to Settings > API
3. Copy API key

### Mixpanel (mixpanel)

| Key | Description |
|-----|-------------|
| `MIXPANEL_TOKEN` | Mixpanel project token |
| `MIXPANEL_SECRET` | Mixpanel service account secret |

**How to get:**
1. Sign up at [mixpanel.com](https://mixpanel.com)
2. Go to Project Settings > Service Accounts
3. Create service account

### Amplitude (amplitude)

| Key | Description |
|-----|-------------|
| `AMPLITUDE_API_KEY` | Amplitude API key |
| `AMPLITUDE_SECRET_KEY` | Amplitude secret key |

**How to get:**
1. Sign up at [amplitude.com](https://amplitude.com)
2. Go to Settings > API Keys
3. Create API key

### Hotjar (hotjar)

| Key | Description |
|-----|-------------|
| `HOTJAR_SITE_ID` | Hotjar site ID |
| `HOTJAR_API_TOKEN` | Hotjar API token |

**How to get:**
1. Sign up at [hotjar.com](https://hotjar.com)
2. Go to Sites & Organizations
3. Copy Site ID
4. Go to Settings > API to generate token

### Optimizely (optimizely)

| Key | Description |
|-----|-------------|
| `OPTIMIZELY_SDK_KEY` | Optimizely Feature SDK key |
| `OPTIMIZELY_ACCESS_TOKEN` | Optimizely Personal access token |

**How to get:**
1. Sign up at [optimizely.com](https://optimizely.com)
2. Go to Settings > API
3. Create Personal Access Token

### HubSpot (hubspot)

| Key | Description |
|-----|-------------|
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app access token |

**How to get:**
1. Sign up at [hubspot.com](https://hubspot.com)
2. Go to Settings > Integrations > Private Apps
3. Create new private app
4. Copy access token

### Salesforce (salesforce)

| Key | Description |
|-----|-------------|
| `SALESFORCE_CLIENT_ID` | Salesforce connected app client ID |
| `SALESFORCE_CLIENT_SECRET` | Connected app client secret |
| `SALESFORCE_USERNAME` | Salesforce username |
| `SALESFORCE_PASSWORD` | Salesforce password |
| `SALESFORCE_SECURITY_TOKEN` | Salesforce security token |

**How to get:**
1. Go to Salesforce Setup
2. Create Connected App
3. Enable OAuth settings
4. Reset security token (if needed)

### Close (close)

| Key | Description |
|-----|-------------|
| `CLOSE_API_KEY` | Close API key |

**How to get:**
1. Sign up at [close.com](https://close.com)
2. Go to Settings > API
3. Create new API key

### Outreach (outreach)

| Key | Description |
|-----|-------------|
| `OUTREACH_ACCESS_TOKEN` | Outreach OAuth access token |
| `OUTREACH_REFRESH_TOKEN` | Outreach OAuth refresh token |

**How to get:**
1. Sign up at [outreach.io](https://outreach.io)
2. Go to Settings > Integrations > API
3. Create API credentials

### Crossbeam (crossbeam)

| Key | Description |
|-----|-------------|
| `CROSSBEAM_API_KEY` | Crossbeam API key |

**How to get:**
1. Sign up at [crossbeam.com](https://crossbeam.com)
2. Go to Settings > API
3. Create API key

### Apollo (apollo)

| Key | Description |
|-----|-------------|
| `APOLLO_API_KEY` | Apollo API key |

**How to get:**
1. Sign up at [apollo.io](https://apollo.io)
2. Go to Settings > Integrations > API
3. Copy API key

### Clearbit (clearbit)

| Key | Description |
|-----|-------------|
| `CLEARBIT_API_KEY` | Clearbit API key |

**How to get:**
1. Sign up at [clearbit.com](https://clearbit.com)
2. Go to Settings > API Keys
3. Create new API key

### ZoomInfo (zoominfo)

| Key | Description |
|-----|-------------|
| `ZOOMINFO_ACCESS_TOKEN` | ZoomInfo API access token |

**How to get:**
1. Sign up at [zoominfo.com](https://zoominfo.com)
2. Go to Settings > API Access
3. Generate token

### Clay (clay)

| Key | Description |
|-----|-------------|
| `CLAY_API_KEY` | Clay API key |

**How to get:**
1. Sign up at [clay.com](https://clay.com)
2. Go to Settings > Developer
3. Copy API key

### Segment (segment)

| Key | Description |
|-----|-------------|
| `SEGMENT_WRITE_KEY` | Segment write key |

**How to get:**
1. Sign up at [segment.com](https://segment.com)
2. Go to Settings > API Keys
3. Copy write key

---

## Setting Up in OpenClaw

After obtaining your API keys, you can configure them in `~/.openclaw/openclaw.json`:

```json
{
  "env": {
    "BUFFER_API_KEY": "your-buffer-key",
    "GA4_ACCESS_TOKEN": "your-ga4-token",
    "GA4_PROPERTY_ID": "123456789",
    "RESEND_API_KEY": "your-resend-key",
    "MAILCHIMP_API_KEY": "your-mailchimp-key",
    "MAILCHIMP_SERVER_PREFIX": "us1",
    "SENDGRID_API_KEY": "your-sendgrid-key",
    "KIT_API_KEY": "your-kit-key",
    "DUB_API_KEY": "your-dub-key",
    "SEMRUSH_API_KEY": "your-semrush-key",
    "AHREFS_API_KEY": "your-ahrefs-key",
    "MIXPANEL_TOKEN": "your-mixpanel-token",
    "AMPLITUDE_API_KEY": "your-amplitude-key",
    "HOTJAR_SITE_ID": "your-hotjar-site-id",
    "HUBSPOT_ACCESS_TOKEN": "your-hubspot-token",
    "CLOSE_API_KEY": "your-close-key",
    "APOLLO_API_KEY": "your-apollo-key",
    "CLEARBIT_API_KEY": "your-clearbit-key",
    "CLAY_API_KEY": "your-clay-key",
    "SEGMENT_WRITE_KEY": "your-segment-key"
  }
}
```

Or run `./install-abra.sh` interactively to be prompted for each key.
