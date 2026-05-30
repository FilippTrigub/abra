# Telegram Bot Token — Config Injection

Implemented on 2026-05-30.

---

## What was built

End-to-end wiring so a user can enter their Telegram bot token in the dashboard, and it is automatically injected into the running OpenClaw runtime when they deploy.

---

## Problem it solves

The AKS deployment was technically working (pod starts, health check passes), but the runtime had no configuration — OpenClaw started with `{"gateway":{"mode":"local"}}` and an empty secret. There was nowhere for the user to enter credentials, and nothing to carry them into the pod.

This change closes the full loop:
**User enters token → stored in Firestore → read at deploy time → injected into K8s Secret + ConfigMap → OpenClaw reads it on startup**

---

## Architecture

### Storage — `platform/src/lib/agent-config/`

New module following the same pattern as `lib/settings/`.

- **`types.ts`**: `AgentConfig { telegramBotToken: string }`
- **`service.ts`**: Firestore CRUD at `accounts/{authUserId}/agent-config/current`
  - `loadAgentConfig(uid)` — returns `null` if not set
  - `saveAgentConfig(uid, config)` — upserts with server timestamp
  - `hasAgentConfig(uid)` — convenience boolean
- **`actions.ts`**: Next.js server actions (`"use server"`) for the settings UI
  - `loadUserAgentConfig()` → `{ configured, token }`
  - `saveUserAgentConfig(token)` → `{ success, error? }`

The token is stored as plaintext in Firestore. Access is via Admin SDK only (server-side) — the client never reads it directly.

### UI — Settings page

New `BotSetupCard` component at `app/(dashboard)/dashboard/settings/bot-setup-card.tsx`:
- Password input for the token (masked, with show/hide toggle)
- "Configured" (success) / "Not set" (warning) badge
- "Save token" button with inline feedback
- Anchored at `#bot-setup` for deep-linking

Rendered above the preferences form in `settings/page.tsx`.

### Dashboard gate — `app/(dashboard)/dashboard/page.tsx`

Loads `hasAgentConfig(user.id)` in parallel with the deployment feed. Passes `hasToken` prop to `DeploymentConsole`.

When `hasToken === false` and no deployment exists:
- Deploy form is hidden
- Shows "Connect your Telegram bot before deploying" prompt with a link to `/dashboard/settings#bot-setup`

### Manifest injection — `lib/orchestration/manifest-generator.ts`

The `ManifestInput` interface now accepts `agentConfig?: { telegramBotToken?: string }`.

**ConfigMap** (`openclaw.json`): when a token is present, the channel config is emitted using env-var substitution (token stays out of ConfigMap):
```json
{
  "gateway": { "mode": "local" },
  "channels": {
    "telegram": {
      "accounts": {
        "default": { "botToken": "${TELEGRAM_BOT_TOKEN}" }
      }
    }
  }
}
```

**Secret** (`env` key): when a token is present:
```
TELEGRAM_BOT_TOKEN=<actual value>
```

This keeps the plaintext token in the Kubernetes Secret (encrypted at rest in etcd) rather than the ConfigMap.

### Init container `.env` bug fix

The init container was copying `/secrets/env` → `/openclaw-home/.openclaw/env` (no dot prefix). OpenClaw reads `~/.openclaw/.env` (with the dot). Fixed to:
```sh
cp /secrets/env /openclaw-home/.openclaw/.env
```

Without this fix, env vars in the Secret were never loaded by OpenClaw, so env-var substitution in `openclaw.json` would throw `MissingEnvVarError` on startup.

### Deployment flow

- `dispatchDeploymentRequest` now calls `loadAgentConfig(authUserId)` before dispatching and includes the result in the operation payload
- `buildManifestInput` in `aks-adapter.ts` reads `payload.agentConfig` and forwards it to `generateKubernetesManifests`

---

## How to verify

1. Go to Settings → enter a token → "Configured" badge appears
2. Dashboard → "Deploy Abra" button is now visible
3. Deploy → check K8s:
   ```bash
   kubectl get secret -n abra <secret-name> -o jsonpath='{.data.env}' | base64 -d
   # → TELEGRAM_BOT_TOKEN=<your token>
   
   kubectl exec -n abra <pod> -c openclaw -- cat /openclaw-home/.openclaw/.env
   # → TELEGRAM_BOT_TOKEN=<your token>
   ```
4. Telegram bot should respond once the runtime reaches `succeeded`

---

## What is NOT included (v1 scope)

- **Config sync without redeploy** — changing the token after deployment requires destroy + redeploy. The ConfigMap and Secret are only populated at create time.
- **Token encryption** — stored plaintext in Firestore. Acceptable for v1 (server-side Admin SDK only). Future: encrypt before write.
- **Other API keys** — Anthropic/OpenAI keys come from Vercel env vars (Azure Cognitive Services deployment), not user config.
- **Multiple Telegram accounts** — single default account only.
