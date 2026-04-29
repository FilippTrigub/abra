---
name: video-generator
description: >-
  Generate videos from text or images using Higgsfield's multi-model cloud
  platform. Supports Kling 3.0, Sora 2, Veo 3.1, Wan 2.5, Seedance 2.0, and
  MiniMax Hailuo. Auto-detects text-to-video or image-to-video based on input.
  No GPU required.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎥",
        "requires": { "bins": ["uv"], "env": ["HF_API_KEY"] },
        "primaryEnv": "HF_API_KEY",
      },
  }
---

# video-generator — Multi-Model Cloud Video (Higgsfield)

Generates video clips via [Higgsfield](https://higgsfield.ai) — a platform that
aggregates 6+ leading models under one API and billing account. Choose the right
model for cost vs. quality tradeoff; the rest of the interface is identical.

The skill directory (where this SKILL.md lives) is referred to as `$SKILL_DIR` below.

> **Cloud-based.** No local GPU required. Requires a Higgsfield account and API
> key from [cloud.higgsfield.ai](https://cloud.higgsfield.ai).

---

## Modes

| Mode | Trigger | What happens |
|------|---------|--------------|
| `text-to-video` | No images in `input/` | Generates video from prompt alone |
| `image-to-video` | Images present in `input/` | Animates each image into a clip |
| `auto` (default) | — | Picks the mode above automatically |

---

## Models

| Key | Full model ID | Best for |
|-----|--------------|----------|
| `kling` (default) | `kling-video/v2.1/pro/image-to-video` | Realistic motion, cost-efficient |
| `seedance` | `bytedance/seedance/v1/pro/image-to-video` | Native audio sync |
| `dop` | `higgsfield-ai/dop/standard` | Cinema Studio optical physics |
| `dop-preview` | `higgsfield-ai/dop/preview` | Cinema Studio (preview tier) |

> These are the model IDs confirmed in the official docs. Additional models (Sora,
> Veo, Wan, etc.) can be found at [cloud.higgsfield.ai/explore](https://cloud.higgsfield.ai/explore).
> To add one, insert it into `MODEL_IDS` in `generate.py` and add a `--model` alias.
>
> Credits are billed per successful generation only; failed and NSFW requests are refunded.

---

## Setup (first run only)

```bash
cd "$SKILL_DIR" && uv sync
```

Get credentials from [cloud.higgsfield.ai](https://cloud.higgsfield.ai) (API Key + API Secret),
then export them using **one** of these forms:

```bash
# Option A — combined (recommended)
export HF_KEY="your-api-key:your-api-secret"

# Option B — separate vars
export HF_API_KEY="your-api-key"
export HF_API_SECRET="your-api-secret"
```

---

## Agent Workflow

### 1. Ask the user

```
Before I generate the video, I need to know:

🎬 Mode
   - text-to-video (prompt only) or image-to-video (drop images in input/)
   - default: auto-detect

🤖 Model  (default: kling)
   kling · wan · seedance · minimax · sora · veo
   Recommendation: kling for speed/cost, sora/veo for premium quality

💬 Prompt  (required)
   Describe the motion or scene, e.g.:
   "slow cinematic push-in, warm golden hour light, subtle camera drift"

⚙️  Settings
   - duration     — video length in seconds (default: 6, range: 3–16)
   - aspect_ratio — 16:9 · 9:16 · 1:1  (default: 16:9)
   - resolution   — 720p · 1080p  (default: 1080p)
```

Wait for user response before proceeding.

### 2. Edit config.json

Write or update `$SKILL_DIR/config.json` based on the user's choices.

### 3. (image-to-video only) Place images

Copy source images to `$SKILL_DIR/input/`. Supported: .jpg .jpeg .png .webp

### 4. Run

```bash
cd "$SKILL_DIR" && uv run python scripts/generate.py --config config.json
```

### 5. Report results

Tell the user:
- Output file path(s) in `output/`
- Model used and approximate credit cost
- Video duration and resolution

---

## Config Reference

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `input_dir` | path | `./input` | Source images (image-to-video only) |
| `output_dir` | path | `./output` | Where MP4s are written |
| `mode` | `auto` · `text-to-video` · `image-to-video` | `auto` | Generation mode |
| `model` | `kling` · `seedance` · `dop` · `dop-preview` | `kling` | Which model to use |
| `prompt` | string | *(required)* | Motion or scene description |
| `duration` | integer 3–16 | `5` | Video length in seconds |
| `aspect_ratio` | `16:9` · `9:16` · `1:1` | `16:9` | Output aspect ratio |
| `extra_params` | object | `{}` | Pass-through params to the model API |

---

## Common Invocations

```bash
# Text-to-video with default model (kling)
cd "$SKILL_DIR" && uv run python scripts/generate.py \
  --prompt "drone shot over misty mountains at sunrise" --duration 8

# Image-to-video with Kling (drop images in input/ first)
cd "$SKILL_DIR" && uv run python scripts/generate.py \
  --prompt "slow cinematic push-in, golden hour light" --model kling

# Premium quality: Sora 2
cd "$SKILL_DIR" && uv run python scripts/generate.py \
  --prompt "aerial pull-back over a foggy city at dawn" --model sora

# Vertical video for Reels/TikTok
cd "$SKILL_DIR" && uv run python scripts/generate.py \
  --prompt "talking head, natural bokeh background" \
  --aspect-ratio 9:16 --model kling

# Fast draft: lower resolution, shorter clip
cd "$SKILL_DIR" && uv run python scripts/generate.py \
  --prompt "product reveal on dark background" \
  --resolution 720p --duration 4 --model wan
```

---

## Output

Each job writes one `.mp4` to `output_dir`:
- text-to-video: `output.mp4`
- image-to-video: `<image_stem>.mp4` per input image

---

## vs animate-image

| | `animate-image` | `video-generator` |
|---|---|---|
| Provider | fal.ai | Higgsfield |
| Mode | image→video only | text→video + image→video |
| Model | LTX-2.3 Fast (fixed) | Kling, Sora, Veo, Wan, Seedance, MiniMax |
| Speed | Very fast | Model-dependent |
| Max resolution | 4K | 1080p |
| Cinematic controls | No | Via `extra_params` |

Use `animate-image` for fast, cheap, high-resolution clips from images.
Use `video-generator` when you need text-to-video, model choice, or Higgsfield's
Cinema Studio physics controls.

---

## API Notes

The skill talks directly to the Higgsfield REST API (`cloud.higgsfield.ai`).
Model endpoint paths are defined in `MODEL_ENDPOINTS` at the top of `generate.py`.
If Higgsfield updates a route, override via config `"extra_params"` or update the
constant — no other changes needed.
