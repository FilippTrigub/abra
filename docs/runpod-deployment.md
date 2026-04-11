# RunPod Serverless Deployment Guide

End-to-end process for building, pushing, and deploying the 7 GPU skill endpoints.

---

## Prerequisites

- Docker installed and running
- `docker login` completed (Docker Hub account: `filipptri`)
- RunPod account with API key in `.env`
- Backblaze B2 `runpod-staging` bucket credentials in `backblaze.backup.env`
- RunPod MCP server connected in Claude Code (`claude mcp add runpod ...`)

---

## Image hierarchy

```
runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04  (public, ~12 GB, zero upload cost)
  └── filipptri/abra-base:latest          (ffmpeg + runpod + b2sdk + pillow + numpy)
        ├── filipptri/abra-background-remover:latest   (+ rembg[gpu])
        ├── filipptri/abra-bokeh-effect:latest         (+ torchvision + timm + opencv)
        ├── filipptri/abra-audio-splitter:latest       (+ demucs)
        ├── filipptri/abra-frame-interpolator:latest   (+ torchvision)
        ├── filipptri/abra-photo-picker:latest         (+ transformers)
        ├── filipptri/abra-video-matte:latest          (+ rembg[gpu])
        └── filipptri/abra-video-editor:latest         (+ diffusers + transformers + accelerate + rembg[cpu])
```

---

## Step 1 — Build and push Docker images

```bash
# Full build + push (sequential, ~2.5–3 hours first time)
./scripts/build-push-images.sh

# Rebuild a single skill after code changes (fast — only top layer changes)
./scripts/build-push-images.sh background-remover

# Build without pushing (inspect size first)
PUSH=0 ./scripts/build-push-images.sh

# Skip images already on Docker Hub
SKIP_EXISTING=1 ./scripts/build-push-images.sh
```

Build logs are written to `.build-logs/<skill>.log`.

**Docker Hub billing:** public repos are free — no storage or bandwidth charges.

---

## Step 2 — Create network volume

Via RunPod MCP (Claude Code):

```
Create a network volume named "abra-models", 100 GB, in EU-RO-1
```

Or via RunPod dashboard: Storage → Network Volumes → Create.

**Existing volume:** `abra-models` (ID: `3crir735fr`, EU-RO-1, 100 GB)

The volume stores all ML model caches so they persist across workers. Model cache directories are redirected via env vars set in `docker/base/Dockerfile`:

| Env var | Library | Path on volume |
|---|---|---|
| `HF_HOME` | HuggingFace / transformers / diffusers | `/runpod-volume/models/huggingface` |
| `TORCH_HOME` | torch.hub + torchvision pretrained | `/runpod-volume/models/torch` |
| `U2NET_HOME` | rembg ONNX models | `/runpod-volume/models/u2net` |
| `DEMUCS_HOME` | Demucs | `/runpod-volume/models/demucs` |

---

## Step 3 — Create templates

One template per skill. Each template references the Docker image and injects B2 staging credentials as env vars.

Via RunPod MCP (Claude Code) or replicate via dashboard (Serverless → Templates → New):

| Template | Image | Container disk |
|---|---|---|
| `abra-background-remover` | `filipptri/abra-background-remover:latest` | 20 GB |
| `abra-bokeh-effect` | `filipptri/abra-bokeh-effect:latest` | 20 GB |
| `abra-audio-splitter` | `filipptri/abra-audio-splitter:latest` | 20 GB |
| `abra-frame-interpolator` | `filipptri/abra-frame-interpolator:latest` | 20 GB |
| `abra-photo-picker` | `filipptri/abra-photo-picker:latest` | 20 GB |
| `abra-video-matte` | `filipptri/abra-video-matte:latest` | 30 GB |
| `abra-video-editor` | `filipptri/abra-video-editor:latest` | 50 GB |

**Env vars on every template:**
```
BACKBLAZE_B2_RUNPOD_KEY_ID       = <from backblaze.backup.env>
BACKBLAZE_B2_RUNPOD_APPLICATION_KEY = <from backblaze.backup.env>
BACKBLAZE_B2_RUNPOD_BUCKET_NAME  = runpod-staging
```

**Existing template IDs:**

| Skill | Template ID |
|---|---|
| background-remover | `kazm8e9xpy` |
| bokeh-effect | `0ob6qzd1kk` |
| audio-splitter | `djc8idbnrx` |
| frame-interpolator | `ncvtihu5nj` |
| photo-picker | `n0z33sy8nl` |
| video-matte | `4arzysl5hu` |
| video-editor | `0wj9erd4cg` |

---

## Step 4 — Create endpoints

One serverless endpoint per skill. All in EU-RO-1 to match the network volume.

**Settings:**
- `workersMin: 0` — scale to zero, no idle cost
- `workersMax: 1` — single concurrent worker (account quota: 10 total)
- `flashboot: true` — enabled by default, reduces cold start

**Existing endpoint IDs** (written to `.env`):

| Skill | Endpoint ID | GPU types | Env var |
|---|---|---|---|
| background-remover | `t1xlmkea18edxu` | RTX 3090 / RTX 4090 / A4000 | `RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER` |
| bokeh-effect | `q5npokaq53qjr8` | RTX 3090 / RTX 4090 / A4000 | `RUNPOD_ENDPOINT_ID_BOKEH_EFFECT` |
| audio-splitter | `5le2gljgpvpud7` | RTX 3090 / RTX 4090 / A4000 | `RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER` |
| frame-interpolator | `phnesxqpzumon4` | RTX 3090 / RTX 4090 / A4000 | `RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR` |
| photo-picker | `ksx2q8myfdh6sh` | RTX 3090 / RTX 4090 / A4000 | `RUNPOD_ENDPOINT_ID_PHOTO_PICKER` |
| video-matte | `y673g8e0j5uo8z` | RTX 3090 / A5000 / A40 | `RUNPOD_ENDPOINT_ID_VIDEO_MATTE` |
| video-editor | `xq3umj90slrb8s` | A100 80GB PCIe / SXM | `RUNPOD_ENDPOINT_ID_VIDEO_EDITOR` |

---

## Step 5 — Attach network volume ⚠️ MANUAL STEP

The RunPod MCP does not expose `networkVolumeId` on endpoint creation. This must be done via the dashboard:

1. Go to [RunPod Serverless](https://www.runpod.io/console/serverless)
2. For **each of the 7 endpoints**: click Edit → Network Volume → select `abra-models` → Save
3. Verify the volume path is `/runpod-volume`

Without this step, model caches redirect to `/runpod-volume/models` on container-local disk — models re-download on every cold start.

---

## Step 6 — Model warm-up (first run per skill)

The first job on a fresh worker downloads models to the volume. Subsequent workers reuse them.

Run the e2e test for background-remover first (fastest, ~170 MB model):

```bash
cd tests
.venv/bin/python -m pytest test_runpod_e2e.py::TestRunpodBackgroundRemover -v
```

Then the others in order of model size:
```bash
.venv/bin/python -m pytest test_runpod_e2e.py -v
```

---

## Updating images after code changes

```bash
# Rebuild and push only the changed skill
./scripts/build-push-images.sh background-remover

# RunPod pulls the new image automatically on the next cold start
# (no endpoint config change needed — images are pulled by tag :latest)
```

To force immediate pickup, restart the endpoint via dashboard or MCP:
```
Update endpoint <id> — no changes needed, just triggers a redeploy
```

---

## GPU availability note

RunPod EU-RO-1 can experience GPU shortages (RTX 3090 / 4090 / A4000 stock varies). Jobs may queue for extended periods. If this happens, use **fal.ai** as an alternative provider — see [remote-inference.md](./remote-inference.md#falai-serverless).

> ⚠️ fal.ai custom container deployment requires a one-time permission grant at https://fal.ai/dashboard/serverless-get-started before `fal deploy` will work.

---

## Cost summary

| Resource | Cost |
|---|---|
| Network volume (100 GB) | ~$7/month fixed |
| Endpoints (all 7, idle) | $0 (scale to zero) |
| Per job — light skills (bg-remover, bokeh, etc.) | ~$0.004–0.012 |
| Per job — audio-splitter | ~$0.012 |
| Per job — frame-interpolator | ~$0.015 |
| Per job — video-matte | ~$0.05 |
| Per job — video-editor (VACE, A100 80GB) | ~$0.17+ |
