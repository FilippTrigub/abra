---
name: image-captioner
description: >-
  Auto-describe and caption images using a local vision-language model. Writes a
  JSON sidecar per image containing a one-sentence description, a suggested
  Instagram caption with hashtags, and detected content tags.
metadata:
  {
    "openclaw":
      {
        "emoji": "🔍",
        "requires": { "bins": ["uv"] },
      },
  }
---

# alt — Auto-Caption

Runs a local VLM over each image in `input_dir` and writes a JSON sidecar to
`output_dir`. Useful for auto-generating captions, understanding batch content,
or feeding descriptions into other tools.

The skill directory (where this SKILL.md lives) is referred to as `$SKILL_DIR` below.

---

## When to Use

Use this skill when the user wants to:
- Auto-generate Instagram captions from photos
- Understand what's in a batch of images without reviewing them manually
- Feed image descriptions into a content pipeline or scheduling tool

---

## Setup (first run only)

```bash
cd "$SKILL_DIR" && uv sync
```

moondream2 weights are downloaded on first use (~4 GB from HuggingFace).
Phi-4 weights are larger (~8 GB) and require a GPU.

---

## Agent Workflow

### 1. Ask the user

```
Before I describe the images, I need to know:

🧠 Model
  - moondream2  — 2B params, fast, works on CPU  (default)
  - phi4        — 3.8B multimodal, higher quality, requires GPU

💬 Caption style (optional — I'll use a sensible default)
  e.g. "Casual and fun with emojis" or "Professional and inspiring"

⚙️  Device
  - auto  — GPU if available, else CPU (default)
  - cpu   — moondream2 only; ~7s/image on a modern desktop CPU

📁 Input / output directories  (default: ./input and ./output)
```

### 2. Edit config.json

If the user gives a caption style, incorporate it into `prompt_caption`.
Example: `"Write a fun, emoji-rich Instagram caption for this image. Include 3-5 hashtags."`

If the user asks for branded visuals, check `skills/brand-manager/brand-assets/asset-manifest.json` for available fonts and mention the preferred brand font in the generated caption guidance or handoff notes. This skill writes JSON sidecars only, so it does not render text itself; downstream renderers such as `visual-hook`, `video-captioner`, and `end-cta` should use the actual brand font files when they are specified and available.

### 3. Run

```bash
cd "$SKILL_DIR" && uv run python scripts/describe.py --config config.json
```

The first run downloads model weights — warn the user this may take a few minutes.

### 4. Report results

Show the description and caption for each image. Tell the user where the JSON files were written.

---

## Config Reference

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `input_dir` | path | `./input` | Source image folder |
| `output_dir` | path | `./output` | Destination folder for JSON sidecars |
| `model` | `moondream2`, `phi4` | `moondream2` | Vision-language model |
| `prompt_description` | string | `"Describe this image in one sentence."` | Prompt for the description field |
| `prompt_caption` | string | `"Write an engaging Instagram caption…"` | Prompt for the caption field |
| `device` | `auto`, `cpu`, `cuda` | `auto` | Inference device |

---

## Common Invocations

```bash
# Default (moondream2, auto device)
cd "$SKILL_DIR" && uv run python scripts/describe.py

# Higher quality (GPU required)
cd "$SKILL_DIR" && uv run python scripts/describe.py --model phi4

# Force CPU
cd "$SKILL_DIR" && uv run python scripts/describe.py --device cpu

# Custom caption prompt
cd "$SKILL_DIR" && uv run python scripts/describe.py \
  --prompt-caption "Write a professional LinkedIn caption for this image."
```

---

## Output

For each `photo.jpg` in `input_dir`, writes `photo.json` in `output_dir`:

```json
{
  "description": "A woman in a sunlit café holding a coffee cup.",
  "caption": "Morning rituals ☕✨ Starting the day right. #coffeetime #morningvibes #cafe",
  "tags": ["portrait", "coffee", "indoor", "warm light"]
}
```

When brand fonts are relevant, include the font name/tag in downstream instructions rather than embedding a font file in this JSON. Rendering skills are responsible for resolving the manifest path and applying the font.

---

## Error Handling

- `phi4` + `cpu` → rejected at config validation with a clear message
- Model download failures → shown with HuggingFace error details
- Individual image errors → logged; other images continue

---

## Remote Inference

This skill supports **optional remote captioning** while preserving the same JSON sidecar output.

- Default behavior is still **local**
- Remote providers are **opt-in only**
- Supported providers: `huggingface`, `replicate`

### Config keys

| Key | Default | Notes |
|-----|---------|-------|
| `provider` | `null` | `null`, `local`, or `none` keeps local mode |
| `remote_model` | `null` | Optional provider-specific VLM model override |
| `hf_token_env` | `HF_TOKEN` | HuggingFace auth env var name |
| `replicate_api_key_env` | `REPLICATE_API_TOKEN` | Replicate auth env var name |
| `remote_timeout_seconds` | `300` | Remote call timeout |

### Examples

```bash
# HuggingFace remote image captioning
export HF_TOKEN=hf_your_token
uv run python scripts/describe.py --config config.json --provider huggingface

# Replicate remote image captioning
export REPLICATE_API_TOKEN=r8_your_token
uv run python scripts/describe.py --config config.json --provider replicate --remote-model <replicate-model-slug>
```

### Notes

- Remote mode still writes the same `description` / `caption` / `tags` JSON sidecar
- Missing credentials fail fast; there is **no silent fallback** to local mode
- Replicate requires an explicit model slug for remote captioning

---

## Caption Quality Standards

The caption is as important as the image. A weak caption wastes a strong visual. Apply these principles when generating or prompting for captions.

### Rule of One

Every caption should carry one clear central idea. If the caption tries to make multiple points, it becomes diffuse and loses impact. The strongest captions have a single spear tip: one promise, one lesson, one observation, one story beat.

Test: can you say this caption in one sentence? Do all the lines support the same idea? If not, cut until the core is clear.

### Hook first

The first line of any caption is the hook. On Instagram, only the first ~125 characters are shown before "more" — that first line must earn the tap. On LinkedIn, the first line is the headline.

Hook patterns that work:
- **Contrarian**: "Stop doing X."
- **Curiosity gap**: "Most people don't realize..."
- **Identity callout**: "If you're [X], pay attention."
- **Authority/experience**: "If I had to start over, here's what I'd do."
- **Pain-point**: "This is why you're stuck at [X]."

Avoid opening with "I" or with a warm-up sentence that says nothing. The first line should earn the rest of the read.

### Platform-specific structure

**Instagram**:
- Hook first (≤125 chars)
- Body: story, lesson, or insight
- 3–5 relevant hashtags at the end
- Authentic tone — avoid polished marketing language
- Emoji are acceptable but should reinforce meaning, not decorate

**LinkedIn**:
- 600–800 characters for best reach; 100–150 for high CTR when needed
- Strong hook in the first line
- No external links in the post body (LinkedIn suppresses reach for outbound links)
- Frameworks that work: Hook → insight → breakdown → CTA; or Story → lesson → action → engagement question
- Clarity over creativity — readers scan quickly
- Avoid: emoji overload, excessive whitespace, back-to-back same format, external fonts

### Anti-generic test

Before accepting a generated caption, ask: does this sound like the expert who took this photo, or does it sound like generic AI writing? If it could have been written by anyone about anything, it fails. The caption must reflect a specific point of view, observation, or lived moment.

### Avoid

- Opening with "I" as the first word
- Vague inspirational statements without a concrete point
- Emoji used as visual padding rather than to reinforce meaning
- More than one call-to-action in a single caption
- Hashtag spam (10+ hashtags) on LinkedIn
