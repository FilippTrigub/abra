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
| Video file(s) + text | Video processing request | verbatim → snip → demix → score → mux → persona → buffer |
| Video file(s) only | Video processing request | verbatim → snip → mux → persona → buffer |
| Photo(s) + text | Image post request | grade → knockout → portrait → filter → alt → persona → buffer |
| Photo(s) only | Image post request | grade → filter → alt → persona → buffer |
| Voice message | Transcription + post | verbatim → persona → buffer |
| Text only | Orchestrator request | Plan resolved by Orchestrator from text |
| `/start` | Onboarding | Show available commands |
| `/init` | Brand init phase | Trigger brand-awareness → generate BRAND.md |
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
| `verbatim` | video, audio | transcript JSON | early (transcription) |
| `snip` | video + transcript | cut video segments | early (editing) |
| `grade` | images (folder) | top-K images | early (selection) |
| `knockout` | images | transparent PNG | mid (cleanup) |
| `portrait` | images | bokeh image | mid (enhancement) |
| `alt` | images | caption JSON | mid (metadata) |
| `render` | text prompt | generated image | mid (creation) |
| `keyer` | video | matte video | mid (compositing) |
| `tween` | video | smooth video | mid (quality) |
| `demix` | video, audio | vocals + music stems | mid (audio) |
| `score` | text prompt, video | music file | mid (audio) |
| `liven` | image + prompt | animated clip | mid (animation) |
| `cutlab` | video + prompt | edited video | mid (editing) |
| `mux` | video + captions | final video | late (polish) |
| `filter` | images | processed images | late (polish) |
| `persona` | draft + BRAND.md | brand-aligned content | late (brand) |
| `canva` | assets + design brief | design export | late (design) |
| `buffer` | post text + media | scheduled post | final (publish) |

---

### Example Request Resolutions

#### "Create a video from different fragments" (sent via Telegram)
```
🎯 GOAL: Combine multiple raw video fragments into one polished, brand-aligned video.

📋 EXECUTION PLAN:
  Step 1 — verbatim   →  Transcribe all fragments for timestamp-aware cutting
  Step 2 — snip       →  Cut and sequence fragments into a coherent edit
  Step 3 — demix      →  Strip original audio / isolate voice track
  Step 4 — score      →  Generate royalty-free background music
  Step 5 — keyer      →  Remove video background if needed (optional)
  Step 6 — tween      →  Smooth transitions to 60fps (optional)
  Step 7 — mux        →  Merge captions, colour grade, normalise audio
  Step 8 — persona    →  Adapt caption text to brand voice
  Step 9 — buffer     →  Schedule final reel to Instagram/LinkedIn

⚙️  HARDWARE NOTE: Steps 3–7 require 2–8 GB VRAM. Use --device cpu for demix/score if needed.
```

#### "Post a portrait photo to Instagram"
```
🎯 GOAL: Pick the best portrait, enhance it, write a caption, and schedule it.

📋 EXECUTION PLAN:
  Step 1 — grade      →  Score and select best photo from input folder
  Step 2 — knockout   →  Remove background, apply brand colour
  Step 3 — portrait   →  Apply synthetic bokeh for professional look
  Step 4 — filter     →  Resize/crop to Instagram square + apply filter
  Step 5 — alt        →  Auto-generate caption and tags
  Step 6 — persona    →  Refine caption to match brand voice
  Step 7 — buffer     →  Schedule post with optimal timing

⚙️  HARDWARE NOTE: All steps support --device cpu. GPU recommended for steps 2–3.
```

#### "Make a music video teaser from my talk recording"
```
🎯 GOAL: Turn a talk recording into a punchy teaser with captions and music.

📋 EXECUTION PLAN:
  Step 1 — verbatim   →  Transcribe the talk
  Step 2 — snip       →  Extract the 3 most impactful 10-second segments
  Step 3 — demix      →  Remove background noise, keep clean voice
  Step 4 — score      →  Generate matching background music
  Step 5 — liven      →  Animate title card image into intro clip
  Step 6 — mux        →  Burn animated captions, colour grade, mix audio
  Step 7 — persona    →  Write brand-aligned post copy
  Step 8 — buffer     →  Schedule reel
```

#### "Generate an image for my next LinkedIn post"
```
🎯 GOAL: Create a brand-consistent image from a text description.

📋 EXECUTION PLAN:
  Step 1 — render     →  Generate image from text prompt (FLUX/SDXL)
  Step 2 — filter     →  Resize to LinkedIn dimensions
  Step 3 — alt        →  Auto-generate alt-text and caption suggestions
  Step 4 — persona    →  Align caption with brand voice
  Step 5 — buffer     →  Schedule LinkedIn post
```

---

### Orchestrator Decision Rules

The agent applies these rules when building the execution plan:

1. **Transcription first** — if input contains video/audio, `verbatim` always runs before editing skills.
2. **Selection before enhancement** — `grade` runs before `portrait`, `knockout`, or `filter`.
3. **Clean before composite** — `demix`/`keyer` run before `mux` or `score`.
4. **Create before polish** — `render`/`liven` run before `filter`/`mux`.
5. **Brand last before publish** — `persona` always runs after media is finalized, before `buffer`.
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

**Images** — use the `filter` skill:
```bash
cd skills/filter/scripts && uv sync && npm install
uv run --project skills/filter/scripts \
  python skills/filter/scripts/process.py --config config.json
```

**Videos** — use the `mux` skill:
```bash
cd ~/.openclaw/skills/mux && uv sync
uv run python scripts/caption_service.py \
  --output output --preset cinematic \
  --css ~/.openclaw/skills/mux/scripts/futuristic.css
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
│   ├── persona/               # Brand identity maintenance
│   ├── mux/                   # Video enhancement and captioning
│   ├── filter/                # Image resize, crop, and filtering
│   ├── buffer/                # Schedule and publish posts
│   └── ...                    # All other skills
├── input/                     # Raw input files
│   └── [user-provided content]
├── output/                    # Processed outputs
│   ├── instagram/
│   │   └── [YYYY/MM/DD]/
│   ├── linkedin/
│   └── twitter/
└── workspace/
    └── input/
        └── telegram/          # Files received from Telegram bot
            └── <job-id>/      # One folder per job
```

---

## Skill Integration Map

| Skill | Location | Purpose |
|-------|----------|---------|
| persona | `skills/persona/` | Brand identity maintenance |
| mux | `skills/mux/` | Video enhancement and captioning |
| filter | `skills/filter/` | Image resize, crop, and filtering |
| buffer | `skills/buffer/` | Schedule and publish posts |
| verbatim | `skills/verbatim/` | Audio/video transcription |
| snip | `skills/snip/` | Video cutting and sequencing |
| grade | `skills/grade/` | Aesthetic photo selection |
| knockout | `skills/knockout/` | Image background removal |
| portrait | `skills/portrait/` | Depth bokeh enhancement |
| alt | `skills/alt/` | Auto-captioning and tagging |
| render | `skills/render/` | Text-to-image generation |
| keyer | `skills/keyer/` | Video background removal |
| tween | `skills/tween/` | Frame interpolation |
| demix | `skills/demix/` | Audio stem separation |
| score | `skills/score/` | Background music generation |
| liven | `skills/liven/` | Image-to-video animation |
| cutlab | `skills/cutlab/` | AI video editing/inpainting |
| canva | `skills/canva/` | Canva design integration |

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
7. **GPU-heavy last** — run `liven`, `cutlab`, `keyer` when the LLM is idle to avoid VRAM contention
