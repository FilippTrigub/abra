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

## 🚀 Quick Start

### Prerequisites

- Git (for submodule management)
- Docker (for containerized deployment)
- Python with `uv` (for AI enhancement tools)

### Run a Workflow

```bash
cd workflows

# Video → branded reel
uv run python run.py --workflow video-to-reel --input ../video.mp4

# Photo(s) → branded post  
uv run python run.py --workflow image-to-post --input ../photos/

# Voice → text post
uv run python run.py --workflow audio-to-post --input ../voice.m4a

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
4. **Schedule** — `post-scheduler` queues to Buffer

### Input/Output Convention

Each skill reads from `--input DIR` and writes to `--output DIR`. The workflow runner chains them:
```
step1_output/ → step2 --input → step2_output/ → ...
```

After scheduling, input files are archived to `archive/<workflow>/<timestamp>/`.

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
│   ├── video-enhancer/   # Video sharpening, colour grading, audio normalisation
│   ├── video-captioner/  # Whisper transcription + animated caption burn-in
│   ├── social-resizer/   # Image resize and filtering
│   ├── post-scheduler/   # Schedule and publish posts
│   └── + 17 more skills        # AI enhancement + social media tools
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
CLAW_DEFAULT_CHANNEL=instagram     # Default target channel

# External services
CLAW_GDRIVE_ENABLED=true           # Enable Google Drive sync
BUFFER_API_KEY=your-buffer-token   # Required for scheduling
```

---

## 🎨 Skills & Tools

Abra includes 22 specialized skills for personal brand management:

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
| **video-editor** | video | Edit / inpaint video regions via prompt | ~8 GB |
| **giphy** | videos | Overlay animated GIF stickers from GIPHY with optional SFX | 0 GB |
| **freesound** | videos | Mix Freesound sound effects into videos with optional GIF overlays | 0 GB |
| **pixabay** | videos | Overlay royalty-free Pixabay images and video clips | 0 GB |
| **video-enhancer** | videos | Sharpen, colour grade, normalise audio | 0 GB |
| **video-captioner** | videos | Whisper transcription + animated caption burn-in | 0 GB |

**Core Skills:** brand-manager, audio-transcriber, video-cutter, image-generator, video-enhancer, video-captioner, social-resizer, post-scheduler, canva-connector

**Social Media Skills** *(each requires one API key)*: giphy (`GIPHY_API_KEY`), freesound (`FREESOUND_API_KEY`), pixabay (`PIXABAY_API_KEY`)

**Usage:** Each skill follows the same conventions (`uv sync`, `--input`, `--output`, `--device cpu` fallback).

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [🏷️ SOUL.md](./SOUL.md) | Agent identity, persona, and behavior specs |
| [📖 WORKFLOW.md](./WORKFLOW.md) | Complete processing workflow and best practices |
| [🔧 Skills](./skills/) | Individual skill documentation |
| [📋 SKILLS.md](./SKILLS.md) | Detailed skill documentation and use cases |

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
