# Cloud Setup

This document describes the full cloud topology for Abra so future debugging starts with accurate context.

---

## Overview

Three planes:

| Plane | Service | Purpose |
|-------|---------|---------|
| **Platform UI** | Vercel (Next.js) | Dashboard for deploying/managing Abra instances |
| **Auth + Config DB** | Firebase (Firestore) | User auth, agent config, deployment records |
| **Runtime** | Azure AKS | Runs the OpenClaw/Abra container per user deployment |

---

## Vercel — Platform UI

- **Project**: `abra-platform` (org: `trigub-tech`)
- **Project ID**: `prj_MS1g3jQ2SzC7kpr1uJRhIXQJhk2L`
- **Framework**: Next.js (App Router)
- **URL**: `abra-platform.vercel.app` (production)

### Production environment variables

| Variable | Purpose |
|----------|---------|
| `AKS_RUNTIME_IMAGE` | Container image to deploy on AKS (e.g. `abraacr914f.azurecr.io/abra:<tag>`) |
| `AKS_RUNTIME_NAMESPACE` | K8s namespace for runtime pods (default: `abra`) |
| `KUBECONFIG_B64` | Base64-encoded kubeconfig for the AKS cluster |
| `AZURE_TENANT_ID` | Azure AD tenant for workload identity auth |
| `AZURE_CLIENT_ID` | Managed identity client ID for AKS access |
| `AZURE_FEDERATED_TOKEN_FILE` | Path to federated token file (workload identity) |
| `ORCHESTRATION_BACKEND` | Set to `aks` in production; `mock` for local dev |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK private key |
| `NEXT_PUBLIC_FIREBASE_*` | Client-side Firebase config (API key, app ID, etc.) |

### Image resolution precedence (in `aks-adapter.ts`)

```
payload.image  →  AKS_RUNTIME_IMAGE  →  ABRA_RUNTIME_IMAGE  →  error
```

`KUBECONFIG_B64` is decoded to a temp file at runtime so Vercel (no persistent filesystem) can reach the AKS cluster.

---

## Firebase

- **Project**: `abra-89a44`
- **Auth domain**: `abra-89a44.firebaseapp.com`
- **Services in use**: Authentication, Firestore

### Firestore schema

```
accounts/{userId}/
  agent-config/current        # AgentConfig: telegramBotToken, telegramHomeChannel
  deployments/{deploymentId}  # DashboardDeployment records
```

Agent config is required before any deployment is allowed. The platform reads it at dispatch time and injects it into the K8s secret. Backward compat: if `telegramAllowedUsers` exists in Firestore (old field name), it is read as `telegramHomeChannel`.

---

## Azure

- **Subscription**: Microsoft Azure Sponsorship (`05ca12e3-c728-48d9-a349-8b5f6b011bfe`)
- **Tenant**: `709e87f2-17d5-4d58-8085-a4a169ae0a5b`
- **Resource group**: `abra-rg-foundation`
- **Region**: North Europe (`northeurope`)

### AKS cluster — `abra-aks`

| Property | Value |
|----------|-------|
| Kubernetes version | 1.34.7 |
| Node pool | `system` — `Standard_D4s_v5` × 1 |
| Identity | SystemAssigned |
| OIDC issuer | enabled |
| Workload identity | enabled |

**Runtime namespace**: `abra` (default, overridable via `AKS_RUNTIME_NAMESPACE`)

Each user deployment creates a set of K8s resources in that namespace:

- **Namespace** — `abra`
- **ConfigMap** — `abra-{accountId}-{deploymentId}-config` — contains the legacy `openclaw.json` compatibility config
- **Secret** — `abra-{accountId}-{deploymentId}-secrets` — contains `.env` plus direct Secret keys for `TELEGRAM_BOT_TOKEN`, `TELEGRAM_HOME_CHANNEL`, and `TELEGRAM_ALLOWED_USERS`
- **StatefulSet** — `abra-{accountId}-{deploymentId}` — runs the Hermes Abra image; init container hydrates the Hermes profile and legacy `~/.openclaw` compatibility files before main container starts
- **Service** — ClusterIP on port 18789
- **PVC** — 1 GiB for `~/.openclaw` persistence

The init container (`busybox:latest`) writes a minimal Hermes profile under the PVC-backed runtime home, copies `.env` into both Hermes and legacy OpenClaw-compatible locations, then the main container starts with `gateway run`.

### Container Registry — `abraacr914f`

- **Login server**: `abraacr914f.azurecr.io`
- **SKU**: Standard
- **Repository**: `abra` (single repo)
- **Current deployed tag**: `hermes-202606092229-3277038` (set via `AKS_RUNTIME_IMAGE` in Vercel / the StatefulSet image in AKS)
- An ACR task `purge-old-images` runs to clean up old tags.

To check the current image in use:
```bash
vercel env ls  # look for AKS_RUNTIME_IMAGE
```

To push a new image:
```bash
az acr build -r abraacr914f -t abra:<tag> -f Dockerfile.hermes .
# Then update AKS_RUNTIME_IMAGE in Vercel and redeploy
```

### PostgreSQL — `abra-psql`

- **SKU**: Standard_B1ms (Burstable)
- **Version**: PostgreSQL 16
- **Storage**: 32 GB
- **State**: Ready

Not currently wired into the platform UI or OpenClaw runtime (provisioned for future use).

### Service Bus — `abra-sbns`

- **SKU**: Standard
- **Queues**: none configured yet

Provisioned for future async job dispatch.

### Storage Account — `abrastapp914f`

- **Kind**: StorageV2
- **SKU**: Standard_GRS (geo-redundant)
- **HTTPS only**: yes

### Key Vault — `abra-kv`

- **SKU**: Standard
- **Secrets**: none currently populated via CLI

---

## Telegram runtime contract

The deployed Hermes container receives these env vars directly from the Kubernetes Secret and also gets them in the hydrated profile `.env`:

| Env var | Source | Description |
|---------|--------|-------------|
| `TELEGRAM_BOT_TOKEN` | Firestore `agent-config/current.telegramBotToken` | Token from @BotFather |
| `TELEGRAM_HOME_CHANNEL` | Firestore `agent-config/current.telegramHomeChannel` | Channel/chat ID where the runtime operates (e.g. `388259993`) |
| `TELEGRAM_ALLOWED_USERS` | Firestore `agent-config/current.telegramAllowedUsers`, falling back to `telegramHomeChannel` | Comma-separated user/chat IDs authorized to use the bot |

These are set in the platform Settings → Telegram setup card and injected into the K8s Secret at deploy time. If either is missing, the deployment is blocked at the server action level.

---

## Debugging quick-reference

| Problem | Where to look |
|---------|--------------|
| Deployment stuck / failed | Firestore `accounts/{userId}/deployments/{id}` — `errorMessage` field |
| Pod not starting | `kubectl get pods -n abra` / `kubectl describe pod <name> -n abra` |
| Init container failing | `kubectl logs <pod> -n abra -c init-hydration` |
| Bot says user is not authorized | Check `TELEGRAM_ALLOWED_USERS` is set in the pod env/Secret, then redeploy or update the StatefulSet |
| Bot not responding | Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_HOME_CHANNEL` are set in Settings, then redeploy |
| Image error | Verify `AKS_RUNTIME_IMAGE` in Vercel dashboard → Settings → Env Vars |
| K8s auth failing | Check `KUBECONFIG_B64` is current in Vercel; re-export from AKS if expired |
| New image to deploy | Build via `az acr build -f Dockerfile.hermes`, update `AKS_RUNTIME_IMAGE` in Vercel, then run update/redeploy or patch the StatefulSet image |
