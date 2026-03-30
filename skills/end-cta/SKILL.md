---
name: end-cta
description: >-
  Add a brand-defined CTA to the end of content. Text and image CTAs can be overlaid on images,
  while videos receive an appended CTA card or CTA video from brand assets.
metadata:
  {
    "openclaw":
      {
        "emoji": "📣",
        "requires": { "bins": ["ffmpeg", "uv"], "env": [] },
      },
  }
---

# end-cta — End CTA Renderer

Apply a CTA from `skills/brand-manager/brand-assets/asset-manifest.json`.

## CTA behavior

| CTA type | Input image | Input video |
|---|---|---|
| text | overlay text at `lower-middle` by default | append a black CTA card with centered text |
| image | overlay CTA image at `lower-middle` by default | append a black CTA card with centered image |
| video | error | append the CTA video |

## CTA selection

Resolution order:
1. `--cta <name>`
2. manifest CTA entry with `"default": true`
3. otherwise fail

## Setup

```bash
cd "$SKILL_DIR" && uv sync
```

## Run

```bash
cd "$SKILL_DIR" && uv run python scripts/cta.py
```

Override defaults via CLI:

```bash
cd "$SKILL_DIR" && uv run python scripts/cta.py \
  --input ./input \
  --output ./output \
  --cta book-call \
  --duration 2.5 \
  --position lower-middle
```

## Config reference

| Key | Values | Default | Description |
|---|---|---|---|
| `input_dir` | path | `./input` | Source media directory |
| `output_dir` | path | `./output` | Output directory |
| `format` | `auto`, `reels`, `feed-portrait`, `feed-square` | `auto` | Layout profile |
| `cta.selection` | `auto` or CTA name | `auto` | CTA to resolve from brand assets |
| `cta.duration` | float | `2.0` | CTA card duration for text/image on videos |
| `cta.position` | `top-left`, `top-right`, `upper-middle`, `center`, `lower-middle`, `bottom-right`, `bottom-left` | `lower-middle` | Overlay position for image inputs |
| `cta.font` | `auto` or file path | `auto` | Font override for text CTA |
| `cta.font_size` | integer or `null` | `null` | Explicit text size |
| `cta.stroke_width` | integer | `4` | Text outline width |
| `cta.preset` | `bold-white`, `bold-black`, `neon-red`, `neon-yellow`, `minimal` | `bold-white` | Text style preset |
| `cta.background` | hex color | `#000000` | Background color for appended CTA cards |

## Output

- Images: same filename and extension in `output_dir`
- Videos: MP4 named `<original-stem>.mp4`

## Errors

- no CTA configured or no default CTA found
- selected CTA missing from the manifest
- selected CTA asset file missing
- video CTA chosen for an image input
