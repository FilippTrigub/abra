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

## Static captions

Use `--caption` to add predefined text at specific timestamps instead of transcribing audio:

```bash
--caption "START-END: TEXT"
```

**Format:**
- Times use `M:SS` or `MM:SS` format (e.g., `0:05` = 5 seconds, `1:30` = 90 seconds)
- Multiple captions: use `--caption` multiple times
- If both static captions and transcription are provided, static captions take precedence

**Example:**
```bash
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --caption "0:01-0:05: Hello world" \
  --caption "0:10-0:20: This is a demo" \
  --css scripts/futuristic.css
```

## Caption styling

Styling is managed via **JSON config files**. When using static captions, styling is applied automatically.

### Default styling

When no `--style-config` is specified, `config.default.json` is used:
- **Background:** white (`#FFFFFF`)
- **Text color:** blue (`#0066FF`)
- **Font:** `auto` — uses an available brand font tagged `caption` first, then falls back to Courier New
- **Padding:** `10px 15px`
- **Margin:** `0`

### Using a style config

Switch styles by passing a config file:

```bash
# Use dark-mode style
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --caption "0:01-0:05: Hello" \
  --style-config config.dark-mode.json
```

**Included configs:**
- `config.default.json` — white bg, blue text, Courier New (default)
- `config.dark-mode.json` — dark bg, white text, larger font

### Creating custom style configs

Copy `config.default.json` and modify:

```json
{
  "caption_bg_color": "#000000",
  "caption_color": "#FFFFFF",
  "caption_font": "auto",
  "caption_font_tag": "caption",
  "caption_padding": "20px 30px",
  "caption_margin": "10px",
  "caption_font_size": 48
}
```

Then use it:
```bash
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --caption "0:01-0:05: Text" \
  --style-config my-custom-style.json
```

### Overriding config with CLI flags

CLI flags take precedence over config file values:

```bash
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --caption "0:01-0:05: Hello" \
  --style-config config.dark-mode.json \
  --caption-color "#00FF00"  # Override config's text color
```

### Style config reference

| Key | Type | Description |
|-----|------|-------------|
| `caption_bg_color` | string | Background color (hex or CSS color name) |
| `caption_color` | string | Text color (hex or CSS color name) |
| `caption_font` | string | `auto`, font family, or path to `.ttf`, `.otf`, `.woff`, `.woff2` file |
| `caption_font_tag` | string or null | Brand font tag to prefer from `brand-manager` (`caption`, `body`, `heading`, etc.) |
| `caption_padding` | string | CSS padding (e.g., `"10px 15px"`) |
| `caption_margin` | string | CSS margin (e.g., `"0"`) |
| `caption_font_size` | integer or null | Font size in pixels (null = auto-scale) |

### Available fonts

System fonts can be specified by name:
- `DejaVu Sans` / `DejaVu Sans Bold` / `DejaVu Serif`
- `Liberation Sans` / Liberation Mono`
- `Courier New`
- `Ubuntu Mono`
- Any TTF file path: `/path/to/font.ttf`

Or choose from brand fonts in `skills/brand-manager/brand-assets/asset-manifest.json`.
When `caption_font` is `auto`, the skill reads the brand manifest (or `CLAW_BRAND_ASSETS_DIR` if set) and uses the first available font tagged by `caption_font_tag`; if no tagged font exists, it tries brand fonts tagged `caption`, `body`, `heading`, or `bold`, then falls back to Courier New. If the resolved brand font is a file path, the generated CSS includes an `@font-face` rule so pycaps can render it.

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
# Default minimalist captions (Whisper transcription)
uv run python scripts/caption_service.py --input ./input --output ./output

# Futuristic style
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --css scripts/futuristic.css

# Custom CSS
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --css /path/to/my.css

# Static captions with default styling (white bg, blue text, Courier New)
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --caption "0:01-0:05: Subscribe for more" \
  --caption "0:10-0:15: Follow us on Instagram"

# Static captions with dark-mode style
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --caption "0:01-0:05: Hello world" \
  --caption "0:10-0:20: This is a demo" \
  --style-config config.dark-mode.json

# Static captions with custom style config
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --caption "0:01-0:05: Custom text" \
  --style-config my-custom-style.json

# Static captions with CLI flag overrides
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --caption "0:01-0:05: Hello" \
  --style-config config.dark-mode.json \
  --caption-color "#00FF00"

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
