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
| `RUNTIME_ENV_ENCRYPTION_KEY` | Server-only AES-256-GCM key used to encrypt user-managed runtime env values before Firestore storage |
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
  brand-profile/current      # Generated onboarding brand profile, hydrated into BRAND.md
  agent-config/current        # AgentConfig: telegramBotToken, telegramHomeChannel
  runtime-env/current         # Active encrypted user-managed skill/API env values
    versions/{versionId}      # Immutable encrypted snapshots for rollback and desired/applied version tracking
    audit/{eventId}           # Runtime env save/import/delete/rollback events, with redacted metadata
  deployments/{deploymentId}  # DashboardDeployment records
```

The active runtime env document path is `accounts/{authUserId}/runtime-env/current`. Version and audit records intentionally live in subcollections below that document: `accounts/{authUserId}/runtime-env/current/versions/{versionId}` and `accounts/{authUserId}/runtime-env/current/audit/{eventId}`. This keeps every Firestore document reference valid.

Runtime env values are saved from Settings for user-managed skill/API keys such as Buffer, GIPHY, Freesound, Pixabay, and Telegram. Plaintext is accepted only on server actions, encrypted before Firestore writes, and never returned to the browser after save or import. Browser responses contain redacted summaries with key names, source, version metadata, timestamps, and fingerprints only.

Onboarding saves the user's brand profile at `accounts/{authUserId}/brand-profile/current`. This document contains the user's concise brand description plus generated Markdown. It is not part of the encrypted runtime-env store because it is non-secret runtime context, not an API key. During deploy/update, the platform reads the current brand profile and writes it into the generated ConfigMap as `BRAND.md`.

`RUNTIME_ENV_ENCRYPTION_KEY` is required server-only configuration for the platform process. It must not be exposed through `NEXT_PUBLIC_*`, checked into docs as key material, or sent to the runtime container.

Legacy agent config is still supported for Telegram. If runtime env does not contain Telegram values, the platform falls back to `agent-config/current`; `TELEGRAM_ALLOWED_USERS` uses `telegramAllowedUsers` when present and falls back to `telegramHomeChannel` when the old allowlist field is absent.

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
- **Secret** — `abra-{accountId}-{deploymentId}-secrets` — contains `.env` plus registry-designated direct Secret keys for supported runtime env values
- **StatefulSet** — `abra-{accountId}-{deploymentId}` — runs the Hermes Abra image; init container hydrates the Hermes profile before main container starts
- **Service** — ClusterIP on port 18789
- **PVC** — 1 GiB for Hermes profile data persistence (mounted at `/opt/data`)

The init container (same Abra image, s6-overlay ENTRYPOINT overridden by `command`) hydrates the PVC-backed `/opt/data/profiles/abra/` before the main container starts with `gateway run`:

- copies Hermes `config.yaml` to `/opt/data/profiles/abra/config.yaml`
- copies Hermes `auth.json` to `/opt/data/profiles/abra/auth.json` and sets `0600` permissions
- copies Secret-backed `.env` to `/opt/data/profiles/abra/.env`
- copies `/opt/abra/SOUL.md` to `/opt/data/profiles/abra/SOUL.md` (Abra persona)
- copies `/opt/abra/WORKFLOW.md` and `/opt/abra/AGENTS.md` to `…/profiles/abra/workspace/`
- copies ConfigMap-backed `BRAND.md`, when present, to both `…/profiles/abra/BRAND.md` and `…/profiles/abra/workspace/BRAND.md` so brand-manager and workspace-level workflows can read the user's onboarding profile
- copies `/opt/abra/skills/` to `…/profiles/abra/skills/abra/` (all 33 Abra skills)

`/opt/abra/` is baked into the image at build time via `Dockerfile.hermes` (`COPY SOUL.md`, `COPY skills/`, etc.). No network access is required at pod start.

`HERMES_HOME` is set to `/opt/data/profiles/abra` (profile-mode) so Hermes treats the abra profile as its working home. The main container name is `hermes`; the volume name is `hermes-data`.

The StatefulSet also exposes selected Secret keys directly as process env vars for the main container. User-managed runtime env values from Settings drive the generated Secret `.env`, direct Secret keys where the registry allows them, StatefulSet env refs, and the Hermes `terminal.env_passthrough` allowlist (see "Terminal backend and env forwarding" below).

Runtime env changes use the existing AKS update path. The platform patches the generated runtime Secret and related pod template, then relies on the StatefulSet rollout to restart pods. Already-running container environment variables do not hot reload, so saved Settings values become live after the update and rollout complete.

### Container Registry — `abraacr914f`

- **Login server**: `abraacr914f.azurecr.io`
- **SKU**: Standard
- **Repository**: `abra` (single repo)
- **Current deployed tag**: `hermes-202606111342-38def30` (set via `AKS_RUNTIME_IMAGE` in Vercel / the StatefulSet image in AKS)
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
kubectl set image statefulset/<sts-name> hermes=abraacr914f.azurecr.io/abra:<tag> init-hydration=abraacr914f.azurecr.io/abra:<tag> -n abra
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

The deployed Hermes container receives these env vars through the same runtime env pipeline used by other skill/API keys. They are exposed directly from the Kubernetes Secret and also written into the hydrated profile `.env`:

| Env var | Source | Description |
|---------|--------|-------------|
| `TELEGRAM_BOT_TOKEN` | Firestore `runtime-env/current`, falling back to `agent-config/current.telegramBotToken` | Token from @BotFather |
| `TELEGRAM_HOME_CHANNEL` | Firestore `runtime-env/current`, falling back to `agent-config/current.telegramHomeChannel` | Channel/chat ID where the runtime operates |
| `TELEGRAM_ALLOWED_USERS` | Firestore `runtime-env/current`, falling back to `agent-config/current.telegramAllowedUsers` or `telegramHomeChannel` | Comma-separated user/chat IDs authorized to use the bot |

These are set in platform Settings and injected into the runtime Secret at deploy or runtime-env update time. If required Telegram values are missing, deployment is blocked at the server action level. Old `agent-config/current` Telegram values remain a fallback for existing users until they save the newer runtime env settings.

**Precedence trap (found 2026-06-18):** `loadRuntimeEnvForOrchestrationWithTelegramCompat()` (`platform/src/lib/runtime-env/telegram-compat.ts`) only falls back to `agent-config/current` for a given Telegram key (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_HOME_CHANNEL`, `TELEGRAM_ALLOWED_USERS`) when `runtime-env/current` has **no** value for that key at all — not when the value is stale. If `runtime-env/current` already has a `TELEGRAM_BOT_TOKEN` entry from an old import, updating the bot token via the **Bot Setup card** (which writes to `agent-config/current`) is silently shadowed: the dashboard reports success, redeploys run, but the orchestration layer keeps resolving the old runtime-env value with zero indication to the user. This cost an entire debugging session before the stale runtime-env entry was found via `node /tmp/inspect-runtime-env.mjs`-style fingerprint comparison (compare `accounts/{authUserId}/runtime-env/current.values.TELEGRAM_BOT_TOKEN.fingerprint`'s `updatedAt` against whatever you just saved). Fix: delete the stale key from `runtime-env/current` so the agent-config fallback applies again.

**`deleteRuntimeEnvKey` used to not actually delete the active value (fixed in code 2026-06-29):** `persistNewSnapshot()` in `platform/src/lib/runtime-env/service.ts` previously wrote the active document via `firestore.doc(currentDocPath).set(activeDocument, { merge: true })`. Firestore's `merge: true` does not remove nested map keys that are simply absent from the new object — it only adds/overwrites keys present in the payload. So `deleteRuntimeEnvKey()` returned `success: true`, wrote a version/audit record showing the key removed, but the **live `runtime-env/current.values` map still contained the "deleted" key** with its old encrypted value, and orchestration kept using it. Confirmed by direct test: calling the real `deleteRuntimeEnvKey()` for `TELEGRAM_BOT_TOKEN` reported success: true, yet `values.TELEGRAM_BOT_TOKEN` was unchanged on the active document afterward; only an explicit `docRef.update({ "values.TELEGRAM_BOT_TOKEN": FieldValue.delete() })` actually removed it. The code fix changed the active document write to full document replacement (`set(activeDocument)`) so delete and rollback snapshots replace the whole active `values` map while preserving the `versions/` and `audit/` subcollections. Deploy the platform before relying on the Settings UI's delete/rollback actions in production.

### User-managed skill/API env vars

Settings also lets users manage supported skill/API env vars without editing Kubernetes resources directly. Saved values are encrypted in Firestore at `accounts/{authUserId}/runtime-env/current`, with immutable snapshots under `current/versions/{versionId}` and redacted audit events under `current/audit/{eventId}`.

The runtime manifest generator reads decrypted values only on the server for orchestration. It writes supported values into the generated Secret `.env`, direct Secret keys where the registry marks them safe for direct env refs, the StatefulSet container env, and Hermes `terminal.env_passthrough`. The browser only sees redacted summaries and fingerprints after save.

### Terminal backend and env forwarding

The deployed Hermes runtime has no Docker-in-Docker available (the image installs no `docker` binary/daemon, and no `docker.sock` is mounted), so it always runs the **`local`** terminal backend — `terminal.backend` is intentionally left unset in the generated `config.yaml` and Hermes defaults that to `local` (`hermes_cli/doctor.py` explicitly detects this container-mode case and logs "using local terminal backend (docker-in-docker is not configured by default)").

The `local` backend (`tools/environments/local.py`) strips any env var classified as a Hermes-managed provider credential (`_HERMES_PROVIDER_ENV_BLOCKLIST`, derived from `PROVIDER_REGISTRY.api_key_env_vars` plus a hardcoded messaging/tool list) from every skill/terminal subprocess, unless the var is listed in `terminal.env_passthrough` or a skill's own `SKILL.md` frontmatter declares it via `required_environment_variables`. `terminal.docker_forward_env` is read **only** by the Docker backend (`tools/environments/docker.py`) and has **no effect** on this deployment — it mirrors the local dev profile (`~/.hermes/profiles/abra/config.yaml`, which genuinely uses `terminal.backend: docker`) but doesn't apply here.

`manifest-generator.ts`'s `buildHermesProfileConfig()` therefore emits **both** `docker_forward_env` and `env_passthrough` with the same key list (`SUPPORTED_RUNTIME_ENV_DEFINITIONS` filtered by `injectAsProcessEnv`) — `env_passthrough` is what actually matters for the runtime as deployed today; `docker_forward_env` is kept only so forwarding keeps working if the backend is ever switched to `docker`.

**Hard exception — `GH_TOKEN` and `HF_TOKEN` can never be allowlisted.** `tools/env_passthrough.py`'s `_is_hermes_provider_credential()` check (added for **GHSA-rhgp-j443-p4rf**) refuses to honor `terminal.env_passthrough` — or a skill's `required_environment_variables` — for any name already in `_HERMES_PROVIDER_ENV_BLOCKLIST`. `GH_TOKEN` and `HF_TOKEN` are both in that blocklist (`GH_TOKEN` via a hardcoded entry, `HF_TOKEN` via `PROVIDER_REGISTRY` in `hermes_cli/auth.py`), so listing them in `env_passthrough` is silently ignored — confirmed by direct test on 2026-06-17 (`hermes chat -q "..."` inside a live pod reported both as unset to its own terminal tool, despite both being present in the container's process env and correctly listed in the hydrated `config.yaml`). This is intentional upstream hardening, not an Abra bug, and is not fixable from platform config. `GH_TOKEN` has no practical impact today since every `github-*` skill is disabled (see "Hermes skill management" below). `HF_TOKEN` does matter — several active Abra media skills (`image-captioner`, `photo-picker`, `bokeh-effect`, `image-generator`, `video-editor`, `animate-image`, `music-generator`, `audio-transcriber`, `video-captioner`, `media-analyzer`) read it via a skill-local `hf_token_env` field (default `"HF_TOKEN"`, see `skills/_providers/config.py`'s `DEFAULT_HF_TOKEN_ENV`). Because that field is configurable per-skill rather than a hardcoded literal, the only viable workaround is forwarding the user's HF token under a **non-blocklisted alias env var** (e.g. `ABRA_HF_TOKEN`) and pointing `hf_token_env` at the alias — not yet implemented.

All other supported runtime env keys (everything in `SUPPORTED_RUNTIME_ENV_DEFINITIONS` except the two above) are **not** in `_HERMES_PROVIDER_ENV_BLOCKLIST` and pass through to terminal/skill subprocesses unconditionally, with or without `env_passthrough` — confirmed by direct test (`BRAVE_API_KEY`, `BUFFER_API_KEY`, `FREESOUND_API_KEY` all visible to a live chat session's terminal tool on 2026-06-17). The thing that actually has to work is getting the value into the pod's process env in the first place — see "Root cause: create-flow runtime env loss" below.

### Root cause: create-flow runtime env loss (fixed 2026-06-17)

Every fix prior to this one (env_passthrough, docker_forward_env, loading runtime env in `dispatchDeploymentRequest`) addressed real gaps but missed the actual reason **brand-new** deployments came up with only `TELEGRAM_*` and `AZURE_FOUNDRY_API_KEY` (the Vercel-level fallback) in the generated Secret, with all other user-managed runtime env values silently dropped:

- `AksOrchestrationAdapter.create()` only persists a **queued** operation; it does not call any Kubernetes API itself. The actual `ensureConfigMap`/`ensureSecret`/`ensureStatefulSet` calls happen later, across multiple `getStatus()` polls.
- The operation payload persisted by `create()` is sanitized by `sanitizePayloadForPersistence()`, which replaces the full decrypted `runtimeEnv` map with `runtimeEnvRef: "account-current"` (so plaintext secrets never sit in the durable operation store) — exactly mirroring what it does for `agentConfig` → `agentConfigRef`.
- `getStatus()` already re-resolved `agentConfigRef` back into real Telegram values via `resolveAgentConfigForOperation()` before generating manifests. There was **no equivalent resolver for `runtimeEnvRef`** — `buildManifestInput()` just called `readRuntimeEnv(payload)`, which only ever saw the literal string `"account-current"`, so it returned `undefined` for every key except the two paths that don't depend on `payload.runtimeEnv` at all (Telegram via `agentConfig`, Azure Foundry via the `AZURE_FOUNDRY_API_KEY` process env fallback).
- `update()` (settings → "Apply now") was never affected because it builds manifests from the original unsanitized payload *before* persisting the sanitized copy, then applies them synchronously in the same call — which is why "Apply now" worked while a fresh "Deploy" did not.

Fix (`platform/src/lib/orchestration/aks-adapter.ts`): added `resolveRuntimeEnvForOperation()`, the `runtimeEnv` analog of `resolveAgentConfigForOperation()` — if the payload doesn't carry a live `runtimeEnv` map and the persisted payload has `runtimeEnvRef: "account-current"`, it re-decrypts the account's current runtime env via `loadRuntimeEnvForOrchestrationWithTelegramCompat()` before manifest generation in `getStatus()`. Regression test: `aks-adapter-create-flow.test.ts` → "re-resolves account-current runtime env during create reconciliation...".

Verified end-to-end against production on 2026-06-17: deployed a fresh instance via the live dashboard, confirmed all 28 saved runtime env keys landed in the generated K8s Secret (`kubectl get secret ... -o jsonpath='{.data}'`), confirmed they're present in the running container's process env (`kubectl exec ... env`), and confirmed via `hermes chat -q "..."` inside the pod that the agent's own terminal tool sees the non-blocklisted ones (see exception above for the two that never will).

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
| Bot logs perpetual `Telegram polling conflict (1/5)` warnings that never escalate or resolve, even after a full pod delete + cooldown + recreate | The cloud token is also configured on a **local** Hermes profile. `gateway/platforms/telegram.py`'s `_handle_polling_conflict` resets its retry counter to 0 on every successful `start_polling()`, so two real pollers sharing one token both log "(1/5)" forever and never reach the fatal-error escalation — a cold restart of either side alone won't fix it. Confirm by hashing both tokens (`sha256sum`) and comparing: pod token via `kubectl exec <pod> -n abra -- sh -lc 'printf %s "$TELEGRAM_BOT_TOKEN" \| sha256sum'`, local profile token via `grep '^TELEGRAM_BOT_TOKEN=' ~/.hermes/profiles/<profile>/.env \| sed 's/^TELEGRAM_BOT_TOKEN=//' \| tr -d '"' \| sha256sum`. Also check `systemctl --user list-units '*hermes-gateway*'` for any local gateway service holding the same token. Fix: point the local profile's `.env` at its own bot token (not production's) and `systemctl --user restart hermes-gateway-<profile>.service`. |
| Updated Telegram Bot Token in Settings (Bot Setup card) + redeployed, but the wrong/old token is still live in the pod | `runtime-env/current` has a stale `TELEGRAM_BOT_TOKEN` from an earlier import that's shadowing the `agent-config` value you just saved — see "Precedence trap" under "Telegram runtime contract". Check with `node /tmp/inspect-runtime-env.mjs`-style read of `accounts/{authUserId}/runtime-env/current.values.TELEGRAM_BOT_TOKEN.updatedAt`; if it predates your save, that's the cause. The Settings UI's own "Delete" button won't clear it either — see the `deleteRuntimeEnvKey` merge bug in the same section; fix requires a direct `FieldValue.delete()` on `values.TELEGRAM_BOT_TOKEN`, then patch the K8s Secret's `TELEGRAM_BOT_TOKEN` key and the `env` blob, then `kubectl rollout restart statefulset/<sts-name> -n abra`. |
| Provider authentication failed | Most likely cause: `AZURE_FOUNDRY_API_KEY` missing from Vercel → manifest generator emits empty credential pool → init container overwrites the profile's `auth.json` with an empty one on every pod start. Verify with `vercel env ls production \| grep AZURE_FOUNDRY`, then check `kubectl get secret … -o jsonpath='{.data.AZURE_FOUNDRY_API_KEY}' \| base64 -d \| sha256sum` matches `db1ad608e95d1843`. To recover the raw key: `az cognitiveservices account keys list --name azure-openai-746596 --resource-group SonaAndAtla --query key1 -o tsv` |
| Image error | Verify `AKS_RUNTIME_IMAGE` in Vercel dashboard → Settings → Env Vars |
| K8s auth failing | Check `KUBECONFIG_B64` is current in Vercel; re-export from AKS if expired |
| Skill/terminal command can't see a saved API key | First check it actually reached the pod: `kubectl exec <pod> -n abra -- env \| grep KEY_NAME`. If absent, the value never made it into the Secret — check `kubectl get secret <secret-name> -n abra -o jsonpath='{.data}'` for the key; if it's missing there too on a **freshly created** (not updated) deployment, the platform predates the create-flow `runtimeEnvRef` resolution fix (see "Root cause: create-flow runtime env loss") — redeploy after upgrading. If the key **is** in the pod's process env but a skill/terminal command still reports it unset, check whether it's `GH_TOKEN` or `HF_TOKEN` — these are permanently blocked from subprocess passthrough by Hermes's own `_HERMES_PROVIDER_ENV_BLOCKLIST` (GHSA-rhgp-j443-p4rf) and `env_passthrough` cannot override that (see "Terminal backend and env forwarding"). For any other key, check `kubectl exec <pod> -n abra -- grep -A3 env_passthrough /opt/data/profiles/abra/config.yaml` for the missing entry. |
| New image to deploy | Build via `az acr build -f Dockerfile.hermes`, update `AKS_RUNTIME_IMAGE` in Vercel, then `kubectl set image` both `hermes` and `init-hydration` containers on the StatefulSet |

Useful safe checks, with secret values redacted manually before sharing output:

```bash
kubectl get pods -n abra -l app=abra -o wide
kubectl get configmap -n abra <configmap-name> -o jsonpath='{.data.config\.yaml}{"\n---AUTH---\n"}{.data.auth\.json}{"\n"}'
kubectl get secret -n abra <secret-name> -o jsonpath='{.data.AZURE_FOUNDRY_API_KEY}' | base64 -d | sha256sum
kubectl exec -n abra <pod-name> -- sh -lc 'test -n "$AZURE_FOUNDRY_API_KEY" && printf %s "$AZURE_FOUNDRY_API_KEY" | sha256sum'
kubectl exec -n abra <pod-name> -- sh -lc 'ls -l /opt/data/profiles/abra/auth.json /opt/data/profiles/abra/.env'
```
