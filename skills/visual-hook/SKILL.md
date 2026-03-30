---
name: visual-hook
description: >-
  Add a bold visual hook text overlay to images or videos for Instagram.
  Places high-contrast text in safe zones for Reels, feed portrait, and square posts.
  Use this skill when the user wants to add a hook line, question, teaser, or bold claim
  before publishing social content.
metadata:
  {
    "openclaw":
      {
        "emoji": "🪝",
        "requires": { "bins": ["ffmpeg", "uv"], "env": [] },
      },
  }
---

# visual-hook — Instagram Visual Hook Overlay

Add a bold visual hook to images or videos using high-contrast typography in
Instagram-safe zones. For videos, the skill prepends a selected hook clip from
brand assets after overlaying the hook text onto that clip. The skill is CPU-only
and works well as a pre-publication step before captioning or scheduling.

## When to Use

Use this skill when the user wants to:
- Add a strong first-frame hook to a Reel or Story
- Overlay a bold question, teaser, or claim onto an image post
- Increase scroll-stopping contrast before publishing to Instagram
- Apply a reusable visual style (`bold-white`, `neon-red`, `minimal`, etc.)

## Setup

```bash
cd "$SKILL_DIR" && uv sync
```

The skill tries fonts in this order:
1. `hook.font` if set to a file path
2. A brand font from `skills/brand-manager/brand-assets/asset-manifest.json`
3. Common system fonts such as DejaVu Sans Bold

For videos, the skill resolves the hook clip from `brand-assets/asset-manifest.json`:
1. `--hook-video <name|path>` if provided
2. the manifest entry under `videos` with `"default": true`
3. otherwise the run fails with a clear error

## Agent Workflow

### 1. Ask the user

```
Before I add the hook, I need:

📝 Hook text
  Short is best: 4–7 words, ideally 2 lines max

🎨 Style preset
  - bold-white
  - bold-black
  - neon-red
  - neon-yellow
  - minimal

📍 Position
  - upper-middle (recommended)
  - center
  - lower-middle

📐 Format
  - auto
  - reels (9:16)
  - feed-portrait (4:5)
  - feed-square (1:1)
```

### 2. Edit config.json

Set `hook.text`, `hook.preset`, `hook.position`, and `format`.
For videos, optionally set `video_hook.selection` to a brand asset name or manifest path.

### 3. Run

```bash
cd "$SKILL_DIR" && uv run python scripts/hook.py
```

Override defaults via CLI:

```bash
cd "$SKILL_DIR" && uv run python scripts/hook.py \
  --input ./input \
  --output ./output \
  --text "Stop doing this" \
  --preset neon-red \
  --format reels \
  --hook-video intro-fast
```

### 4. Report results

Tell the user:
- how many files were processed
- the output file locations
- which font was used
- whether the hook was applied to images, videos, or both

## Config Reference

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `input_dir` | path | `./input` | Folder containing source images/videos |
| `output_dir` | path | `./output` | Destination folder for processed output |
| `format` | `auto`, `reels`, `feed-portrait`, `feed-square` | `auto` | Layout profile for safe-zone calculations |
| `video_hook.selection` | `auto`, brand asset name, manifest path | `auto` | Hook-video selection for video inputs |
| `hook.text` | string | `You need to see this →` | The visual hook copy |
| `hook.preset` | `bold-white`, `bold-black`, `neon-red`, `neon-yellow`, `minimal` | `bold-white` | Hook styling preset |
| `hook.position` | `upper-middle`, `center`, `lower-middle` | `upper-middle` | Vertical placement within safe zone |
| `hook.font_size` | integer or `null` | `null` | Explicit font size; auto-scales when null |
| `hook.stroke_width` | integer | `4` | Text outline width |
| `hook.duration` | float | `3.0` | Seconds to show hook on videos |
| `hook.font` | `auto` or file path | `auto` | Explicit font path override |

## Output

- Images: same file name and extension in `output_dir`
- Videos: MP4 output named `<original-stem>.mp4`, containing the selected hook clip first and the source video second

## Error Handling

- **Missing ffmpeg**: install `ffmpeg` on the system
- **No supported media found**: the skill prints a clear message and exits successfully
- **Font not found**: falls back through brand font and system font candidates, then exits with guidance
- **No hook video configured**: add a video entry in brand assets and mark one as default, or pass `--hook-video`
- **Invalid preset / format / position**: config validation error with allowed values
