---
name: freesound
description: >-
  Mix sound effects from Freesound into videos with optional animated GIF overlays.
  Use this skill when the user wants to add audio reactions, transitions, celebration
  sounds, or any sound effect to a video clip.
metadata:
  {
    "openclaw":
      {
        "emoji": "🔊",
        "requires": { "bins": ["ffmpeg", "uv"], "env": ["FREESOUND_API_KEY"] },
        "primaryEnv": "FREESOUND_API_KEY",
      },
  }
---

# freesound — Social Sound Effects

Mix social sound effects into videos at precise moments, with optional animated
GIF companions for visual emphasis. This skill is SFX-first: sound is the primary
effect, while GIFs are optional overlays.

The skill directory (where this SKILL.md lives) is referred to as `$SKILL_DIR` below.

---

## When to Use

Use this skill when the user wants to:
- Add reaction sounds to moments in a video (ding, whoosh, applause, bass drop)
- Add transitions and impact beats to social clips
- Trigger SFX at exact timestamps or when phrases are spoken
- Reuse sound presets (`viral`, `party`, `love`, `dramatic`, `reaction`, `crown`)
- Optionally add bundled/local GIF overlays as visual companions

---

## Setup

### Required Tools

- **ffmpeg** — installed on system (video processing)
- **uv** — Python package manager

### API Keys

The skill works with bundled/local assets without API access. The API key is only
required for on-demand Freesound search (`freesound:<query>`).

| API Key | Purpose | Free Tier | Register |
|---------|---------|-----------|----------|
| `FREESOUND_API_KEY` | Search & download sound effects | 200 req/day | https://freesound.org/apiv2/apply/ |

**Setup:**
```bash
export FREESOUND_API_KEY="your_freesound_key"
cd "$SKILL_DIR" && uv sync
```

Or run `./installers/install-abra-on-openclaw.sh` to persist `FREESOUND_API_KEY` into
`~/.openclaw/openclaw.json` under `env`. The installer uses shell env first,
existing OpenClaw config second, and the repo root `.env` as a fallback default
before interactive confirmation.

---

## Agent Workflow

### 1. Gather inputs from user

Ask for:
- Video path
- Trigger type: timestamp or text cue phrase
- SFX source (bundled/local/freesound/favourite/path)
- Optional GIF overlay (bundled/local/favourite/path)
- Position/mode, duration, and whether to pause video

### 2. Edit config.json

Define one or more `effects[]` entries.

### 3. Run

```bash
cd "$SKILL_DIR" && uv run python scripts/freesound.py
```

### 4. Report result

Share output path(s), number of effects applied, and any warnings.

---

## Config Reference

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `input_dir` | path | `./input` | Folder containing input video files |
| `output_dir` | path | `./output` | Destination folder for processed videos |
| `duck_background` | bool | `true` | Enable audio ducking under SFX |
| `duck_db` | integer | `-10` | Ducking level in decibels (negative value) |
| `effects` | array | `[]` | List of effect configurations |
| `effects[].trigger.type` | `"timestamp"` or `"text_cue"` | - | Effect trigger type |
| `effects[].trigger.value` | float | - | Seconds for timestamp triggers |
| `effects[].trigger.phrase` | string | - | Phrase for text-cue triggers |
| `effects[].trigger.transcript` | path | - | Transcript JSON path (required for text cues) |
| `effects[].sfx.source` | `bundled:<name>` \| `local:<name>` \| `favourite:<name>` \| `freesound:<term>` \| path | `"bundled:pop"` | Sound source |
| `effects[].sfx.at` | float | `0.0` | Offset from trigger time in seconds |
| `effects[].sfx.volume` | float | `1.0` | SFX volume multiplier |
| `effects[].gif.source` | `bundled:<name>` \| `local:<name>` \| `favourite:<name>` \| path | optional | Optional GIF companion source |
| `effects[].gif.mode` | `"fullscreen"` or `"positioned"` | `"positioned"` | GIF overlay mode |
| `effects[].gif.position` | `"top-left"` \| `"top-right"` \| `"bottom-left"` \| `"bottom-right"` \| `"center"` \| `"custom"` | `"top-right"` | Position for positioned mode |
| `effects[].gif.x` | integer | `0` | Custom X coordinate when `position=custom` |
| `effects[].gif.y` | integer | `0` | Custom Y coordinate when `position=custom` |
| `effects[].gif.width` | integer | `180` | GIF width in pixels (ignored for fullscreen) |
| `effects[].pause_video` | bool | `false` | Pause video during effect |
| `effects[].duration` | float | `3.0` | Effect duration in seconds |

### SFX source values

- `"bundled:<name>"` — one of `pop`, `whoosh`, `chime`, `applause`, `bass_drop`, `ding`, `swoosh`, `clap`
- `"local:<name>"` — from `assets/sfx/library/`
- `"favourite:<name>"` — from `favourites.json`
- `"freesound:<query>"` — on-demand Freesound search (cached in `assets/sfx/cache/`)
- `/path/to/file.wav` — local file path

### GIF source values (optional companion)

- `"bundled:<name>"` — from built-in GIF set in `assets/gifs/`
- `"local:<name>"` — from `assets/gifs/library/`
- `"favourite:<name>"` — from `favourites.json`
- `/path/to/file.gif` — local file path

> `giphy:<query>` is not supported in this skill. GIPHY search requires the `skills/giphy` skill.

---

## Preset Reference

Use `"preset": "<name>"` inside an effect to merge preset defaults.
Each preset is SFX-primary with an optional bundled GIF companion.

| Preset | SFX | GIF companion | Duration | Position | Pause |
|--------|-----|---------------|----------|----------|-------|
| `viral` | bundled:whoosh, vol=0.9 | bundled:sparkles | 3.0s | top-right | no |
| `party` | bundled:applause, vol=1.0 | bundled:confetti | 4.0s | fullscreen | no |
| `love` | bundled:chime, vol=0.7 | bundled:heart | 3.0s | center | no |
| `dramatic` | bundled:bass_drop, vol=1.0 | bundled:fire | 2.0s | bottom-right | yes |
| `reaction` | bundled:clap, vol=0.8 | bundled:thumbsup | 2.5s | top-left | no |
| `crown` | bundled:ding, vol=0.9 | bundled:crown | 2.0s | top-right | no |

---

## Local Library

Use local libraries to avoid API dependence:

```
assets/sfx/library/   ← custom sounds (.mp3, .wav, .ogg, .flac, .aac)
assets/gifs/library/  ← optional custom GIFs (.gif, .webp, .png, .apng)
```

Manage with CLI:

```bash
cd "$SKILL_DIR"

# List both kinds
uv run python scripts/assets.py library list

# Add local SFX
uv run python scripts/assets.py library add --kind sfx --name whoosh_alt --file ~/Downloads/whoosh.mp3

# Add local GIF companion
uv run python scripts/assets.py library add --kind gif --name sparkle_alt --file ~/Downloads/sparkle.gif

# Bulk import sounds
uv run python scripts/assets.py library import-dir --kind sfx --dir ~/Downloads/my-sfx/
```

---

## Favourites

Save frequently used sound/GIF sources in `favourites.json`:

```bash
cd "$SKILL_DIR"

uv run python scripts/assets.py add-sfx --name hit --source bundled:bass_drop --tags impact,dramatic
uv run python scripts/assets.py add-gif --name cheer --source bundled:confetti --tags celebration
uv run python scripts/assets.py list
```

Use later as `favourite:hit` or `favourite:cheer`.

---

## Output

- Processed videos are written to `output/` with original file names.
- Temporary caches are stored in:
  - `assets/sfx/cache/` for Freesound query downloads
  - `assets/gifs/library/` and `assets/sfx/library/` for local asset packs

---

## Error Handling

- **Missing ffmpeg**: install via package manager.
- **Missing bundled GIF assets**: run `uv run python scripts/generate_bundled_assets.py`.
- **Missing bundled SFX assets**: run `uv run python scripts/download_freesound_presets.py`.
- **Phrase not found in transcript**: switch trigger to timestamp or use a matching phrase.
- **`local:<name>` not found**: list library entries with `uv run python scripts/assets.py library list`.
- **FREESOUND_API_KEY not set**: configure the key, then re-run.
- **Freesound no results**: try a broader or alternate query, or use bundled/local audio.
