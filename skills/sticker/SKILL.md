---
name: sticker
description: >-
  Overlay animated GIF stickers and social sound effects onto videos. Use this
  skill when the user wants to add Instagram-style reactions, transitions,
  celebrations, or any GIF-plus-sound effect to a video clip.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎪",
        "requires": { "bins": ["ffmpeg", "uv"], "env": ["GIPHY_API_KEY"] },
        "primaryEnv": "GIPHY_API_KEY",
      },
  }
---

# sticker — Animated Stickers + Social SFX

Overlay animated GIF stickers (hearts, sparkles, confetti, fire, stars, etc.)
paired with social sound effects (pop, whoosh, chime, etc.) onto videos at
specific timestamps or text cues. Perfect for Instagram/TikTok-style reactions,
viral moment highlights, birthday celebrations, or captioned video edits.

The skill directory (where this SKILL.md lives) is referred to as `$SKILL_DIR` below.

---

## When to Use

Use this skill when the user wants to:
- Add Instagram/TikTok-style reactions to videos (hearts, sparkles, emojis)
- Highlight viral moments with celebration animations (confetti, fire, crown)
- Add emotional beats with sound effects (pop, whoosh, chime, bass drop)
- Create viral-style video edits with presets (`viral`, `party`, `love`, etc.)
- Trigger animations at specific timestamps or when certain phrases are spoken

---

## Setup

1. Go to https://developers.giphy.com/dashboard/ and create a free app
2. Copy your API key
3. Set the environment variable:
   ```bash
   export GIPHY_API_KEY="your_api_key_here"
   ```
4. Install dependencies and download real stickers:
   ```bash
   cd "$SKILL_DIR" && uv sync
   cd "$SKILL_DIR" && uv run python scripts/download_giphy_presets.py
   ```

The preset download fetches one transparent-background sticker per bundled name (heart, sparkles, confetti, fire, stars, thumbsup, crown, explosion) into `assets/gifs/`. Safe to re-run — existing files are skipped. Add `--force` to refresh.

> **Without a key:** the skill still works using generated geometric placeholder stickers.

---

## Agent Workflow

### 1. Ask the user

```
Before I add stickers to your video, I need to know:

🎥 Video file
  Path to the video you want to edit (e.g., ./input/talking_head.mp4)

⏱️  Trigger the effect
  Option 1: "At 2.5 seconds" — specify exact timestamp
  Option 2: "After I say 'check this out'" — text cue from transcript

🎉 Animation style (presets)
  - viral     — sparkles, whoosh (top-right corner, 3s)
  - party     — confetti fullscreen, applause (4s)
  - love      — heart upbeat, chime (center, 3s)
  - dramatic  — fire, bass_drop (bottom-right, pauses video, 2s)
  - reaction  — thumbsup, clap (top-left, 2.5s)
  - crown     — golden crown, ding (top-right, 2s)

  Or describe: "I want a heart in the corner when I say 'finally', cheerfulness"

📍 Positioning
  - fullscreen — animation covers entire screen
  - positioned — show location (top-right|top-left|bottom-right|bottom-left|center)
  - custom — specify exact x,y coordinates (e.g., x=500, y=300)

🎬 Video behavior
  - pause_video — video stops during effect (default for dramatic moments)
  - continue    — effect overlays while video keeps playing

🎵 Sound effect
  - bundled name (bundled:pop|whoosh|chime|applause|bass_drop|ding|swoosh|clap)
  - custom file path (./my_sounds/cartoon_womp.mp3)
  - Freesound search (freesound:fairy_dust if we have API access)

🎨 GIF sticker
  - bundled name  (bundled:heart|sparkles|confetti|fire|stars|thumbsup|crown|explosion)
  - local library (local:myname)  ← preferred, no API key needed
  - custom file   (./stickers/my_emoji.gif)
  - GIPHY search  (giphy:dancing cat) — requires GIPHY_API_KEY env var
  - favourite     (favourite:my_fav) — loaded from favourites.json

  If the user has a folder of GIFs, offer to import them:
    python scripts/assets.py library import-dir --dir ./my-stickers/
  Then reference as local:<name> in config.

  ⚠️  Before using GIPHY search or downloading preset stickers:
  Check if GIPHY_API_KEY is set. If not, ask the user to follow the
  "GIPHY API Key" section in this SKILL.md before proceeding.

🔖 Save to favourites?
  After the run succeeds, should I save:
  - The GIF source for reusing later? 
  - The SFX source?
  - Both as a named preset for quick access next time?
```

### 2. Edit config.json

### 3. Run

```bash
cd "$SKILL_DIR" && uv run python scripts/apply_stickers.py --config config.json
```

### 4. Report results

Tell the user:
- How many effects were applied
- Output file locations (`output_talking_head.mp4` or similar)
- Any errors (missing ffmpeg, unmatched phrase in transcript, etc.)

---

## Config Reference

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `input_dir` | path | `./input` | Folder containing input video files |
| `output_dir` | path | `./output` | Destination folder for processed videos |
| `duck_background` | bool | `true` | Enable audio ducking under effects |
| `duck_db` | integer | `-10` | Ducking level in decibels (negative value) |
| `effects` | array | `[]` | List of effect configurations |
| `effects[].trigger.type` | `"timestamp"` or `"text_cue"` | - | Effect trigger type |
| `effects[].trigger.value` | float or string | - | Seconds for timestamp; phrase or transcript path for text cue |
| `effects[].gif.source` | `bundled:<name>` \| `favourite:<name>` \| `giphy:<term>` \| path | `"bundled:heart"` | GIF source (see below) |
| `effects[].gif.mode` | `"fullscreen"` or `"positioned"` | `"positioned"` | Overlay mode |
| `effects[].gif.position` | `"top-left"` \| `"top-right"` \| `"bottom-left"` \| `"bottom-right"` \| `"center"` \| `"custom"` (requires x,y below) | `"top-right"` | Position for positioned mode |
| `effects[].gif.x` | integer | `0` | Custom X coordinate (mm in ffmpeg) |
| `effects[].gif.y` | integer | `0` | Custom Y coordinate (mm in ffmpeg) |
| `effects[].gif.width` | integer | `180` | Width in pixels (ignored for fullscreen) |
| `effects[].gif.height` | integer | auto | Height in pixels (ignored for fullscreen/emoji) |
| `effects[].sfx.source` | `bundled:<name>` \| `freesound:<term>` \| path | `"bundled:pop"` | Sound effect source |
| `effects[].sfx.at` | float | `0.0` | Offset within effect (seconds from trigger) |
| `effects[].sfx.volume` | float | `1.0` | SFX volume (0-1) |
| `effects[].pause_video` | bool | `false` | Pause video during effect |
| `effects[].duration` | float | `3.0` | Effect duration in seconds |

### GIF source values:
- `"local:<name>"` — file in `assets/gifs/library/<name>.(gif|webp|png)`; no API key needed; **recommended for personal sticker packs**
- `"bundled:<name>"` — one of 8 built-in presets; uses real GIPHY stickers if downloaded, else generated fallback
- `"favourite:<name>"` — loaded from `favourites.json`
- `"giphy:<query>"` — searches GIPHY Stickers API; transparent background; requires `GIPHY_API_KEY`; cached in `assets/gifs/cache/`
- `/path/to/file.gif` — absolute or relative file path

### SFX source values:
- `"bundled:pop"` — one of 8 built-in sound effects
- `"freesound:fairy_dust"` — search Freesound API (requires key)
- `/path/to/file.wav` — local file path

---

## Preset Reference

Using `"preset": "<name>` in your effect config automatically merges these settings with your base effect. Values you specify override preset values.

| Preset | GIF | SFX | Duration | Position | Pause |
|--------|-----|-----|----------|---------|-------|
| `viral` | bundled:sparkles | bundled:whoosh, vol=0.9 | 3.0s | top-right | no |
| `party` | bundled:confetti | bundled:applause, vol=1.0 | 4.0s | fullscreen | no |
| `love` | bundled:heart | bundled:chime, vol=0.7 | 3.0s | center | no |
| `dramatic` | bundled:fire | bundled:bass_drop, vol=1.0 | 2.0s | bottom-right | yes |
| `reaction` | bundled:thumbsup | bundled:clap, vol=0.8 | 2.5s | top-left | no |
| `crown` | bundled:crown | bundled:ding, vol=0.9 | 2.0s | top-right | no |

---

## Local Sticker Library

Store your own GIFs locally and reference them as `local:<name>` — no API key required.

**Drop and use** — copy any GIF directly into the library folder and it's immediately available:
```bash
cp ~/Downloads/my_sticker.gif "$SKILL_DIR/assets/gifs/library/my_sticker.gif"
# use as: "source": "local:my_sticker"
```

**CLI management:**
```bash
cd "$SKILL_DIR"

# List everything in the library
uv run python scripts/assets.py library list

# Add a single sticker
uv run python scripts/assets.py library add --name party_hat --file ~/Downloads/party_hat.gif

# Bulk import a whole folder
uv run python scripts/assets.py library import-dir --dir ~/Downloads/my-stickers/

# Remove a sticker
uv run python scripts/assets.py library remove --name party_hat
```

**Supported formats:** `.gif`, `.webp`, `.png`, `.apng`

**Use in config:**
```json
{
  "gif": { "source": "local:party_hat", "mode": "positioned", "position": "top-right" }
}
```

---

## Favourites

Save favourite GIFs and SFX for reuse. Run the assets CLI:

```bash
cd "$SKILL_DIR" && uv run python scripts/assets.py

# Add a favourite GIF
python scripts/assets.py add-gif \
  --name myheart \
  --source bundled:heart \
  --tags love,reaction,warm

# Add a favourite SFX
python scripts/assets.py add-sfx \
  --name birthday_buzz \
  --source bundled:applause \
  --tags celebration,surprise

# List all favourites
python scripts/assets.py list

# Remove a favourite
python scripts/assets.py remove-gif --name myheart
```

Then reuse in config:
```json
{
  "effects": [{
    "gif": {
      "source": "favourite:myheart"
    }
  }]
}
```

---

## Common Invocations

```bash
# Use a preset (viral-style sparkles + whoosh at 2.5s)
{
  "input_dir": "./input",
  "output_dir": "./output",
  "effects": [{
    "trigger": { "type": "timestamp", "value": 2.5 },
    "preset": "viral",
    "gif": { "width": 180 },
    "sfx": { "volume": 0.95 }
  }]
}
```

```bash
# Custom gif + sfx combination
{
  "effects": [{
    "trigger": { "type": "timestamp", "value": 5.0 },
    "gif": {
      "source": "bundled:confetti",
      "mode": "fullscreen"
    },
    "sfx": { "source": "bundled:applause" },
    "duration": 4.0
  }]
}
```

```bash
# Text cue trigger: animate when the phrase is spoken
{
  "effects": [{
    "trigger": {
      "type": "text_cue",
      "value": "check this out",
      "transcript": "./input/subtitle.srt"
    },
    "gif": { "source": "bundled:sparkles", "position": "center" },
    "sfx": { "source": "bundled:pop" },
    "duration": 2.5
  }]
}
```

```bash
# Paused dramatic effect (video stops during bass_drop + fire)
{
  "effects": [{
    "trigger": { "type": "timestamp", "value": 12.0 },
    "gif": {
      "source": "bundled:fire",
      "position": "bottom-right",
      "width": 200
    },
    "sfx": { "source": "bundled:bass_drop", "volume": 1.0 },
    "pause_video": true,
    "duration": 2.0
  }]
}
```

```bash
# Fullscreen party moment (confetti + applause)
{
  "effects": [{
    "trigger": { "type": "timestamp", "value": 8.0 },
    "preset": "party",
    "gif": { "width": 1000 },
    "pause_video": false
  }]
}
```

---

## Output

- `output_dir/video_<base>.mp4` — video with stickers and SFX applied
- Effects are visualized as overlay using ffmpeg composite filters

---

## Error Handling

- **Missing ffmpeg**: Install via package manager (`brew install ffmpeg`, `sudo apt install ffmpeg`, etc.)
- **Missing bundled assets**: Run `uv run python scripts/generate_bundled_assets.py`
- **Phrase not found in transcript**: Exit with clear message. Provide:
  - Transcript path (`--transcript ./input/subtitle.srt`)
  - Or set `trigger.type` to `"timestamp"` instead
- **GIF/SFX not found**: Bundled assets are created automatically; custom paths must exist
- **`local:<name>` not found**: Sticker not in library. Run `python scripts/assets.py library list` to see available names, or add it with `library add`.
- **GIPHY_API_KEY not set**: Skill raises `ValueError` with setup URL. Tell user to follow the "GIPHY API Key" section and re-run.
- **GIPHY no results**: Raises `ValueError` with the search query. Suggest a different query or use a bundled/local sticker.
- **FREESOUND_API_KEY not set**: Same pattern — raises with registration URL.
- **Bundled sticker is a placeholder**: Run `uv run python scripts/download_giphy_presets.py` to replace with real stickers.
