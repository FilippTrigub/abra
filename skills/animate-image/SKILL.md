---
name: animate-image
description: >-
  Animate a still image into a short video clip using fal.ai's LTX-2.3 Fast
  image-to-video model in the cloud. No GPU required - runs entirely on fal.ai
  serverless infrastructure.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎬",
        "requires": { "bins": ["uv"] , "env": ["FAL_API_KEY"] },
        "primaryEnv": "FAL_API_KEY",
      },
  }
---

# liven — Image to Video (Cloud)

Brings still images to life using the LTX-2.3 Fast video diffusion model running
on fal.ai's cloud infrastructure. Provide an image and a motion prompt; the model
generates a short video clip (6-20 seconds depending on settings).

The skill directory (where this SKILL.md lives) is referred to as `$SKILL_DIR` below.

> **Cloud-based.** No local GPU required. Requires `FAL_API_KEY` environment variable.
> Pricing: $0.04/s for 1080p, $0.08/s for 1440p, $0.16/s for 4K.

---

## When to Use

Use this skill when the user wants to:
- Animate a photo or illustration into a short video without local GPU
- Create cinematic motion from a still (e.g. slow zoom, pan, light flicker)
- Generate social media video content from product shots or portraits
- Use higher resolutions (up to 4K) without local VRAM constraints

---

## Setup (first run only)

```bash
cd "$SKILL_DIR" && uv sync
```

Set the `FAL_API_KEY` environment variable:

```bash
export FAL_API_KEY="your-api-key-here"
```

---

## Agent Workflow

### 1. Ask the user

```
Before I animate the image(s), I need to know:

💬 Motion prompt  (required)
   Describe the motion you want, e.g.:
   "slow cinematic push-in, golden hour light, subtle camera drift"

🎬 Clip settings
   - duration     — video length in seconds (default: 6, options: 6, 8, 10, 12, 14, 16, 18, 20)
                    Note: durations >10s only support 25 FPS and 1080p
   - resolution   — output quality (default: 1080p, options: 1080p, 1440p, 2160p/4K)
   - aspect_ratio — video aspect ratio (default: auto, options: auto, 16:9, 9:16)
   - fps          — frames per second (default: 25, options: 24, 25, 48, 50)
   - generate_audio — generate AI audio to match video (default: true)

📁 Input / output directories  (default: ./input and ./output)
```

Wait for user response before proceeding.

### 2. Edit config.json

Write or update `$SKILL_DIR/config.json` based on the user's choices.

### 3. Run

```bash
cd "$SKILL_DIR" && uv run python scripts/img2vid.py --config config.json
```

### 4. Report results

Tell the user:
- Output file paths
- Video duration and resolution
- Cost estimate (based on duration and resolution)
- Direct download URLs (videos are hosted on fal.media temporarily)

---

## Config Reference

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `input_dir` | path | `./input` | Folder containing source images |
| `output_dir` | path | `./output` | Destination folder |
| `prompt` | string | *(required)* | Motion description |
| `duration` | integer | `6` | Video duration in seconds (6-20) |
| `resolution` | string | `1080p` | Output resolution: 1080p, 1440p, 2160p |
| `aspect_ratio` | string | `auto` | Aspect ratio: auto, 16:9, 9:16 |
| `fps` | integer | `25` | Frames per second: 24, 25, 48, 50 |
| `generate_audio` | boolean | `true` | Generate AI audio for the video |
| `end_image_url` | string | `null` | Optional end frame for transition videos |

---

## Common Invocations

```bash
# Animate with a motion prompt (uses defaults: 6s, 1080p, 25fps)
cd "$SKILL_DIR" && uv run python scripts/img2vid.py \
  --prompt "slow cinematic push-in, golden hour light"

# Generate a longer 10-second video
cd "$SKILL_DIR" && uv run python scripts/img2vid.py \
  --prompt "gentle wind in the trees" --duration 10

# Create a vertical video for social media
cd "$SKILL_DIR" && uv run python scripts/img2vid.py \
  --prompt "subtle camera movement" --aspect-ratio 9:16

# 4K quality (higher cost: $0.16/s)
cd "$SKILL_DIR" && uv run python scripts/img2vid.py \
  --prompt "cinematic zoom out" --resolution 2160p --duration 8

# Higher frame rate for smoother motion
cd "$SKILL_DIR" && uv run python scripts/img2vid.py \
  --prompt "fast action sequence" --fps 48

# Disable audio generation
cd "$SKILL_DIR" && uv run python scripts/img2vid.py \
  --prompt "silent meditation scene" --no-audio

# Create transition between two images
cd "$SKILL_DIR" && uv run python scripts/img2vid.py \
  --prompt "smooth morphing transition" \
  --end-image /path/to/end_image.jpg
```

---

## Output

Each input image produces one `.mp4` clip in `output_dir`, named
`<image_stem>.mp4`. The video is also uploaded temporarily to fal.media CDN
and a download URL is provided in the console output.

Video metadata (resolution, fps, duration) is printed after generation.

---

## Error Handling

- Missing FAL_API_KEY → clear error with setup instructions
- Invalid image format → error with supported formats (PNG, JPEG, WebP, AVIF, HEIF)
- API errors → fal.ai error message propagated
- Network issues → retry logic with clear error messages

---

## Pricing Reference

| Resolution | Price per second |
|------------|------------------|
| 1080p      | $0.04            |
| 1440p      | $0.08            |
| 2160p (4K) | $0.16            |

Examples:
- 6s video at 1080p = $0.24
- 10s video at 1080p = $0.40
- 10s video at 4K = $1.60
