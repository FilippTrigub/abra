# Provider Validation — Findings & Fix Plan

## Summary

28 provider files in `skills/_providers/marketing/` were audited.  
12 pass. 16 have issues across three severity levels.

---

## Critical — Broken Auth

### gsc.mjs
**Problem:** Code reads `GSC_ACCESS_TOKEN` (undocumented, expires in 1h). SETUP.md specifies `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN`.  
**Fix:** Add refresh token → access token exchange, same pattern as `google-ads.mjs`.

### hotjar.mjs
**Problem:** Implements a full OAuth2 client credentials flow using `HOTJAR_CLIENT_ID`/`HOTJAR_CLIENT_SECRET`. Hotjar's API does not use OAuth — it uses a personal bearer token (`HOTJAR_API_TOKEN`) directly.  
**Fix:** Remove OAuth machinery. Read `HOTJAR_SITE_ID` and `HOTJAR_API_TOKEN`, use token as `Authorization: Bearer`.

### optimizely.mjs
**Problem:** Reads `OPTIMIZELY_API_KEY` (not documented). Should be `OPTIMIZELY_ACCESS_TOKEN`.  
**Fix:** Rename env var.

### salesforce.mjs
**Problem:** Reads static `SALESFORCE_ACCESS_TOKEN` and `SALESFORCE_INSTANCE_URL` (neither documented). SETUP.md specifies the OAuth password grant flow using `CLIENT_ID`, `CLIENT_SECRET`, `USERNAME`, `PASSWORD`, `SECURITY_TOKEN`.  
**Fix:** Implement password grant: POST to `https://login.salesforce.com/services/oauth2/token` to get a fresh access token + instance URL per call.

### ga4.mjs
**Problem:** Reads `GA4_ACCESS_TOKEN` as a static env var — service account tokens expire in 1 hour.  
**Fix:** Switch to refresh token flow (`GA4_CLIENT_ID`, `GA4_CLIENT_SECRET`, `GA4_REFRESH_TOKEN`). Update SETUP.md and install scripts accordingly. Remove `GA4_ACCESS_TOKEN`.

### zoominfo.mjs
**Problem:** Reads `ZOOMINFO_ACCESS_TOKEN` as a static env var — ZoomInfo JWTs expire in 1 hour.  
**Fix:** Add `ZOOMINFO_USERNAME` + `ZOOMINFO_PASSWORD`. Generate JWT via POST to `/authenticate` at call time. Remove `ZOOMINFO_ACCESS_TOKEN`.

---

## Medium — Behavioural Bugs

### outreach.mjs
**Problem:** Uses `OUTREACH_ACCESS_TOKEN` only. Token expires in 24h with no refresh path.  
**Fix:** Add refresh token exchange using `OUTREACH_CLIENT_ID`, `OUTREACH_CLIENT_SECRET`, `OUTREACH_REFRESH_TOKEN`. Same pattern as google-ads.mjs.

### mailchimp.mjs
**Problem:** Ignores `MAILCHIMP_SERVER_PREFIX`. Extracts data center by splitting the API key on `-` — breaks if key format changes.  
**Fix:** Read `MAILCHIMP_SERVER_PREFIX` env var directly; fall back to parsing only if not set.

### kit.mjs
**Problem:** References undocumented `KIT_API_SECRET`. SETUP.md only documents `KIT_API_KEY`. Creates confusing dual auth paths.  
**Fix:** Remove `KIT_API_SECRET` references. Use `KIT_API_KEY` only (Kit v3 API key is sufficient for all operations).

### apollo.mjs
**Problem:** `checkKey()` not called in `getCompany()` and `searchPeople()`. Missing early validation.  
**Fix:** Add `checkKey()` call at the start of all exported methods.

### segment.mjs
**Problem:** `checkKey()` is defined but never called. Missing validation entirely.  
**Fix:** Add `checkKey()` call at the start of all exported methods.

---

## Minor — Dead Code / Style

### hubspot.mjs
**Problem:** `HUBSPOT_PORTAL_ID` read from env at line 4 but never used.  
**Fix:** Remove the line.

### dataforseo.mjs
**Problem:** Base64 auth string computed once at module load. Harmless but inconsistent with other providers where auth is computed inside functions.  
**Fix:** Move auth computation inside `api()`.

---

## Env Var Changes Required

| Old var | New var(s) | Provider |
|---------|-----------|---------|
| `GA4_ACCESS_TOKEN` | `GA4_CLIENT_ID`, `GA4_CLIENT_SECRET`, `GA4_REFRESH_TOKEN` | ga4 |
| `ZOOMINFO_ACCESS_TOKEN` | `ZOOMINFO_USERNAME`, `ZOOMINFO_PASSWORD` | zoominfo |
| `OUTREACH_ACCESS_TOKEN` (static) | `OUTREACH_CLIENT_ID`, `OUTREACH_CLIENT_SECRET`, `OUTREACH_REFRESH_TOKEN` | outreach |
| `HOTJAR_CLIENT_ID`, `HOTJAR_CLIENT_SECRET` | `HOTJAR_SITE_ID`, `HOTJAR_API_TOKEN` | hotjar |
| `OPTIMIZELY_API_KEY` | `OPTIMIZELY_ACCESS_TOKEN` | optimizely |
| `SALESFORCE_ACCESS_TOKEN`, `SALESFORCE_INSTANCE_URL` | use existing `SALESFORCE_CLIENT_ID/SECRET/USERNAME/PASSWORD/SECURITY_TOKEN` | salesforce |

---

## Files Passing (no changes needed)

amplitude, plausible, resend, sendgrid, dub, ahrefs, semrush, keywords-everywhere,
clearbit, clay, crossbeam, close, mixpanel, google-ads
