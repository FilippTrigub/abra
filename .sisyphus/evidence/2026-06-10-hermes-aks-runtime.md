# Hermes AKS runtime deployment evidence — 2026-06-10

## Image build

- Built and pushed Hermes image to ACR: `abraacr914f.azurecr.io/abra:hermes-202606092229-3277038`
- ACR repository/tag verification returned: `hermes-202606092229-3277038`
- First `az acr build` attempt with the full repo context failed because the uploaded context was ~1.3 GiB; the successful build used a minimal temporary context containing only `Dockerfile.hermes`.

## Live AKS runtime

- Cluster: `abra-aks`
- Resource group: `abra-rg-foundation`
- Namespace: `abra`
- StatefulSet: `abra-fjyqatlmasrvefkf0g6lgajz9gv2-abra-instance`
- Pod: `abra-fjyqatlmasrvefkf0g6lgajz9gv2-abra-instance-0`

Final validation:

```text
Running ready=true restarts=0 image=abraacr914f.azurecr.io/abra:hermes-202606092229-3277038
TELEGRAM_BOT_TOKEN=present
TELEGRAM_HOME_CHANNEL=present
TELEGRAM_ALLOWED_USERS=present
HERMES_HOME=present
```

Secret key validation, without values:

```text
TELEGRAM_ALLOWED_USERS:  9 bytes
TELEGRAM_BOT_TOKEN:      46 bytes
TELEGRAM_HOME_CHANNEL:   9 bytes
env:                     131 bytes
```

## Fixes discovered during deployment

- Kubernetes must pass Hermes `gateway run` as container `args`, not `command`; `command` overrides the image entrypoint and fails with `exec: "gateway": executable file not found in $PATH`.
- Hermes runs as UID/GID `10000`; hydration must chown the PVC-backed Hermes/OpenClaw compatibility directories to `10000:10000`, not `1000:1000`.
- The OpenClaw HTTP probes on `localhost:18789/health` are not valid for the Hermes gateway process and caused liveness restarts. The Hermes runtime now omits those probes.
- The live Firestore Telegram config had `telegramAllowedUsers` and `telegramBotToken`, but no separate `telegramHomeChannel`; the live runtime used the allowlist value as the home-channel fallback so all three env vars are present.

## Platform config

- Vercel production env `AKS_RUNTIME_IMAGE` was updated to the Hermes ACR image.
