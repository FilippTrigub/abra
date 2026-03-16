# OpenClaw - Personal Brand Agent

## Overview

OpenClaw transforms raw inputs into polished, multi-channel social media content while maintaining brand consistency. The agent orchestrates skills automatically, always showing the plan before execution.

**Input:** Video, image, or audio via Telegram  
**Output:** Scheduled posts on Instagram, LinkedIn, Twitter

---

## Workflows

### Workflow 1: Video → Reel

Transform raw video into a branded reel.

| Step | Skill | What happens |
|------|-------|--------------|
| 1 | `brand-manager` | Refresh brand knowledge + available assets |
| 2 | `audio-transcriber` | Transcribe speech for timestamp-aware editing |
| 3 | `video-cutter` | Cut into segments, sequence into coherent edit |
| 4 | `audio-splitter` | Isolate vocals / strip original audio |
| 5 | `music-generator` | Generate background music (optional) |
| 6 | `video-enhancer` | Color grade + audio normalization |
| 7 | `video-captioner` | Burn animated captions |
| 8 | `brand-manager` | Adapt caption to brand voice |
| 9 | `post-scheduler` | Schedule to Instagram/LinkedIn |

---

### Workflow 2: Image → Post

Transform photos into a branded post.

| Step | Skill | What happens |
|------|-------|--------------|
| 1 | `brand-manager` | Refresh brand knowledge + available assets |
| 2 | `photo-picker` | Select best K images from batch |
| 3 | `background-remover` | Remove background, apply brand color |
| 4 | `bokeh-effect` | Apply synthetic depth blur |
| 5 | `social-resizer` | Resize/crop to platform format |
| 6 | `image-captioner` | Auto-generate caption + tags |
| 7 | `brand-manager` | Refine to brand voice |
| 8 | `post-scheduler` | Schedule post |

---

### Workflow 3: Audio → Post

Transform voice message or audio into a text post.

| Step | Skill | What happens |
|------|-------|--------------|
| 1 | `brand-manager` | Refresh brand knowledge + available assets |
| 2 | `audio-transcriber` | Transcribe speech to text |
| 3 | `brand-manager` | Adapt to brand voice |
| 4 | `post-scheduler` | Schedule as text post with transcript |

---

### Workflow 4: Brand Enrichment

Add new content to keep the brand knowledge fresh and accurate.

| Step | Skill | What happens |
|------|-------|--------------|
| 1 | `brand-manager` | Analyze new content, extract brand insights |
| 2 | `brand-manager` | Update BRAND.md with new voice/tone examples |
| 3 | `brand-manager` | Store new assets (logos, images, fonts) |

**What to send:**
- Articles or blog posts you've written
- Videos of talks or presentations
- Images of your work or events
- Text describing your values, messaging, or goals
- Any content that represents who you are

---

## How It Works

### Telegram Bot

The primary input channel. The bot:

1. Receives files from authorized users
2. Downloads to workspace
3. Forwards to Orchestrator
4. Shows execution plan
5. Waits for confirmation (✅ Proceed / ✏️ Adjust / ❌ Cancel)
6. Streams progress updates
7. Delivers final result

### Orchestrator

The brain that resolves input into skill execution:

1. **Detect** — Identify input type (video/image/audio/text)
2. **Plan** — Select skills and order
3. **Confirm** — Show plan to user
4. **Execute** — Run each skill sequentially
5. **Report** — Summarize results

### Decision Rules

The Orchestrator applies these rules:

1. **Brand first** — `brand-manager` always runs first to refresh knowledge
2. **Transcription first** — if input contains video/audio, `audio-transcriber` runs before editing
3. **Selection before enhancement** — `photo-picker` before `bokeh-effect` / `background-remover`
4. **Clean before composite** — `audio-splitter` / `video-matte` before `video-enhancer`
5. **Enhance before caption** — `video-enhancer` before `video-captioner`
6. **Brand last** — `brand-manager` runs before `post-scheduler` to adapt content
7. **Always confirm** — show plan before execution
8. **VRAM aware** — recommend `--device cpu` when GPU memory is limited

---

## Intent Detection

| User sends | Workflow triggered |
|------------|-------------------|
| Video file(s) | Video → Reel |
| Photo(s) | Image → Post |
| Voice message / Audio | Audio → Post |
| Text describing brand content | Brand Enrichment |
| `/init` | Brand Enrichment (initial setup) |

---

## Response Format

### Before Execution

```
🎯 GOAL: <what the user wants>

📋 EXECUTION PLAN:
  Step 1 — [skill]  →  <what it does>
  Step 2 — [skill]  →  <what it does>
  ...

⚙️  HARDWARE: <VRAM requirements>

✅ Proceed? (yes / adjust / cancel)
```

### After Confirmation

```
▶ Step 1 [skill] — running ...  ✓ done
▶ Step 2 [skill] — running ...  ✓ done
...
🏁 FINISHED — output at output/[channel]/[YYYY-MM-DD]/
```

---

## Error Handling

| Situation | Behavior |
|-----------|----------|
| Step fails | Report error, offer skip or retry |
| Insufficient VRAM | Recommend `--device cpu` |
| Missing input | Ask user to provide files |
| Ambiguous request | Ask one clarifying question |
| No BRAND.md | Auto-trigger Brand Enrichment |
| Telegram file >2GB | Ask to split or use CLI |

---

## Directory Structure

```
claw-parade/
├── BRAND.md                   # Brand identity (generated)
├── WORKFLOW.md                # This file
├── skills/
│   ├── brand-manager/        # Brand identity + assets
│   ├── video-enhancer/      # Color grade + audio normalize
│   ├── video-captioner/     # Whisper + animated captions
│   ├── social-resizer/      # Image resize + filters
│   ├── post-scheduler/      # Buffer API scheduling
│   └── ...                  # All other skills
├── input/                    # Raw input files (staging for processing)
│   └── staging/             # Temporary staging area
├── output/                   # Processed content by workflow/date
├── archive/                  # Processed inputs after scheduling
│   └── <workflow>/
│       └── <timestamp>/    # Archived with UTC timestamp
└── workspace/
    └── input/telegram/       # Telegram bot downloads
```

## Default Behavior

### Input Handling

1. When user provides media, it is copied to `input/staging/`
2. The workflow processes from staging
3. Original files remain in staging until processing completes

### Archiving

After a post is scheduled (when `post-scheduler` step completes):
1. Input files are moved from `input/staging/` to `archive/<workflow>/<UTC-timestamp>/`
2. Timestamp format: `YYYYMMDDTHHMMSSZ` (e.g., `20240315T143022Z`)
3. Example: `archive/video-to-reel/20240315T143022Z/`

This ensures:
- Original media is preserved for reference
- Easy audit trail of what content was posted when
- Storage doesn't accumulate in input directory

---

## Skills Reference

| Skill | Input | Output | Position |
|-------|-------|--------|----------|
| `brand-manager` | content + BRAND.md | brand-aligned output | first + last |
| `audio-transcriber` | video/audio | transcript JSON | early |
| `video-cutter` | video + transcript | cut segments | early |
| `photo-picker` | images | top-K images | early |
| `background-remover` | images | transparent PNG | mid |
| `bokeh-effect` | images | bokeh image | mid |
| `image-captioner` | images | caption JSON | mid |
| `audio-splitter` | video/audio | vocal/music stems | mid |
| `music-generator` | prompt | music file | mid |
| `video-enhancer` | video | graded video | late |
| `video-captioner` | video | captioned video | late |
| `social-resizer` | images | resized images | late |
| `post-scheduler` | text + media | scheduled post | final |

---

## Configuration

```bash
# Brand
CLAW_BRAND_FILE=./BRAND.md

# Directories
CLAW_INPUT_DIR=./input/
CLAW_OUTPUT_DIR=./output/

# Scheduling
CLAW_BUFFER_DAYS=5
CLAW_DEFAULT_CHANNEL=instagram

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ALLOWED_USER_IDS=123456789

# Buffer
BUFFER_API_KEY=your-buffer-token
```

---

## Best Practices

1. **Start with Brand Enrichment** — feed the agent your content first
2. **Always confirm** — review the plan before execution
3. **Keep brand fresh** — add new content regularly
4. **GPU-heavy last** — run intensive skills when LLM is idle
5. **Enhance then caption** — `video-enhancer` before `video-captioner`
