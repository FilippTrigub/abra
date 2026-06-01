# video-captioner

Animated caption pipeline for videos. Transcribes speech with Whisper and burns word-by-word animated captions into each video.

**Pipeline:** Whisper transcription → pycaps subtitle render → output video

## Prerequisites

- [`ffmpeg`](https://ffmpeg.org) — video processing binary
- [`uv`](https://docs.astral.sh/uv) — Python package manager

```bash
# Arch / CachyOS
sudo pacman -S ffmpeg

# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg
```

## Setup

```bash
cd skills/video-captioner && uv sync
```

## Usage

```bash
cd skills/video-captioner

# Default minimalist captions
uv run python scripts/caption_service.py \
  --input ./input --output ./output

# Futuristic style (gold/magenta glowing words)
uv run python scripts/caption_service.py \
  --input ./input --output ./output \
  --css scripts/futuristic.css

# Watch mode (polls every 10s for new videos)
uv run python scripts/caption_service.py \
  --input ./input --output ./output --watch
```

## Brand fonts

Static caption styling uses `config.default.json`. Its default `caption_font` is
`auto`, which means the script checks `skills/brand-manager/brand-assets/asset-manifest.json`
for an available brand font tagged `caption` before falling back to bundled/system
font names. Set `CLAW_BRAND_ASSETS_DIR` to point at a different brand asset store.

## CSS styles

`scripts/futuristic.css` — alternating gold/magenta captions with glow effects, monospace font, active word highlighted white. Pass any CSS file via `--css`.

## Notes

- First run downloads the Whisper model (~140 MB for `tiny`). Subsequent runs use the cached model.
- Videos already present in the output directory are skipped (idempotent).
- For colour grading, use the `video-enhancer` skill before captioning.
