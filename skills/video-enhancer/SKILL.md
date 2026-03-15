---
name: video-enhancer
description: >-
  Video enhancement pipeline. Use this skill when the user wants to
  sharpen, colour grade, warm, or normalise the audio of videos —
  including presets for natural, cinematic, or vivid looks.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎨",
        "requires": { "bins": ["ffmpeg", "uv"] },
      },
  }
---

# video-enhancer — Video Enhancement Pipeline

Sharpens, colour-grades, and normalises audio for a batch of videos. No captions — for captioning use the `video-captioner` skill.

## Pipeline

```
input video → unsharp + eq + colorbalance (ffmpeg) → -14 LUFS audio normalisation → output
```

## Presets

| Preset | Sharpness | Saturation | Warmth |
|---|---|---|---|
| `natural` | subtle | +10% | none |
| `cinematic` | strong | +35% | warm (red boost, blue reduce) |
| `vivid` | strong | +40% | none |

If the user has not specified a preset, ask them which look they want before running. Describe the options briefly: `natural` for a clean, understated result; `cinematic` for a warm, punchy Instagram-ready grade; `vivid` for maximum colour intensity.

## How to run

Install dependencies (first run only):

```bash
cd skills/video-enhancer && uv sync
```

Then process videos:

```bash
cd skills/video-enhancer && uv run python scripts/enhance.py \
  --input <path/to/input> \
  --output <path/to/output> \
  --preset natural|cinematic|vivid
```

## Common invocations

```bash
# Cinematic grade
uv run python scripts/enhance.py --input ./input --output ./output --preset cinematic

# Natural grade
uv run python scripts/enhance.py --input ./input --output ./output --preset natural

# Vivid grade
uv run python scripts/enhance.py --input ./input --output ./output --preset vivid
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
- If an unknown preset is given: list the valid options (natural, cinematic, vivid)
- Audio normalisation may print a warning about dynamic mode for short clips — this is expected and not an error
