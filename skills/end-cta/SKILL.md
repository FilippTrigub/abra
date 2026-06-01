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

## Brand fonts

Text CTAs use brand fonts when they are specified and available. Font resolution order is:
1. `cta.font` if set to an explicit font file path
2. a font from `skills/brand-manager/brand-assets/asset-manifest.json` tagged `heading` or `bold`, then any available brand font
3. common system fonts such as DejaVu Sans Bold

Set `CLAW_BRAND_ASSETS_DIR` to point at a different brand asset store. Keep `cta.font` as `auto` when you want downloaded brand fonts from `brand-manager` to be used automatically.

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
| `cta.font` | `auto` or file path | `auto` | Font override for text CTA; `auto` uses available brand fonts first |
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

---

## CTA Strategy Guide

A CTA is only effective when it matches the trust level the content has already established. Asking for a sale before trust exists destroys credibility. Use this guide when selecting or recommending CTAs.

### The monetization ladder

Progress through these steps in order. Only move to the next step once the previous is in place:

1. **Contact info** — the simplest possible CTA: "DM me", "Reply here", or a link in bio. This is the baseline and the first monetization step for any personal brand.
2. **Email list** — retains audience attention outside social platforms. Email beats social reach for conversion. CTA: "Join my weekly note at [link]".
3. **Services** — the natural extension of demonstrated expertise. CTA: "Book a call", "Work with me".
4. **Low-ticket products** — guides, templates, workshops. CTA: "Get the guide".
5. **Higher-ticket offers** — programs, consulting retainers. CTA: "Apply for [program]".

### Match CTA to content type

| Content type | Appropriate CTA |
|---|---|
| Educational / how-to | Email list signup or "follow for more" |
| Story / behind-the-scenes | DM or comment engagement |
| Expert insight / thought leadership | "Work with me" or book a call |
| Product demo / result showcase | Direct service or product link |
| Industry commentary | Email list or profile visit |

### What to avoid

- Never put the highest-commitment CTA (book a call, buy now) on content that hasn't established credibility first
- Avoid more than one CTA per piece — the Rule of One applies here too
- Do not put external links in the body of LinkedIn posts — use the first comment instead
- Avoid vague CTAs like "let me know what you think" on conversion content — be direct about the next step

### First 60 minutes

After posting on LinkedIn, actively responding to comments in the first 60 minutes amplifies reach. If the CTA asks for comments ("drop a question below"), plan to be available to respond. This is part of the CTA strategy, not just engagement hygiene.
