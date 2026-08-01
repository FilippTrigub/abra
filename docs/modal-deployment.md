# Modal GPU deployment

Modal runs Abra's seven optional GPU media skills through the `abra-media` app.
It is an alternative to the existing RunPod endpoints, not a replacement.

## Deploy

1. Build and push the existing `filipptri/abra-*` images as documented for
   RunPod. Modal reuses them to keep dependencies and CLI behavior identical.
2. Create the `abra-remote-b2` Modal Secret with
   `BACKBLAZE_B2_REMOTE_KEY_ID`, `BACKBLAZE_B2_REMOTE_APPLICATION_KEY`, and
   `BACKBLAZE_B2_REMOTE_BUCKET_NAME`.
3. Run `modal deploy modal_apps/abra_media.py`. This creates one function and
   one model-cache Volume per supported skill.
4. Set `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, and
   `ABRA_REMOTE_GPU_PROVIDER=modal` in the runtime that executes the skill.
   Set a skill config to `"provider": "remote"`, or use `"provider": "modal"`
   to select it explicitly.

Managed Abra deployments receive these credentials from platform environment
defaults. Self-hosted deployments use their own Modal service-user credentials
and pay Modal directly.

## GPU policy

Light image/audio functions prefer L4 then T4; video matte/interpolation prefer
L40S then A10; video editing prefers A100 80GB then H100. Each function starts
with one maximum concurrent container, so cache initialization is predictable.
