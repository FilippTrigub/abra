---
name: pixabay
description: >-
  Overlay royalty-free images and short video clips from Pixabay onto videos or images,
  with optional sound effects for videos. Use this skill when the user wants to add
  branded backgrounds, illustrative overlays, or short animated clips to
  media — no attribution required.
metadata:
  {
    "openclaw":
      {
        "emoji": "🖼️",
        "requires": { "bins": ["ffmpeg", "uv"], "env": ["PIXABAY_API_KEY"] },
        "primaryEnv": "PIXABAY_API_KEY",
      },
  }
---

# pixabay — Royalty-Free Image & Video Overlays

Overlay royalty-free Pixabay images and short video clips on top of videos or images, with optional SFX and optional pause moments on videos.

The skill directory (where this file lives) is referred to as `$SKILL_DIR` below.

## When to Use

Use this skill when the user wants to:
- Add image overlays for branded context (logos, textures, motifs, themes)
- Add short visual clips for emphasis (confetti, particles, ambient loops)
- Add overlays onto static images
- Build social-style moments with visual + sound effects at key timestamps
- Use royalty-free media without attribution requirements
- Trigger overlays by timestamp or text cue from transcript output

## Setup

### Required Tools

- `ffmpeg`
- `uv`

### API Key (Pixabay only)

```bash
export PIXABAY_API_KEY="your_api_key_here"
```

Register at: https://pixabay.com/api/docs/

Install dependencies:

```bash
cd "$SKILL_DIR" && uv sync
```

## Agent Workflow

1) Ask for:
- Video path
- Trigger style (`timestamp` or `text_cue`)
- Overlay style (`fullscreen` or `positioned`)
- Overlay source (`pixabay:`, `pixabay-video:`, `local:`, `favourite:`, file path)
- SFX source (`bundled:`, `local:`, file path)
- Whether to pause video during effect

2) Edit `config.json`

3) Run:

```bash
cd "$SKILL_DIR" && uv run python scripts/pixabay.py
```

4) Report:
- Applied effects count
- Output file path(s)
- Any missing source/API or trigger-match issues

## Config Reference

| Key | Values | Default | Description |
|---|---|---|---|
| `input_dir` | path | `./input` | Folder with source videos |
| `output_dir` | path | `./output` | Output folder |
| `duck_background` | bool | `true` | Duck background audio during SFX |
| `duck_db` | number | `-8` | Duck amount in dB |
| `effects[]` | array | `[]` | Effect list |
| `effects[].trigger.type` | `timestamp` \| `text_cue` | - | Trigger mode |
| `effects[].trigger.value` | float | - | Seconds when `timestamp` |
| `effects[].trigger.phrase` | string | - | Phrase when `text_cue` |
| `effects[].trigger.transcript` | path | - | Required for `text_cue` |
| `effects[].overlay.source` | `pixabay:<query>` \| `pixabay-video:<query>` \| `local:<name>` \| file path | - | Overlay source |
| `effects[].overlay.mode` | `fullscreen` \| `positioned` | `positioned` | Overlay mode |
| `effects[].overlay.position` | `top-left` \| `top-right` \| `bottom-left` \| `bottom-right` \| `center` \| `custom` | `top-right` | Overlay position |
| `effects[].overlay.x` | int | `0` | X when `position=custom` |
| `effects[].overlay.y` | int | `0` | Y when `position=custom` |
| `effects[].overlay.width` | int | `200` | Overlay width (px), ignored for fullscreen |
| `effects[].sfx.source` | `bundled:<name>` \| `local:<name>` \| file path | - | SFX source |
| `effects[].sfx.at` | float | `0.0` | Offset from trigger in seconds |
| `effects[].sfx.volume` | float | `1.0` | SFX volume multiplier |
| `effects[].pause_video` | bool | `false` | Freeze frame effect window |
| `effects[].duration` | float | `3.0` | Effect duration |

## Image input mode

- Supported image inputs include `.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`, `.tif`, `.tiff`
- `text_cue`, `pause_video`, and `sfx` are not supported for images and will hard-error
- Keep `trigger.type` as `timestamp` for image-compatible configs

## Overlay Source Values

- `pixabay:<query>`: fetches/caches a Pixabay image in `assets/images/cache/`
- `pixabay-video:<query>`: fetches/caches a short Pixabay video in `assets/videos/cache/`
- `local:<name>`: resolves from `assets/images/library/` first, then `assets/videos/library/`
- `favourite:<name>`: resolves from `favourites.json`
- file path: direct local file

Unsupported prefixes like `giphy:` and `bundled:` are rejected for overlay sources.

## SFX Source Values

- `bundled:<name>`: uses `assets/sfx/<name>.*`
- `local:<name>`: uses `assets/sfx/library/<name>.*`
- `favourite:<name>`: resolves from `favourites.json`
- file path: direct local file

`freesound:<query>` is not supported in this skill. Freesound search requires `skills/freesound`.

## Local Library

Store custom assets here:

```text
assets/images/library/
assets/videos/library/
assets/sfx/library/
```

CLI:

```bash
cd "$SKILL_DIR"

uv run python scripts/assets.py library list --kind all
uv run python scripts/assets.py library add --kind image --name logo --file ~/Downloads/logo.png
uv run python scripts/assets.py library add --kind video --name confetti --file ~/Downloads/confetti.mp4
uv run python scripts/assets.py library add --kind sfx --name hit --file ~/Downloads/hit.wav
uv run python scripts/assets.py library import-dir --kind image --dir ~/Downloads/my-images/
uv run python scripts/assets.py library remove --kind video --name confetti
```

## Presets

Presets are defined in `presets.json` and merged into each effect via `"preset": "name"`. Effect-level keys override preset defaults.

Included presets: `viral`, `party`, `love`, `dramatic`.

## Downloading Assets with `pixabay_api.py`

```bash
cd "$SKILL_DIR"

# List images
uv run python scripts/pixabay_api.py images --query "sparkle" --list

# Download image and add to local library
uv run python scripts/pixabay_api.py images --query "glitter" --name glitter --add-to-library

# List short videos
uv run python scripts/pixabay_api.py videos --query "confetti celebration" --max-duration 5 --list

# Download short video
uv run python scripts/pixabay_api.py videos --query "confetti" --name confetti_clip
```
