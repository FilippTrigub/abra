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
