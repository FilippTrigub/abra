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
bash ./installers/install-abra-on-openclaw.sh
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

## Wave 1 Limitations

- No provider auto-discovery
- No silent fallback to local mode
- No caching layer
- No streaming support
- No HuggingFace music generation
- RunPod B2 staging files are not automatically cleaned up (use B2 lifecycle rules)
