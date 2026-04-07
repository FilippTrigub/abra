---
name: video-captioner
description: >-
  Animated caption pipeline. Use this skill when the user wants to burn
  word-by-word animated captions into videos — using Whisper for transcription
  and pycaps for rendering. Supports default minimalist style or a futuristic
  CSS theme with alternating gold/magenta glowing words.
metadata:
  {
    "openclaw":
      {
        "emoji": "💬",
        "requires": { "bins": ["ffmpeg", "uv"] },
      },
  }
---

# video-captioner — Animated Caption Pipeline

Transcribes speech with Whisper and burns animated word-by-word captions into videos. No colour grading — for visual enhancement use the `video-enhancer` skill first.

## Pipeline

```
input video → Whisper transcription → pycaps subtitle render → output video with captions
```

## Caption styles

Three options:

1. **Default (no flag)** — pycaps built-in minimalist style: plain white text, no effects.
2. **Futuristic (bundled)** — `--css scripts/futuristic.css` — alternating gold/magenta captions with a glow effect and monospace font. Good for tech, gaming, or high-energy content.
3. **Custom** — the user can supply any CSS file path via `--css /path/to/custom.css`.

If the user has not mentioned a caption style, ask whether they want the default look, the futuristic style, or a custom CSS file.

## How to run

Install dependencies (first run only):

```bash
cd skills/video-captioner && uv sync
```

**Note:** the very first run will be slow (potentially several minutes) because pycaps downloads the Whisper speech recognition model. Warn the user about this before starting.

Then process videos:

```bash
cd skills/video-captioner && uv run python scripts/caption_service.py \
  --input <path/to/input> \
  --output <path/to/output> \
  [--css scripts/futuristic.css]
```

## Common invocations

```bash
# Default minimalist captions
uv run python scripts/caption_service.py --input ./input --output ./output

# Futuristic style
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --css scripts/futuristic.css

# Custom CSS
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --css /path/to/my.css

# Watch mode (polls for new videos every 10s)
uv run python scripts/caption_service.py --input ./input --output ./output --watch
```

## After running

Report back to the user:
- How many videos were processed successfully and how many failed.
- The full path to the output directory.
- If any videos failed, name them explicitly.

## Edge cases

- If `ffmpeg` is not installed: tell the user to install it (`sudo pacman -S ffmpeg` on Arch/CachyOS, `brew install ffmpeg` on macOS, `sudo apt install ffmpeg` on Ubuntu)
- If `uv` is not installed: direct to https://docs.astral.sh/uv/getting-started/installation/
- If the input directory is empty: report clearly rather than silently exiting
- The first run downloads the Whisper model (~140 MB for `tiny`, ~1.5 GB for `large`) — this is one-time only

---

## Remote Transcription

This skill now supports **optional remote transcription** while keeping **pycaps rendering local**.

- Default behavior is still fully local: Whisper transcription inside pycaps + local render
- Remote mode only replaces the transcription step
- Caption rendering, templates, and CSS handling stay local

### Supported providers

- `huggingface`
- `replicate`

### Config / CLI keys

| Key | Default | Notes |
|-----|---------|-------|
| `transcription_provider` | `null` | `null` keeps local Whisper-in-pycaps flow |
| `remote_model` | `null` | Optional provider-specific transcription model override |
| `hf_token_env` | `HF_TOKEN` | HuggingFace auth env var name |
| `replicate_api_key_env` | `REPLICATE_API_TOKEN` | Replicate auth env var name |
| `remote_timeout_seconds` | `300` | Remote call timeout |

### Examples

```bash
# HuggingFace remote transcription + local pycaps rendering
export HF_TOKEN=hf_your_token
uv run python scripts/caption_service.py --input ./input --output ./output --transcription-provider huggingface

# Replicate remote transcription + local pycaps rendering
export REPLICATE_API_TOKEN=r8_your_token
uv run python scripts/caption_service.py --input ./input --output ./output --transcription-provider replicate --remote-model <replicate-model-slug>
```

### Notes

- There is **no silent fallback** to local mode if remote auth/config is missing
- Existing local CLI usage remains valid
- If you do not set `--transcription-provider`, pycaps continues using its built-in Whisper flow
