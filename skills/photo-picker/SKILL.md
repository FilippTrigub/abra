---
name: photo-picker
description: >-
  Score a folder of images by visual quality and copy the top-K to output.
  Uses CLIP (aesthetic mode, no prompt needed) or PickScore (pick mode, ranked
  against a text prompt). Ideal for culling large photo batches automatically.
metadata:
  {
    "openclaw":
      {
        "emoji": "🏆",
        "requires": { "bins": ["uv"] },
      },
  }
---

# grade — Aesthetic Image Auto-Selection

Scores images by perceived visual quality and copies the top-K to output.
Eliminates manual photo culling.

The skill directory (where this SKILL.md lives) is referred to as `$SKILL_DIR` below.

---

## When to Use

Use this skill when the user wants to:
- Pick the best photos from a large batch automatically
- Rank images by visual quality without manual review
- Select images most relevant to a specific subject or style (with `--mode pick`)

---

## Setup (first run only)

```bash
cd "$SKILL_DIR" && uv sync
```

On first use, CLIP or PickScore weights are downloaded from HuggingFace (~1–5 GB).

---

## Agent Workflow

### 1. Ask the user

```
Before I score the images, I need to know:

🏆 Mode
  - aesthetic  — rank by general visual quality (no prompt needed)
  - pick       — rank by relevance to a text prompt

🔢 How many to keep?  (default: 3)

💬 Prompt (only for pick mode)
  e.g. "warm, natural light, outdoor portrait"

⚙️  Device
  - auto   — GPU if available, else CPU (default)
  - cpu    — force CPU (~2s/image, fine for small batches)

📁 Input / output directories  (default: ./input and ./output)
```

Wait for user response before proceeding.

### 2. Edit config.json

Write or update `$SKILL_DIR/config.json` based on the user's choices.

### 3. Run

```bash
cd "$SKILL_DIR" && uv run python scripts/score.py --config config.json
```

### 4. Report results

Tell the user which images were selected, their scores, and where they were copied.

---

## Config Reference

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `input_dir` | path | `./input` | Source image folder |
| `output_dir` | path | `./output` | Destination folder |
| `mode` | `aesthetic`, `pick` | `aesthetic` | Scoring strategy |
| `top` | integer ≥ 1 | `3` | Number of images to copy |
| `prompt` | string or null | `null` | Required for `mode=pick` |
| `device` | `auto`, `cpu`, `cuda` | `auto` | Inference device |

---

## Common Invocations

```bash
# Default: pick top 3 by aesthetic score
cd "$SKILL_DIR" && uv run python scripts/score.py

# Pick top 5 matching a prompt
cd "$SKILL_DIR" && uv run python scripts/score.py \
  --mode pick --prompt "warm golden hour portrait" --top 5

# Force CPU (LLM is using the GPU)
cd "$SKILL_DIR" && uv run python scripts/score.py --device cpu

# Custom input/output directories
cd "$SKILL_DIR" && uv run python scripts/score.py \
  --input /path/to/photos --output /path/to/selected
```

---

## Output

Selected images are copied to `output_dir` with rank prefix:
```
01_photo.jpg   ← best
02_photo.jpg
03_photo.jpg
```

---

## Error Handling

- No images in input_dir → clear message, exits cleanly
- Invalid config → all errors printed before any images are scored
- Individual image errors → logged; other images continue

---

## Brand & Content Selection Principles

Raw aesthetic quality is a necessary but not sufficient condition for a good brand photo. Apply these principles when advising on or prompting for photo selection.

### The key visual principle

The lead image for any post is a hook in itself. In the first 3–5 seconds of a Reel, or in the first frame of a carousel, the visual does more work than the text. Before scoring, ask: does this image create contrast, intrigue, or a clear subject that earns attention? A technically excellent but visually static image may underperform a less polished image with stronger contrast or a more compelling subject.

### Carousel-specific selection

For carousels, the **first slide** is the hook and the **second slide** is where the viewer decides to continue. Select images with these roles in mind:
- Slide 1: strongest visual contrast, clearest subject, most scroll-stopping composition
- Slide 2: second-strongest, with a visual payoff that rewards the swipe

Do not pick photos purely by aesthetic score for carousels — pick by narrative sequence.

### Brand alignment in pick mode

When using `--mode pick`, write prompts that reflect brand visual identity, not just generic quality. If the brand is minimalist and technical, a prompt like `"clean, minimal composition, muted tones, professional setting"` will select better than `"beautiful, vibrant, lively"`. Reference `BRAND.md` visual identity before writing the pick prompt.

### Trust and authenticity signals

For personal-brand content, photos that show the expert in a real context (working, presenting, in conversation) often build more trust than highly polished studio shots. If both types are available, prefer authentic context shots for story/educational posts and polished images for product or conversion posts.
