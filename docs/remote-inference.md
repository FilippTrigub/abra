# Remote Inference Guide

This repo supports **optional remote inference** for selected skills.

## Principles

- Local mode remains the default
- Remote providers are opt-in only
- Missing credentials fail fast
- There is no silent fallback from remote to local

## Providers

| Provider | Variable | Skills |
|----------|----------|--------|
| HuggingFace | `HF_TOKEN` | audio-transcriber, image-captioner, image-generator |
| Replicate | `REPLICATE_API_TOKEN` | audio-transcriber, image-captioner, image-generator, music-generator |
| RunPod | `RUNPOD_API_KEY` + per-skill endpoint ID | video-editor, video-matte, frame-interpolator, bokeh-effect, background-remover, audio-splitter, photo-picker |
| fal.ai ⚠️ | `FAL_KEY` + per-skill app ID | video-editor, video-matte, frame-interpolator, bokeh-effect, background-remover, audio-splitter, photo-picker |

> **fal.ai requires explicit permission grant** before you can deploy custom serverless apps.
> Visit https://fal.ai/dashboard/serverless-get-started and enable access for your account first.

---

## HuggingFace / Replicate

Set the provider in the skill's `config.json`:

```json
{ "provider": "huggingface" }
```

```bash
export HF_TOKEN=hf_your_token
export REPLICATE_API_TOKEN=r8_your_token
```

### Skill support

| Skill | HuggingFace | Replicate | Notes |
|-------|-------------|-----------|-------|
| `audio-transcriber` | Yes | Yes | Same JSON transcription artifact |
| `image-captioner` | Yes | Yes | Same JSON sidecar artifact |
| `video-captioner` | Yes | Yes | Remote transcription only; rendering remains local |
| `image-generator` | Yes | Yes | Same timestamped PNG output pattern |
| `music-generator` | No | Yes | HuggingFace music generation is unsupported in wave 1 |

---

## RunPod Serverless

RunPod runs the full skill inside a GPU container in the cloud. Input and output
files are staged through a dedicated Backblaze B2 bucket.

### How it works

```
Local machine          Backblaze B2 (runpod-staging)    RunPod worker (EU-RO-1)
─────────────          ─────────────────────────────    ───────────────────────
upload input  ───────► input files                   ─► download input
                                                         run skill CLI on GPU
                       ◄─────────────────────────────── upload output
download output ◄──────  output files
```

### Setup

**1. Create the B2 staging bucket (one-time):**
```bash
b2 create-bucket runpod-staging allPrivate
```

**2. Deploy Docker images to RunPod (one-time per skill):**
```bash
# From repo root:
docker build -f docker/video-editor/Dockerfile -t filipptri/abra-video-editor:latest .
docker push filipptri/abra-video-editor:latest
# Repeat for each skill
```

**3. Deploy Serverless endpoints on RunPod dashboard (one-time):**
- Region: EU-RO-1
- Network Volume: attach the shared 100 GB model-weights volume
- Set endpoint env vars: `BACKBLAZE_B2_RUNPOD_KEY_ID`, `BACKBLAZE_B2_RUNPOD_APPLICATION_KEY`, `BACKBLAZE_B2_RUNPOD_BUCKET_NAME`
- Note the endpoint ID for each skill

**4. Configure via install script:**
```bash
bash install-abra.sh
# Follow prompts for RunPod API key, endpoint IDs, and B2 staging credentials
```

Or set env vars directly in `openclaw.json`:
```json
{
  "env": {
    "RUNPOD_API_KEY": "...",
    "RUNPOD_ENDPOINT_ID_VIDEO_EDITOR": "abc123",
    "RUNPOD_ENDPOINT_ID_VIDEO_MATTE": "def456"
  }
}
```

### Enabling RunPod for a skill

Change `provider` in the skill's `config.json`:
```json
{ "provider": "runpod" }
```

Or pass it as a CLI argument (skills that support it):
```bash
python scripts/vace.py --input ./input --output ./output --prompt "..." 
# (with provider=runpod in config.json)
```

### Skill support

| Skill | Min VRAM | Docker image | Endpoint env var |
|-------|----------|-------------|------------------|
| `video-editor` | 8 GB | `filipptri/abra-video-editor` | `RUNPOD_ENDPOINT_ID_VIDEO_EDITOR` |
| `video-matte` | 3 GB | `filipptri/abra-video-matte` | `RUNPOD_ENDPOINT_ID_VIDEO_MATTE` |
| `frame-interpolator` | 2 GB | `filipptri/abra-frame-interpolator` | `RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR` |
| `bokeh-effect` | 2 GB | `filipptri/abra-bokeh-effect` | `RUNPOD_ENDPOINT_ID_BOKEH_EFFECT` |
| `background-remover` | 2 GB | `filipptri/abra-background-remover` | `RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER` |
| `audio-splitter` | 2 GB | `filipptri/abra-audio-splitter` | `RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER` |
| `photo-picker` | 2 GB | `filipptri/abra-photo-picker` | `RUNPOD_ENDPOINT_ID_PHOTO_PICKER` |

### Environment variables

| Variable | Purpose | Where stored |
|----------|---------|--------------|
| `RUNPOD_API_KEY` | RunPod authentication | `openclaw.json env` |
| `RUNPOD_ENDPOINT_ID_{SKILL}` | Per-skill endpoint ID | `openclaw.json env` |
| `BACKBLAZE_B2_RUNPOD_KEY_ID` | B2 staging bucket key | `runpod-b2-staging.env` |
| `BACKBLAZE_B2_RUNPOD_APPLICATION_KEY` | B2 staging bucket app key | `runpod-b2-staging.env` |
| `BACKBLAZE_B2_RUNPOD_BUCKET_NAME` | B2 staging bucket name | `runpod-b2-staging.env` |

---

---

## fal.ai Serverless

fal.ai runs the same skill Docker images as a serverless GPU app. Unlike RunPod, there is **no B2 staging bucket** — input and output files travel via fal's own CDN.

> ⚠️ **Permission required.** fal.ai custom serverless deployment is not available on all accounts by default.
> Visit https://fal.ai/dashboard/serverless-get-started and enable access before attempting to deploy.

### How it works

```
Local machine         fal CDN                          fal GPU worker
─────────────         ───────                          ──────────────
upload input ───────► fal.media URL                ─► download input
                                                       run skill CLI on GPU
                      ◄─────────────────────────────── upload output
download output ◄───── fal.media URL
```

No Backblaze B2 credentials needed. File transfers go through fal's CDN automatically.

### Setup

**1. Authenticate fal CLI (one-time):**
```bash
fal auth login
```

**2. Enable serverless access (one-time, manual):**
Visit https://fal.ai/dashboard/serverless-get-started and enable custom container access for your account.

**3. Deploy each skill handler:**
```bash
# From repo root — deploy one skill at a time
fal deploy skills/background-remover/fal_handler.py
fal deploy skills/bokeh-effect/fal_handler.py
fal deploy skills/audio-splitter/fal_handler.py
fal deploy skills/frame-interpolator/fal_handler.py
fal deploy skills/photo-picker/fal_handler.py
fal deploy skills/video-matte/fal_handler.py
fal deploy skills/video-editor/fal_handler.py
```

Each command prints an app ID (e.g. `filipptri/background-remover-app`). Copy it into `.env`:

```bash
FAL_APP_ID_BACKGROUND_REMOVER=filipptri/background-remover-app
FAL_APP_ID_BOKEH_EFFECT=filipptri/bokeh-effect-app
# etc.
```

**4. Set FAL_KEY in `.env`:**
```bash
FAL_KEY="your_fal_api_key"
```
The key is the same value as `FAL_API_KEY` — fal's Python client reads `FAL_KEY` specifically.

### Enabling fal.ai for a skill

Change `provider` in the skill's `config.json`:
```json
{ "provider": "fal" }
```

### Skill support

| Skill | Machine type | fal handler | App ID env var |
|-------|-------------|-------------|----------------|
| `background-remover` | GPU | `skills/background-remover/fal_handler.py` | `FAL_APP_ID_BACKGROUND_REMOVER` |
| `bokeh-effect` | GPU | `skills/bokeh-effect/fal_handler.py` | `FAL_APP_ID_BOKEH_EFFECT` |
| `audio-splitter` | GPU | `skills/audio-splitter/fal_handler.py` | `FAL_APP_ID_AUDIO_SPLITTER` |
| `frame-interpolator` | GPU | `skills/frame-interpolator/fal_handler.py` | `FAL_APP_ID_FRAME_INTERPOLATOR` |
| `photo-picker` | GPU | `skills/photo-picker/fal_handler.py` | `FAL_APP_ID_PHOTO_PICKER` |
| `video-matte` | GPU | `skills/video-matte/fal_handler.py` | `FAL_APP_ID_VIDEO_MATTE` |
| `video-editor` | GPU-A100 | `skills/video-editor/fal_handler.py` | `FAL_APP_ID_VIDEO_EDITOR` |

### Environment variables

| Variable | Purpose | Where stored |
|----------|---------|--------------|
| `FAL_KEY` | fal.ai authentication (read by fal_client) | `.env` |
| `FAL_APP_ID_{SKILL}` | Per-skill deployed app ID | `.env` |

### Cost comparison vs RunPod

| Metric | RunPod | fal.ai |
|--------|--------|--------|
| Idle cost | $0 (scale to zero) + $7/mo network volume | $0 (scale to zero, no volume) |
| Light GPU job (RTX equiv.) | ~$0.004–0.015 | ~$0.005–0.015 |
| A100 job (video-editor) | ~$0.17+ | ~$0.25+ (A100 40GB @ $0.99/hr) |
| B2 staging bucket | Required | Not needed |
| Cold start | 30–90s (FlashBoot) | ~250ms |
| GPU availability | Can queue (EU-RO-1 has shortages) | Better multi-region availability |
| Custom containers | ✅ | ✅ (requires permission) |

### Updating after code changes

```bash
# Redeploy only the changed skill
fal deploy skills/background-remover/fal_handler.py
# fal pulls the latest image automatically on next invocation
```

---

## Wave 1 Limitations

- No provider auto-discovery
- No silent fallback to local mode
- No caching layer
- No streaming support
- No HuggingFace music generation
- RunPod B2 staging files are not automatically cleaned up (use B2 lifecycle rules)
