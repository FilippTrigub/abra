# OpenClaw Personal Brand Agent - Workflow

## Overview

This agent transforms raw inputs into polished, multi-channel social media content with images/videos. It maintains brand consistency throughout and schedules publications via Buffer.

Starting from this version, the agent also acts as an **Orchestrator**: the user can describe any creative or publishing goal in plain language, and the agent will resolve it into an ordered sequence of skills, explain the plan, and execute it step by step.

The primary input interface is a **Telegram Bot** — the user sends videos, images, voice messages, or text commands directly from Telegram, and the agent handles the rest.

---

## 📱 Telegram Bot Input Channel

### How It Works

The Telegram bot (`telegram-bot` service in `docker-compose.yml`) acts as the **front door** to the Orchestrator. It:

1. **Receives messages** from the authorised Telegram user (text, video, photo, voice, document)
2. **Downloads media files** to `~/.openclaw/workspace/input/telegram/<job-id>/`
3. **Forwards the request + file paths** to the `openclaw-gateway` via the internal `bot-shared` Docker network
4. **Receives the execution plan** from the Orchestrator and sends it back to the user as a Telegram message
5. **Waits for user confirmation** (inline keyboard: ✅ Proceed / ✏️ Adjust / ❌ Cancel)
6. **Streams progress updates** back to the user as each skill step completes
7. **Delivers the final result** — sends the processed video/image/caption back to Telegram and confirms scheduling

### Message Types & Automatic Intent Detection

The bot auto-detects intent from what the user sends:

| User sends | Auto-detected intent | Default skill plan triggered |
|------------|---------------------|-----------------------------|
| Video file(s) + text | Video processing request | audio-transcriber → video-cutter → audio-splitter → music-generator → video-enhancer → video-captioner → brand-manager → post-scheduler |
| Video file(s) only | Video processing request | audio-transcriber → video-cutter → video-enhancer → video-captioner → brand-manager → post-scheduler |
| Photo(s) + text | Image post request | photo-picker → background-remover → bokeh-effect → social-resizer → image-captioner → brand-manager → post-scheduler |
| Photo(s) only | Image post request | photo-picker → social-resizer → image-captioner → brand-manager → post-scheduler |
| Voice message | Transcription + post | audio-transcriber → brand-manager → post-scheduler |
| Text only | Orchestrator request | Plan resolved by Orchestrator from text |
| `/start` | Onboarding | Show available commands |
| `/init` | Brand init phase | Trigger brand-manager → generate BRAND.md |
| `/status` | Job status check | Report current running job and step |
| `/cancel` | Cancel current job | Stop execution, clean up tmp files |

### Telegram Conversation Flow

```
User                          Telegram Bot                    Orchestrator / Skills
 │                                │                                  │
 │── sends video + "make a reel" ─▶│                                  │
 │                                 │── download file to workspace ───▶│
 │                                 │── forward request + path ────────▶│
 │                                 │                                  │ resolve skill graph
 │                                 │◀─ execution plan ────────────────│
 │◀─ 📋 Plan: Step 1 verbatim... ──│                                  │
 │   [✅ Proceed] [✏️ Adjust] [❌]  │                                  │
 │── taps ✅ Proceed ─────────────▶│                                  │
 │                                 │── confirm execution ─────────────▶│
 │◀─ ▶ Step 1 verbatim — running ──│◀─ step progress ─────────────────│
 │◀─ ✓ Step 1 done ────────────────│◀─ step done ─────────────────────│
 │◀─ ▶ Step 2 snip — running ──────│◀─ step progress ─────────────────│
 │   ...                           │                                  │
 │◀─ 🏁 Done! Here's your reel ────│◀─ final output path ─────────────│
 │◀─ [video file sent] ────────────│                                  │
 │◀─ Scheduled for Instagram ✅ ───│                                  │
```

### Sending Multiple Videos (Fragments)

To send multiple video fragments for merging:

1. Send all video files as a **media group** (album) in one Telegram message
2. Add a caption describing the goal: *"merge these into one reel"*
3. The bot groups all files under the same `job-id` and passes them together to the Orchestrator
4. The Orchestrator processes them as a batch through `verbatim` → `snip` → ... → `mux`

Alternatively, send videos one by one and use `/merge` to combine the last N uploads.

### Authorisation

Only messages from `TELEGRAM_ALLOWED_USER_IDS` (set in `.env`) are processed. All other users receive a silent ignore or a polite rejection message.

```bash
# .env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321   # comma-separated Telegram user IDs
```

---

## 🧠 Orchestrator Mode

### What It Is

The Orchestrator accepts a **free-form user request** (e.g. *"create a video from different fragments"*, *"post a portrait photo to Instagram"*, *"make background music for my reel"*) and:

1. **Parses the intent** — understands the desired outcome
2. **Resolves the skill graph** — selects which skills are needed and in what order
3. **Presents the execution plan** — shows the user a step-by-step plan before doing anything
4. **Executes sequentially** — runs each skill, passing outputs to the next step as inputs
5. **Reports results** — summarises what was produced and where files are saved

### Trigger

Any message that is **not** a direct CLI command is treated as an orchestrator request. The agent will never silently guess — it always shows the plan first and asks for confirmation.

---

### Orchestrator Response Format

For every request the agent outputs:

```
🎯 GOAL: <one-sentence restatement of what the user wants>

📋 EXECUTION PLAN:
  Step 1 — [skill-name]  →  <what it does for this request>
  Step 2 — [skill-name]  →  <what it does for this request>
  ...

⚙️  HARDWARE NOTE: <VRAM required / CPU fallback recommendation>

✅ Proceed? (yes / adjust / cancel)
```

After confirmation, the agent runs each step and reports:

```
▶ Step 1 [skill-name] — running ...  ✓ done  →  output/tmp/step1/
▶ Step 2 [skill-name] — running ...  ✓ done  →  output/tmp/step2/
...
🏁 FINISHED — final output at output/[channel]/[YYYY-MM-DD]/
```

---

### Skill Catalogue (Orchestrator Reference)

The agent uses this table to resolve which skills to include and in what order.

| Skill | Input types | Output types | Typical position |
|-------|-------------|--------------|-----------------|
| `audio-transcriber` | video, audio | transcript JSON | early (transcription) |
| `video-cutter` | video + transcript | cut video segments | early (editing) |
| `photo-picker` | images (folder) | top-K images | early (selection) |
| `background-remover` | images | transparent PNG | mid (cleanup) |
| `bokeh-effect` | images | bokeh image | mid (enhancement) |
| `image-captioner` | images | caption JSON | mid (metadata) |
| `image-generator` | text prompt | generated image | mid (creation) |
| `video-matte` | video | matte video | mid (compositing) |
| `frame-interpolator` | video | smooth video | mid (quality) |
| `audio-splitter` | video, audio | vocals + music stems | mid (audio) |
| `music-generator` | text prompt, video | music file | mid (audio) |
| `animate-image` | image + prompt | animated clip | mid (animation) |
| `video-editor` | video + prompt | edited video | mid (editing) |
| `video-enhancer` | video | colour-graded + normalised video | late (polish) |
| `video-captioner` | video | video with animated captions | late (polish) |
| `social-resizer` | images | processed images | late (polish) |
| `brand-manager` | draft + BRAND.md | brand-aligned content | late (brand) |
| `canva-connector` | assets + design brief | design export | late (design) |
| `post-scheduler` | post text + media | scheduled post | final (publish) |

---

### Example Request Resolutions

#### "Create a video from different fragments" (sent via Telegram)
```
🎯 GOAL: Combine multiple raw video fragments into one polished, brand-aligned video.

📋 EXECUTION PLAN:
  Step 1 — audio-transcriber →  Transcribe all fragments for timestamp-aware cutting
  Step 2 — video-cutter      →  Cut and sequence fragments into a coherent edit
  Step 3 — audio-splitter    →  Strip original audio / isolate voice track
  Step 4 — music-generator   →  Generate royalty-free background music
  Step 5 — video-matte      →  Remove video background if needed (optional)
  Step 6 — frame-interpolator →  Smooth transitions to 60fps (optional)
  Step 7 — video-enhancer   →  Colour grade and normalise audio
  Step 7b — video-captioner →  Burn animated captions
  Step 8 — brand-manager    →  Adapt caption text to brand voice
  Step 9 — post-scheduler   →  Schedule final reel to Instagram/LinkedIn

⚙️  HARDWARE NOTE: Steps 3–7 require 2–8 GB VRAM. Use --device cpu for audio-splitter/music-generator if needed.
```

#### "Post a portrait photo to Instagram"
```
🎯 GOAL: Pick the best portrait, enhance it, write a caption, and schedule it.

📋 EXECUTION PLAN:
  Step 1 — photo-picker      →  Score and select best photo from input folder
  Step 2 — background-remover →  Remove background, apply brand colour
  Step 3 — bokeh-effect     →  Apply synthetic bokeh for professional look
  Step 4 — social-resizer    →  Resize/crop to Instagram square + apply filter
  Step 5 — image-captioner  →  Auto-generate caption and tags
  Step 6 — brand-manager    →  Refine caption to match brand voice
  Step 7 — post-scheduler   →  Schedule post with optimal timing

⚙️  HARDWARE NOTE: All steps support --device cpu. GPU recommended for steps 2–3.
```

#### "Make a music video teaser from my talk recording"
```
🎯 GOAL: Turn a talk recording into a punchy teaser with captions and music.

📋 EXECUTION PLAN:
  Step 1 — audio-transcriber →  Transcribe the talk
  Step 2 — video-cutter     →  Extract the 3 most impactful 10-second segments
  Step 3 — audio-splitter   →  Remove background noise, keep clean voice
  Step 4 — music-generator  →  Generate matching background music
  Step 5 — animate-image   →  Animate title card image into intro clip
  Step 6 — video-enhancer  →  Colour grade and normalise audio
  Step 6b — video-captioner →  Burn animated captions
  Step 7 — brand-manager   →  Write brand-aligned post copy
  Step 8 — post-scheduler  →  Schedule reel
```

#### "Generate an image for my next LinkedIn post"
```
🎯 GOAL: Create a brand-consistent image from a text description.

📋 EXECUTION PLAN:
  Step 1 — image-generator  →  Generate image from text prompt (FLUX/SDXL)
  Step 2 — social-resizer   →  Resize to LinkedIn dimensions
  Step 3 — image-captioner  →  Auto-generate alt-text and caption suggestions
  Step 4 — brand-manager    →  Align caption with brand voice
  Step 5 — post-scheduler   →  Schedule LinkedIn post
```

---

### Orchestrator Decision Rules

The agent applies these rules when building the execution plan:

1. **Transcription first** — if input contains video/audio, `audio-transcriber` always runs before editing skills.
2. **Selection before enhancement** — `photo-picker` runs before `bokeh-effect`, `background-remover`, or `social-resizer`.
3. **Clean before composite** — `audio-splitter`/`video-matte` run before `video-enhancer`/`video-captioner` or `music-generator`.
4. **Create before polish** — `image-generator`/`animate-image` run before `social-resizer`/`video-enhancer`/`video-captioner`.
5. **Enhance before caption** — `video-enhancer` (colour grade) runs before `video-captioner` (caption burn-in) so filters don't affect caption pixels.
6. **Brand last before publish** — `brand-manager` always runs after media is finalized, before `post-scheduler`.
6. **Always confirm** — the agent presents the plan and waits for user approval before executing.
7. **Optional steps flagged** — steps that depend on user preference are marked `(optional)`.
8. **VRAM budget respected** — if running on limited hardware, the agent recommends `--device cpu` flags or suggests running GPU-heavy steps when the LLM is idle.

---

### Error Handling in Orchestrator Mode

| Situation | Agent behaviour |
|-----------|----------------|
| Step fails | Report error, offer to skip or retry with fallback params |
| Insufficient VRAM | Recommend `--device cpu` or defer GPU steps |
| Missing input files | Ask user to provide files before proceeding |
| Ambiguous request | Ask one clarifying question (goal or channel) |
| No BRAND.md | Auto-trigger Init phase before any brand-related step |
| Unsupported output format | Suggest closest alternative skill |
| Telegram file too large (>2 GB) | Ask user to split into smaller files or use `/upload` CLI |

---

## Phase 1: Init (One-Time Setup)

**Goal**: Establish brand state and create BRAND.md specification

**Steps**:
1. Gather raw input about the brand persona (resume, bios, past content, notes)
2. Run `brand-awareness` skill → `read-about-me` tool
3. Review generated BRAND.md
4. Adjust if needed based on additional information

**Output**: BRAND.md file with complete brand identity specification

---

## Phase 2: Regular Processing (Per Content Item)

**Goal**: Process raw input into ready-to-publish content

> **Tip**: In Orchestrator Mode (via Telegram or CLI), you don't need to follow these steps manually. Simply describe your goal and the agent will resolve the plan automatically. The steps below are the manual equivalent for reference.

### 2.1 Read Raw Input
```
Input: New article link, meeting notes, idea snippet, blog post draft
Action: Extract key insights, main points, and content opportunities
Output: Content brief with highlights and angles
```

### 2.2 Generate Post Draft
```
Input: Content brief
Action: Create initial post content based on main insights
Output: Draft post (generic, not yet brand-aligned)
```

### 2.3 Adapt to Brand
```
Input: Draft post, BRAND.md, target channel (e.g., "instagram")
Action: Run `brand-awareness` skill → `adapt-content-to-brand` tool
Output: Brand-aligned post ready for channel formatting
```

### 2.4 Process Media (Image/Video)

**Images** — use the `social-resizer` skill:
```bash
cd skills/social-resizer/scripts && uv sync && npm install
uv run --project skills/social-resizer/scripts \
  python skills/social-resizer/scripts/process.py --config config.json
```

**Videos** — colour grade with `video-enhancer`, then caption with `video-captioner`:
```bash
# Step 1: colour grade + audio normalisation
cd skills/video-enhancer && uv sync
uv run python scripts/enhance.py --preset cinematic
# Output lands in skills/video-enhancer/output/

# Step 2: animated captions (futuristic style)
cd ../video-captioner && uv sync
uv run python scripts/caption_service.py --css scripts/futuristic.css
# Output lands in skills/video-captioner/output/
```

### 2.5 Organize Output
```
Files stored in output/[channel]/[YYYY-MM-DD]/
```

### 2.6 Schedule with Buffer
```bash
uv run posts.py create \
  --channel-id CHANNEL_ID \
  --text "Post caption" \
  --mode customScheduled \
  --due-at "2026-04-01T12:00:00Z" \
  --video-url output/instagram/2026-04-01/video.mp4 \
  --ig-type reel
```

---

## Directory Structure

```
claw-parade/
├── SOUL.md                    # Agent identity and behavior spec
├── BRAND.md                   # Brand identity (generated)
├── WORKFLOW.md                # This file
├── skills/
│   ├── brand-manager/        # Brand identity maintenance
│   ├── video-enhancer/      # Video sharpening, colour grading, audio normalisation
│   ├── video-captioner/     # Whisper transcription + animated caption burn-in
│   ├── social-resizer/      # Image resize, crop, and filtering
│   ├── post-scheduler/      # Schedule and publish posts
│   └── ...                  # All other skills
├── input/                    # Raw input files
│   └── [user-provided content]
├── output/                   # Processed outputs
│   ├── instagram/
│   │   └── [YYYY/MM/DD]/
│   ├── linkedin/
│   └── twitter/
└── workspace/
    └── input/
        └── telegram/          # Files received from Telegram bot
            └── <job-id>/     # One folder per job
```

---

## Skill Integration Map

| Skill | Location | Purpose |
|-------|----------|---------|
| brand-manager | `skills/brand-manager/` | Brand identity maintenance |
| video-enhancer | `skills/video-enhancer/` | Video sharpening, colour grading, audio normalisation |
| video-captioner | `skills/video-captioner/` | Whisper transcription + animated caption burn-in |
| social-resizer | `skills/social-resizer/` | Image resize, crop, and filtering |
| post-scheduler | `skills/post-scheduler/` | Schedule and publish posts |
| audio-transcriber | `skills/audio-transcriber/` | Audio/video transcription |
| video-cutter | `skills/video-cutter/` | Video cutting and sequencing |
| photo-picker | `skills/photo-picker/` | Aesthetic photo selection |
| background-remover | `skills/background-remover/` | Image background removal |
| bokeh-effect | `skills/bokeh-effect/` | Depth bokeh enhancement |
| image-captioner | `skills/image-captioner/` | Auto-captioning and tagging |
| image-generator | `skills/image-generator/` | Text-to-image generation |
| video-matte | `skills/video-matte/` | Video background removal |
| frame-interpolator | `skills/frame-interpolator/` | Frame interpolation |
| audio-splitter | `skills/audio-splitter/` | Audio stem separation |
| music-generator | `skills/music-generator/` | Background music generation |
| animate-image | `skills/animate-image/` | Image-to-video animation |
| video-editor | `skills/video-editor/` | AI video editing/inpainting |
| canva-connector | `skills/canva-connector/` | Canva design integration |

---

## Configuration

### Environment Variables
```bash
# Core
BUFFER_API_KEY=your-buffer-token
CLAW_BRAND_FILE=./BRAND.md
CLAW_INPUT_DIR=./input/
CLAW_OUTPUT_DIR=./output/
CLAW_BUFFER_DAYS=5
CLAW_DEFAULT_CHANNEL=instagram

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ALLOWED_USER_IDS=123456789

# Gateway
OPENCLAW_GATEWAY_TOKEN=your-gateway-token
OPENCLAW_GATEWAY_PORT=18789
```

---

## Error Handling

| Issue | Resolution |
|-------|------------|
| No BRAND.md | Auto-trigger Init phase |
| Unclear input | Request clarification via chat |
| Media generation fail | Fall back to templates |
| Scheduling fail | Queue to manual review |
| Channel not supported | Suggest alternative channels |
| Telegram file >2 GB | Ask user to split or use CLI upload |

---

## Best Practices

1. **Use Telegram Bot** — send files and requests directly from your phone, get results back in chat
2. **Use Orchestrator Mode** — describe your goal, let the agent plan the skill sequence
3. **Start with Init** — don't skip brand setup (`/init` command in Telegram)
4. **Review before schedule** — always confirm the execution plan before it runs
5. **Maintain buffer** — keep 3–7 days of scheduled content
6. **Iterate on brand** — update BRAND.md as persona evolves
7. **GPU-heavy last** — run `animate-image`, `video-editor`, `video-matte` when the LLM is idle to avoid VRAM contention
8. **Enhance then caption** — always run `video-enhancer` before `video-captioner` when using both; colour grading must precede caption burn-in
