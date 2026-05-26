# 🦉 Abra - Agent de Branding

> **AI-powered personal brand management system** that transforms raw inputs into polished, multi-channel social media content with branded images and videos.

Transform articles, notes, ideas, and meeting recordings into ready-to-publish content across Instagram, LinkedIn, Twitter, and more — all while maintaining perfect brand consistency.

---

## 🎯 Features

| Feature | 💡 Benefit |
|---------|----------------|
| **Brand Consistency** | Maintains your unique voice, tone, and visual identity across all content |
| **Brand Assets** | Store and manage brand images, fonts for use across all skills |
| **Multi-Channel Output** | Generates platform-specific content for Instagram, LinkedIn, Twitter, and more |
| **Media Generation** | Automated image and video processing with brand-aligned visuals |
| **Smart Scheduling** | Buffer-based scheduling with optimal posting times |
| **Modular Skills** | Extensible skill system for custom workflows |
| **Docker Ready** | Containerized deployment with GPU acceleration |

---

## 🎨 Skills & Tools

Abra includes 31 specialized skills for personal brand management:

### Creative & Media Skills

| Skill | Input | What it does | Min VRAM |
|-------|-------|--------------|----------|
| **photo-picker** | images | Score and pick the best photos | ~1 GB |
| **bokeh-effect** | images | Synthetic bokeh / portrait mode | ~1.5 GB |
| **background-remover** | images | Remove background, replace with colour/image | ~0.5 GB |
| **image-captioner** | images | Auto-describe and suggest captions | ~4 GB |
| **frame-interpolator** | videos | Frame interpolation (60fps / slow motion) | ~2 GB |
| **video-matte** | videos | Remove video background, composite backdrop | ~3 GB |
| **audio-splitter** | video/audio | Separate vocals from music | ~2 GB |
| **music-generator** | prompt / video | Generate brand background music | ~3 GB |
| **animate-image** | images | Image → animated video clip | ~8 GB |
| **video-generator** | prompt / images | Generate videos from text or images via Higgsfield | cloud |
| **video-editor** | video | Edit / inpaint video regions via prompt | ~8 GB |
| **media-analyzer** | images / videos | Analyze visual content with vision-language models | ~30 GB GPU |
| **giphy** | videos | Overlay animated GIF stickers from GIPHY with optional SFX | 0 GB |
| **freesound** | videos | Mix Freesound sound effects into videos with optional GIF overlays | 0 GB |
| **pixabay** | videos | Overlay royalty-free Pixabay images and video clips | 0 GB |
| **video-enhancer** | videos | Sharpen, colour grade, normalise audio | 0 GB |
| **video-captioner** | videos | Whisper transcription + animated caption burn-in | 0 GB |
| **remotion-video** | render spec / assets | Render one branded video with Remotion, MP4 + thumbnail + manifest | 0 GB |
| **visual-hook** | images/videos | Add bold hook text overlays in social-safe zones | 0 GB |
| **end-cta** | images/videos | Apply branded end-card CTAs and overlays | 0 GB |

### Marketing & Growth Skills

| Skill | Location | What it does |
|-------|----------|---------------|
| **brand-strategist** | brand-manager/ | Brand foundation, positioning, and identity development |
| **growth-strategist** | brand-manager/ | Growth strategy, competitive analysis, and market positioning |
| **seo-researcher** | brand-manager/ | SEO research, keyword analysis, and search optimization |
| **funnel-optimizer** | brand-manager/ | Funnel analysis, conversion optimization, and user journey mapping |
| **email-campaigner** | root | Email marketing campaigns with Resend, Mailchimp, SendGrid, Kit |
| **ads-manager** | root | Paid advertising management for Google Ads campaigns |
| **revenue-manager** | root | CRM integration and revenue operations with HubSpot, Salesforce, Close |
| **social-analytics** | root | Social post analytics and performance reporting via SociaVault |

**Core Skills:** brand-manager, audio-transcriber, video-cutter, image-generator, video-enhancer, video-captioner, remotion-video, social-resizer, post-scheduler, canva-connector

**Social Media Skills** *(each requires one API key)*: giphy (`GIPHY_API_KEY`), freesound (`FREESOUND_API_KEY`), pixabay (`PIXABAY_API_KEY`)

**Marketing Skills** *(require API keys, see [docs/SETUP.md](./docs/SETUP.md))*:
- brand-strategist, growth-strategist, seo-researcher, funnel-optimizer (no providers)
- email-campaigner: RESEND_API_KEY, MAILCHIMP_API_KEY, SENDGRID_API_KEY, KIT_API_KEY, DUB_API_KEY
- ads-manager: GA4_ACCESS_TOKEN, GA4_PROPERTY_ID, GOOGLE_ADS_* keys
- revenue-manager: HUBSPOT_ACCESS_TOKEN, SALESFORCE_*, CLOSE_API_KEY, and more

**Usage:** Each skill follows the same conventions (`uv sync`, `--input`, `--output`, `--device cpu` fallback).

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [🏷️ SOUL.md](./SOUL.md) | Agent identity, persona, and behavior specs |
| [📖 WORKFLOW.md](./WORKFLOW.md) | Complete processing workflow and best practices |
| [🔧 Skills](./skills/) | Individual skill documentation |
| [📋 SKILLS.md](./SKILLS.md) | Detailed skill documentation and use cases |
| [📝 SETUP.md](./docs/SETUP.md) | Marketing skills API key setup and provider configuration |

---

## 🚀 Quickstart

### Install Abra

Abra can be installed into either OpenClaw or Hermes. The platform-specific scripts now live under `installers/`.

Before running an installer, it's best to set your API keys in a `.env` file first. By default, both install scripts read `./.env`, but you can point either one at a different file with `--env-file`. The installer imports values from that file and warns if expected keys are missing or empty.

```bash
# OpenClaw install

# 1. Build the OpenClaw-based image from this repo
docker build -t abra:latest .

# 2. Start the OpenClaw services
docker compose up -d openclaw-gateway

# 3. Optional but recommended: set your API keys in ./.env first
# 4. Install Abra into your OpenClaw workspace
bash ./installers/install-abra-on-openclaw.sh

# Or use a different dotenv file
bash ./installers/install-abra-on-openclaw.sh --env-file ./.env.production

# Hermes install
bash ./installers/install-abra-on-hermes.sh
```

The OpenClaw installer copies Abra into `~/.openclaw/workspace-abra/`, registers it with OpenClaw, and can scaffold optional env files such as `~/.openclaw/post-scheduler-backblaze.env`. The Hermes installer creates a profile under `~/.hermes/profiles/abra/` and writes an Abra-specific `.env`, `config.yaml`, and skill set there.

### Prerequisites

- Docker
- An OpenClaw-compatible base image built from this repo's `Dockerfile`
- Git (for submodule management)

---

### Run a Workflow

```bash
cd workflows

# Video → branded reel
uv run python run.py --workflow video-to-reel --input ../video.mp4 \
  --channel-id CHANNEL_ID --due-at 2026-04-01T12:00:00Z

# Photo(s) → branded post  
uv run python run.py --workflow image-to-post --input ../photos/ \
  --channel-id CHANNEL_ID

# Voice → text post
uv run python run.py --workflow audio-to-post --input ../voice.m4a \
  --channel-id CHANNEL_ID

# Add content to brand knowledge
uv run python run.py --workflow brand-enrichment --input ../article.md
```

### Options

| Flag | Description |
|------|-------------|
| `--input` | Input file or directory |
| `--output` | Output directory (default: `output/`) |
| `--skip-optional` | Skip enhancement steps like music generation |
| `--device` | Device: auto, cpu, cuda |
| `--no-archive` | Don't archive input after scheduling |
| `--channel-id` | Required Buffer channel ID for workflows that schedule posts |
| `--text` | Override derived scheduler text |
| `--mode`, `--due-at` | Override scheduler mode or custom schedule time |
| `--image-url`, `--video-url`, `--video-staging-provider` | Override scheduler media and local video staging behavior |
| `--ig-type`, `--ig-first-comment`, `--li-first-comment`, `--link-attachment` | Pass scheduler-specific social options through the workflow runner |

---

## 📋 Workflows

### Creative Workflows

| Workflow | Input | Output |
|----------|-------|--------|
| **video-to-reel** | Video file(s) | Branded reel for Instagram/LinkedIn |
| **image-to-post** | Photo(s) | Branded post with caption |
| **audio-to-post** | Voice/audio | Text post with transcript |

### Brand Workflows

| Workflow | Input | Purpose |
|----------|-------|---------|
| **brand-enrichment** | Any content | Add to brand knowledge |

### How It Works

1. **Brand first** — `brand-manager` runs first to refresh brand knowledge
2. **Process** — Skills run sequentially, each taking the previous step's output as input
3. **Brand last** — `brand-manager` adapts content to brand voice
4. **Schedule** — `post-scheduler` queues to Buffer via its native `create`
   command, using workflow defaults plus any CLI overrides passed to
   `workflows/run.py`

### Input/Output Convention

Each skill reads from `--input DIR` and writes to `--output DIR`. The workflow runner chains them:
```
step1_output/ → step2 --input → step2_output/ → ...
```

After scheduling, input files are archived to `archive/<workflow>/<timestamp>/`.

Creative workflows that end in `post-scheduler` require `--channel-id` with a
real Buffer channel ID. The older `CLAW_DEFAULT_CHANNEL=instagram` value is only
a platform label and is not sufficient for workflow scheduling. When `--text` is
omitted, the runner derives scheduler text from earlier outputs: image caption
JSON sidecars for image workflows, transcript segments for audio workflows, and
the transcript JSON produced earlier in video workflows. `video-to-reel` defaults
to `--mode customScheduled --ig-type reel --video-staging-provider backblaze-b2`,
so local scheduled reels also need `--due-at`.

---

## 🎨 Brand Asset Management

Store and manage brand images, fonts, videos, and CTA definitions for use across all content processing skills.

### Asset Storage

Brand assets are stored in `skills/brand-manager/brand-assets/`:

```
brand-assets/
├── images/              # Logos, profile pics, templates
├── fonts/               # .ttf, .otf, .woff files
├── videos/              # Hook intro clips and other reusable brand videos
└── asset-manifest.json   # Asset index
```

### CLI Usage

```bash
# Store a brand image
python skills/brand-manager/scripts/brand_assets.py store-image \
  --input ./logo.png --name main-logo --tags logo,primary

# Store a brand font
python skills/brand-manager/scripts/brand_assets.py store-font \
  --input ./Inter-Bold.ttf --name inter-bold --tags heading

# Store a brand hook video
python skills/brand-manager/scripts/brand_assets.py store-video \
  --input ./intro-hook.mp4 --name intro-fast --tags hook-video --default

# Store a text CTA
python skills/brand-manager/scripts/brand_assets.py store-cta-text \
  --name book-call --text "Book a call" --tags cta --default

# Store an image CTA from an existing brand image
python skills/brand-manager/scripts/brand_assets.py store-cta-image \
  --name follow-instagram --asset-name main-logo --tags cta

# Store a video CTA from an existing brand video
python skills/brand-manager/scripts/brand_assets.py store-cta-video \
  --name subscribe-endcard --asset-name intro-fast --tags cta

# List all assets
python skills/brand-manager/scripts/brand_assets.py list

# Get asset path by name or tag
python skills/brand-manager/scripts/brand_assets.py get-path --tag logo

# Remove an asset
python skills/brand-manager/scripts/brand_assets.py remove --name main-logo
```

### For Other Skills

Other skills can access brand assets by reading the manifest:

```python
import json
import os
from pathlib import Path

MANIFEST = Path(__file__).parent.parent / "brand-manager" / "brand-assets" / "asset-manifest.json"

def get_brand_asset(tag: str) -> Path | None:
    with open(MANIFEST) as f:
        data = json.load(f)
    for img in data.get("images", []):
        if tag in img.get("tags", []):
            return MANIFEST.parent / img["path"]
    return None
```

Video assets follow the same manifest structure under `videos`, with optional
`default: true` for a default hook clip.

CTA definitions live under `ctas` in the same manifest. Text CTAs store inline text,
while image and video CTAs reference stored brand asset paths.

---

## 📁 Directory Structure

```
claw-parade/
├── README.md              # This file
├── SOUL.md               # Agent identity and behavior specification
├── BRAND.md              # Generated brand spec (created by init)
├── WORKFLOW.md           # Detailed workflow documentation
├── Dockerfile            # Container build configuration
├── docker-compose.yml    # Container orchestration
├── workflows/            # Workflow configs and runner
│   ├── creative/         # Content creation workflows
│   ├── brand/           # Brand management workflows
│   └── run.py           # Workflow runner
├── skills/              # Modular skill definitions
│   ├── brand-manager/    # Brand identity + asset management
│   │   ├── brand-strategist/    # Brand foundation and positioning
│   │   ├── growth-strategist/   # Growth strategy and analysis
│   │   ├── seo-researcher/      # SEO research and keyword analysis
│   │   └── funnel-optimizer/    # Funnel optimization and analytics
│   ├── email-campaigner/  # Email marketing campaigns
│   ├── ads-manager/      # Google Ads management
│   ├── revenue-manager/  # CRM and revenue operations
│   ├── video-enhancer/   # Video sharpening, colour grading, audio normalisation
│   ├── video-captioner/  # Whisper transcription + animated caption burn-in
│   ├── social-resizer/   # Image resize and filtering
│   ├── post-scheduler/   # Schedule and publish posts
│   ├── _providers/      # Marketing CLI wrappers
│   └── + 21 more skills        # AI enhancement + social media tools
├── input/               # Raw input files (staging for processing)
│   └── staging/         # Temporary staging area
├── output/              # Processed content organized by workflow/date
├── archive/             # Processed inputs after scheduling
│   └── <workflow>/
│       └── <timestamp>/
```

---

## 🔧 Docker Integration

### Docker Compose

```yaml
# Run as service
docker compose up openclaw-gateway

# Run CLI commands
docker compose run openclaw-cli claw init --input ./input/
```

### Environment Variables

```bash
# Core configuration
CLAW_BRAND_FILE=./BRAND.md         # Path to brand specification
CLAW_INPUT_DIR=./input/            # Raw input location
CLAW_OUTPUT_DIR=./output/          # Processed output location

# Scheduling defaults
CLAW_BUFFER_DAYS=5                 # Default buffer days
CLAW_DEFAULT_CHANNEL=instagram     # Platform label only; workflow scheduling still needs --channel-id

# External services
CLAW_GDRIVE_ENABLED=true           # Enable Google Drive sync
BUFFER_API_KEY=your-buffer-token   # Required for scheduling
```

### Optional post-scheduler Backblaze B2 setup

Scheduled local video posts can stage through Backblaze B2. During
`./installers/install-abra-on-openclaw.sh`, Abra can optionally scaffold the post-scheduler B2 env
file next to the OpenClaw config:

```bash
~/.openclaw/post-scheduler-backblaze.env
```

That file uses plain dotenv syntax:

```bash
BACKBLAZE_B2_KEY_ID=...
BACKBLAZE_B2_APPLICATION_KEY=...
BACKBLAZE_B2_BUCKET_ID=...
BACKBLAZE_B2_BUCKET_NAME=...
```

Notes:
- this installer step is optional
- `installers/install-abra-on-openclaw.sh` also writes `env.BACKBLAZE_B2_ENV_FILE` into `~/.openclaw/openclaw.json`
- shell environment values still override any file-based B2 config
- installer-managed skill env vars can be sourced from a dotenv file and persisted into `~/.openclaw/openclaw.json` under `env`
- the installer reads `./.env` by default, or a custom file passed via `--env-file PATH`
- for installer-managed OpenClaw env vars, `installers/install-abra-on-openclaw.sh` resolves values in this order: shell env → selected `.env` file → existing `openclaw.json` env
- instead of prompting for every env var, the installer now warns when expected keys are missing or empty in the selected dotenv file and continues with available fallback values
- for non-interactive installs, set `ABRA_CONFIGURE_POST_SCHEDULER_ENV=1` to force the scaffold step or `ABRA_CONFIGURE_POST_SCHEDULER_ENV=0` to skip it

If your OpenClaw/OpenCode integration can only pass one primary skill env var,
persist `BUFFER_API_KEY` in `openclaw.json` and mount the B2 secrets as a plain
dotenv file. The recommended OpenClaw config is:

```json5
{
  env: {
    BACKBLAZE_B2_ENV_FILE: "/home/node/.openclaw/post-scheduler-backblaze.env",
  },
}
```

Resolution order for Backblaze values is:

1. direct `BACKBLAZE_B2_*` shell/container env vars
2. `BACKBLAZE_B2_ENV_FILE`

There is no runtime fallback to `skills/post-scheduler/.env` anymore. On
reinstall, `installers/install-abra-on-openclaw.sh` will migrate any old workspace-local
`skills/post-scheduler/.env` into `~/.openclaw/post-scheduler-backblaze.env`
and remove the legacy copy.

The same installer run can also seed API-key-based skills into OpenClaw config:

```json5
{
  env: {
    BUFFER_API_KEY: "...",
    GIPHY_API_KEY: "...",
    FREESOUND_API_KEY: "...",
    PIXABAY_API_KEY: "...",
  },
}
```

This is now the recommended install path for `post-scheduler`, `giphy`,
`freesound`, and `pixabay`.

---

## 🚀 Getting Help

### CLI Commands

```bash
# Get help for any command
claw --help
claw init --help
claw process --help
claw schedule --help
```

### Common Issues

| Issue | Resolution |
|-------|------------|
| No BRAND.md | Auto-trigger Init phase |
| Unclear input | Request clarification via chat |
| Media generation fail | Fall back to templates |
| Scheduling fail | Queue to manual review |
| Channel not supported | Suggest alternative channels |

---

## 📄 License

MIT

---
