# Cloud Setup

This document describes the full cloud topology for Abra so future debugging starts with accurate context.

---

## Overview

Three planes:

| Plane | Service | Purpose |
|-------|---------|---------|
| **Platform UI** | Vercel (Next.js) | Dashboard for deploying/managing Abra instances |
| **Auth + Config DB** | Firebase (Firestore) | User auth, agent config, deployment records |
| **Runtime** | Azure AKS | Runs the Hermes/Abra container per user deployment |

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
| `AZURE_FOUNDRY_API_KEY` | Azure Foundry/OpenAI API key injected into the Abra runtime Secret for `provider: azure-foundry` |
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
- **ConfigMap** — `abra-{accountId}-{deploymentId}-config` — contains Hermes `config.yaml` and `auth.json`
- **Secret** — `abra-{accountId}-{deploymentId}-secrets` — contains `.env` plus direct Secret keys for `TELEGRAM_BOT_TOKEN`, `TELEGRAM_HOME_CHANNEL`, `TELEGRAM_ALLOWED_USERS`, and `AZURE_FOUNDRY_API_KEY`
- **StatefulSet** — `abra-{accountId}-{deploymentId}` — runs the Hermes Abra image; init container hydrates the Hermes profile before main container starts
- **Service** — ClusterIP on port 18789
- **PVC** — 1 GiB for Hermes profile data persistence (mounted at `/opt/data`)

The init container (same Abra image, s6-overlay ENTRYPOINT overridden by `command`) hydrates the PVC-backed `/opt/data/profiles/abra/` before the main container starts with `gateway run`:

- copies Hermes `config.yaml` to `/opt/data/profiles/abra/config.yaml`
- copies Hermes `auth.json` to `/opt/data/profiles/abra/auth.json` and sets `0600` permissions
- copies Secret-backed `.env` to `/opt/data/profiles/abra/.env`
- copies `/opt/abra/SOUL.md` to `/opt/data/profiles/abra/SOUL.md` (Abra persona)
- copies `/opt/abra/WORKFLOW.md` and `/opt/abra/AGENTS.md` to `…/profiles/abra/workspace/`
- copies `/opt/abra/skills/` to `…/profiles/abra/skills/abra/` (all 33 Abra skills)

`/opt/abra/` is baked into the image at build time via `Dockerfile.hermes` (`COPY SOUL.md`, `COPY skills/`, etc.). No network access is required at pod start.

`HERMES_HOME` is set to `/opt/data/profiles/abra` (profile-mode) so Hermes treats the abra profile as its working home. The main container name is `hermes`; the volume name is `hermes-data`.

The StatefulSet also exposes selected Secret keys directly as process env vars for the main container.

### Container Registry — `abraacr914f`

- **Login server**: `abraacr914f.azurecr.io`
- **SKU**: Standard
- **Repository**: `abra` (single repo)
- **Current deployed tag**: `hermes-202606110807-ba7befd` (set via `AKS_RUNTIME_IMAGE` in Vercel / the StatefulSet image in AKS)
- **Image contents** (on top of `nousresearch/hermes-agent:latest`): `curl`, `jq`, `golang-go`, `libcairo2-dev`, `libpango1.0-dev`, `ffmpeg`, TeX Live (latex-base, fonts-recommended, latex-extra, science, dvisvgm, dvipng), `manim` (installed into `/opt/hermes/.venv`)
- An ACR task `purge-old-images` runs to clean up old tags.

To check the current image in use:
```bash
vercel env ls  # look for AKS_RUNTIME_IMAGE
```

To retrieve the Azure Foundry API key (lives in the `SonaAndAtla` resource group, not `abra-rg-foundation`):
```bash
az cognitiveservices account keys list --name azure-openai-746596 --resource-group SonaAndAtla --query key1 -o tsv
```

To push a new image:
```bash
az acr build -r abraacr914f -t abra:<tag> -f Dockerfile.hermes .
# Then update AKS_RUNTIME_IMAGE in Vercel and patch the StatefulSet:
vercel env rm AKS_RUNTIME_IMAGE production --yes && vercel env add AKS_RUNTIME_IMAGE production <<< "abraacr914f.azurecr.io/abra:<tag>"
kubectl set image statefulset/<sts-name> openclaw=abraacr914f.azurecr.io/abra:<tag> init-hydration=abraacr914f.azurecr.io/abra:<tag> -n abra
```

Note: `platform/node_modules`, `platform/.next`, `skills/**/output`, and `skills/**/node_modules` are excluded from the build context via `.dockerignore`.

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

## Hermes skill management

The generated `config.yaml` disables all default Hermes built-in skills so only Abra's own skills (hydrated into `…/skills/abra/` by the init container) are available to the agent.

Default skills live in `/opt/hermes/skills/` inside the base image. Hermes reads `skills.disabled` from the active profile's `config.yaml` and suppresses those entries at load time (`hermes_cli/skills_config.py`).

The disabled list is maintained in `buildHermesProfileConfig()` in `platform/src/lib/orchestration/manifest-generator.ts` and is emitted into the ConfigMap on every deployment. To re-enable a skill, remove it from that list and redeploy.

Disabled skills (38 total):

| Category | Skills |
|----------|--------|
| GitHub / software dev | `github-pr-workflow`, `github-code-review`, `github-issues`, `github-repo-management`, `codebase-inspection`, `test-driven-development`, `systematic-debugging`, `requesting-code-review`, `simplify-code`, `spike` |
| AI agent / Hermes | `hermes-agent`, `claude-code`, `codex`, `opencode`, `hermes-agent-skill-authoring` |
| Productivity | `google-workspace`, `notion`, `airtable`, `powerpoint`, `ocr-and-documents`, `nano-pdf`, `maps`, `teams-meeting-pipeline` |
| Research / ML | `arxiv`, `blogwatcher`, `polymarket`, `llm-wiki`, `research-paper-writing`, `huggingface-hub`, `llama-cpp`, `vllm`, `weights-and-biases`, `jupyter-live-kernel` |
| Other | `obsidian`, `himalaya`, `openhue`, `yuanbao`, `dogfood`, `godmode` |

---

## Azure Foundry provider contract

Abra's deployed Hermes runtime uses Azure Foundry as the default model provider:

```yaml
model:
  default: gpt-5.5
  provider: azure-foundry
  base_url: https://azure-openai-746596.openai.azure.com/openai/v1
  api_mode: chat_completions
```

That model config alone is not enough. Hermes also needs a credential-pool entry in the hydrated profile auth file and the actual key in the runtime environment.

### Required live state

| Location | Required value |
|----------|----------------|
| Vercel env | `AZURE_FOUNDRY_API_KEY` must be set on the platform process that generates AKS manifests |
| K8s Secret | `AZURE_FOUNDRY_API_KEY` direct key plus an `AZURE_FOUNDRY_API_KEY=...` line in Secret-backed `env` |
| StatefulSet container env | `AZURE_FOUNDRY_API_KEY` must be present via `secretKeyRef` |
| Hermes profile `.env` | `/openclaw-home/.hermes/profiles/abra/.env` must contain `AZURE_FOUNDRY_API_KEY=...` |
| Hermes profile `auth.json` | `/openclaw-home/.hermes/profiles/abra/auth.json` must include `credential_pool.azure-foundry` with `source: env:AZURE_FOUNDRY_API_KEY` |

Expected `auth.json` shape:

```json
{
  "version": 1,
  "providers": {},
  "active_provider": null,
  "credential_pool": {
    "azure-foundry": [
      {
        "id": "19b47d",
        "label": "AZURE_FOUNDRY_API_KEY",
        "auth_type": "api_key",
        "priority": 0,
        "source": "env:AZURE_FOUNDRY_API_KEY",
        "base_url": "",
        "secret_fingerprint": "sha256:<first-16-hex-of-key-sha256>"
      }
    ],
    "custom:azure": []
  }
}
```

For the current production key, the expected redacted fingerprint is:

```text
sha256:db1ad608e95d1843
```

Do not store the raw key in `auth.json` or the ConfigMap. The raw value belongs only in Vercel env, the Kubernetes Secret, and Secret-hydrated `.env` / process env.

---

## Debugging quick-reference

| Problem | Where to look |
|---------|--------------|
| Deployment stuck / failed | Firestore `accounts/{userId}/deployments/{id}` — `errorMessage` field |
| Pod not starting | `kubectl get pods -n abra` / `kubectl describe pod <name> -n abra` |
| Init container failing | `kubectl logs <pod> -n abra -c init-hydration` |
| Agent has no Abra skills / wrong persona | Check `kubectl logs <pod> -n abra -c init-hydration` for "Abra SOUL.md hydrated" and "Abra skills hydrated"; if missing, image predates the `/opt/abra` bake-in — rebuild from `Dockerfile.hermes`. Profile lives at `/openclaw-home/.hermes/profiles/abra/` |
| Bot says user is not authorized | Check `TELEGRAM_ALLOWED_USERS` is set in the pod env/Secret, then redeploy or update the StatefulSet |
| Bot not responding | Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_HOME_CHANNEL` are set in Settings, then redeploy |
| Provider authentication failed | Most likely cause: `AZURE_FOUNDRY_API_KEY` missing from Vercel → manifest generator emits empty credential pool → init container overwrites the profile's `auth.json` with an empty one on every pod start. Verify with `vercel env ls production \| grep AZURE_FOUNDRY`, then check `kubectl get secret … -o jsonpath='{.data.AZURE_FOUNDRY_API_KEY}' \| base64 -d \| sha256sum` matches `db1ad608e95d1843`. To recover the raw key: `az cognitiveservices account keys list --name azure-openai-746596 --resource-group SonaAndAtla --query key1 -o tsv` |
| Image error | Verify `AKS_RUNTIME_IMAGE` in Vercel dashboard → Settings → Env Vars |
| K8s auth failing | Check `KUBECONFIG_B64` is current in Vercel; re-export from AKS if expired |
| New image to deploy | Build via `az acr build -f Dockerfile.hermes`, update `AKS_RUNTIME_IMAGE` in Vercel, then `kubectl set image` both `openclaw` and `init-hydration` containers on the StatefulSet |

Useful safe checks, with secret values redacted manually before sharing output:

```bash
kubectl get pods -n abra -l app=abra -o wide
kubectl get configmap -n abra <configmap-name> -o jsonpath='{.data.config\.yaml}{"\n---AUTH---\n"}{.data.auth\.json}{"\n"}'
kubectl get secret -n abra <secret-name> -o jsonpath='{.data.AZURE_FOUNDRY_API_KEY}' | base64 -d | sha256sum
kubectl exec -n abra <pod-name> -- sh -lc 'test -n "$AZURE_FOUNDRY_API_KEY" && printf %s "$AZURE_FOUNDRY_API_KEY" | sha256sum'
kubectl exec -n abra <pod-name> -- sh -lc 'ls -l /opt/data/profiles/abra/auth.json /opt/data/profiles/abra/.env'
```
