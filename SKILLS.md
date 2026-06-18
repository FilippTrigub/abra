# Skills Reference

Comprehensive documentation for all Abra skills. Each skill operates independently: drop files into `./input`, get results in `./output`. Combine as needed.

All skills follow the same conventions:
- Python deps managed with `uv` (`uv sync` + `uv run`)
- Scripts live in `$SKILL_DIR/scripts/`
- Input dir: `./input` (or override with `--input`)
- Output dir: `./output` (or override with `--output`)

`post-scheduler` has one extra secret-loading option for Backblaze B2 staging:
it can read the four `BACKBLAZE_B2_*` values directly from the shell, from a
dotenv file pointed to by `BACKBLAZE_B2_ENV_FILE`. The recommended OpenClaw
setup is to store that dotenv file at `~/.openclaw/post-scheduler-backblaze.env` and set
`env.BACKBLAZE_B2_ENV_FILE` in `~/.openclaw/openclaw.json`.

`installers/install-abra-on-openclaw.sh` seeds all skill API keys into `~/.openclaw/openclaw.json` under `env`. This includes:
- Core skills: `BUFFER_API_KEY`, `GIPHY_API_KEY`, `FREESOUND_API_KEY`, `PIXABAY_API_KEY`
- Marketing skills: all keys documented in [docs/SETUP.md](./docs/SETUP.md)

Resolution order for each key: shell env → existing `openclaw.json` env → repo root `.env`, then interactive confirmation. Use `--use-env-defaults` or answer "yes" to auto-use values already in `.env`.

---

## GPU / CPU Compatibility

The OpenClaw agent runs an LLM on the GPU, leaving some VRAM free. These tools run in a **separate process** and share that VRAM. Each extra CUDA context costs ~200–400 MB overhead.

Practical constraint: if the LLM occupies N GB, only `total - N - 0.4` GB is available. Tools needing more will crash with OOM unless `--device cpu` is passed.

Every tool accepts `--device cpu` to fall back to CPU/RAM:

| Skill | Min VRAM (GPU) | CPU fallback? | CPU speed |
|-------|---------------|---------------|-----------|
| photo-picker | ~1 GB | ✅ yes | fast (~2s/image) |
| bokeh-effect | ~1.5 GB | ✅ yes | acceptable (~5s/image) |
| background-remover | ~0.5 GB | ✅ yes | acceptable (~3s/image) |
| image-captioner | ~4 GB | ✅ yes (moondream2 only) | slow (~7s/image) |
| frame-interpolator | ~2 GB | ⚠️ technically yes | very slow, impractical for video |
| video-matte | ~3 GB | ❌ no practical path | too slow |
| audio-splitter | ~2 GB | ✅ yes | slow but usable (~3–5× realtime) |
| music-generator | ~3 GB | ✅ yes | very slow (~10× realtime) |
| animate-image | None (cloud) | ✅ N/A | cloud speed |
| video-generator | None (cloud) | ✅ N/A | cloud speed |
| video-editor | ~8 GB | ❌ no | hours per clip |
| video-enhancer | 0 GB (CPU) | ✅ yes | fast (~15s/clip) |
| video-captioner | 0 GB (CPU) | ✅ yes | ~30s/clip (Whisper tiny) |
| remotion-video | 0 GB (CPU) | ✅ yes | CPU only, browser render |
| giphy | 0 GB (CPU) | ✅ yes | instant |
| freesound | 0 GB (CPU) | ✅ yes | instant |
| pixabay | 0 GB (CPU) | ✅ yes | instant |

**Recommendation:** When VRAM is limited, prefer tools marked ✅. Generative tools (`animate-image`, `video-editor`) are best run when LLM is idle.

---

## Core Skills

---

### brand-manager — Brand Identity Management

**What it does:** Maintains and applies brand identity across all content operations. Ensures every output aligns with the personal brand's voice, values, and visual identity.

**Features:**
- Brand asset storage (logos, fonts, templates)
- Font downloads from Fontsource and Google Fonts Developer API, with source/license metadata stored beside the font file
- Voice and tone guidelines
- Visual identity specifications
- Content adaptation to brand standards
- **Strategy sub-skills** (see below): brand-strategist, growth-strategist, seo-researcher, funnel-optimizer

**Strategy Sub-Skills:**

The brand-manager skill contains four strategy skills for brand development and marketing analysis:

- **brand-strategist** — Brand foundation, positioning, and identity development
- **growth-strategist** — Growth strategy, competitive analysis, and market positioning
- **seo-researcher** — SEO research, keyword analysis, and search optimization
- **funnel-optimizer** — Funnel analysis, conversion optimization, and user journey mapping

**Usage:**
```bash
# Store a brand image
python skills/brand-manager/scripts/brand_assets.py store-image \
  --input ./logo.png --name main-logo --tags logo,primary

# Download a brand font from Fontsource (preferred, no auth)
python skills/brand-manager/scripts/brand_assets.py download-fontsource-font \
  --id inter --weight 700 --style normal --subset latin \
  --format woff2 --name inter-bold --tags heading,caption

# Download a brand font from Google Fonts Developer API
GOOGLE_FONTS_API_KEY=your-key \
python skills/brand-manager/scripts/brand_assets.py download-google-font \
  --family "Inter" --variant 700 --name inter-google-bold --tags heading,caption

# List all assets
python skills/brand-manager/scripts/brand_assets.py list

# Run strategy sub-skills
cd skills/brand-manager/brand-strategist && uv sync
uv run python scripts/strategy.py --input ./input --output ./output
```

---

### audio-transcriber — Audio Transcription

**What it does:** Transcribes audio from video or audio files using HuggingFace ASR models. Outputs per-segment JSON with timestamps and text.

**Model:** transformers or nemo library

**Requires:** `uv`, GPU (~realtime) or CPU (~1–2× realtime)

**Usage:**
```bash
cd skills/audio-transcriber && uv sync
uv run python scripts/transcribe.py --input ./input --output ./output
```

---

### video-editor — Video Editing

**What it does:** Edits and inpaints video regions via text prompts using local VLMs. Supports region-based editing, subject tracking, and controlled generation.

**Model:** Local video editing with VLM guidance

**Requires:** `uv`, NVIDIA GPU (8GB+ VRAM)

**Usage:**
```bash
cd skills/video-editor && uv sync
uv run python scripts/vace.py --input ./input --output ./output \
  --prompt "remove the person on the left" --mode inpaint
```

---

### video-cutter — Video Cutting

**What it does:** Cuts videos into segments, rearranges them, and produces an output video with a specific cuts-per-second rate. Uses MoviePy. Prioritizes audio transcription for timestamped cutting, falls back to adaptive scene detection.

**Requires:** `uv`, GPU recommended

**Usage:**
```bash
cd skills/video-cutter && uv sync
uv run python scripts/cut.py --input ./input --output ./output --segments 3
```

---

### image-generator — Text to Image

**What it does:** Generates images from text prompts using HuggingFace diffusers. Supports multiple model architectures including FLUX, SDXL, SD3, and Playground v2.

**Requires:** `uv`, CUDA GPU

**Usage:**
```bash
cd skills/image-generator && uv sync
uv run python scripts/generate.py --prompt "professional headshot" --output ./output
```

---

### video-generator — Multi-Model Cloud Video (Higgsfield)

**What it does:** Generates video clips from text prompts or input images using Higgsfield’s cloud platform. Supports multiple models and presets, and auto-detects text-to-video vs. image-to-video.

**Models:** Kling, Sora, Veo, Wan, Seedance, MiniMax

**Requires:** `uv`, `HF_KEY` or `HF_API_KEY` + `HF_API_SECRET`

**Usage:**
```bash
cd skills/video-generator && uv sync
export HF_KEY="your-api-key:your-api-secret"
uv run python scripts/generate.py --config config.json
```

---

### animate-image — Image to Video (Cloud)

**What it does:** Animates a still image into a short video clip using fal.ai's LTX-2.3 Fast model in the cloud. No local GPU required — everything runs on fal.ai serverless infrastructure.

**Models:**
- LTX-2.3 Fast — up to 4K resolution, 24-50 FPS, AI-generated audio

**Pricing:** $0.04/s (1080p), $0.08/s (1440p), $0.16/s (4K)

**Requires:** `uv`, `FAL_API_KEY` environment variable, no GPU

**Usage:**
```bash
cd skills/animate-image && uv sync
export FAL_API_KEY="your-api-key"
uv run python scripts/img2vid.py --input ./input --output ./output \
  --prompt "slow cinematic push-in, golden hour light" \
  --duration 6 --resolution 1080p
```

**Note:** The previous local GPU-based version has been backed up to `~/Documents/hackaskill-backups/liven-local/`.

---

### video-matte — Video Matting

**What it does:** Removes the background from every frame of a video using AI (BiRefNet-general via rembg). Outputs transparent-background video or composites onto a solid colour or image.

**Model:** BiRefNet-general

**Requires:** `uv`, NVIDIA GPU (3GB+ VRAM)

**Usage:**
```bash
cd skills/video-matte && uv sync
uv run python scripts/matte.py --input ./input --output ./output --bg "#0d0d0d"
```

---

### frame-interpolator — Frame Interpolation

**What it does:** Doubles or quadruples the frame rate of any video using neural optical flow. Produces smooth slow motion without a high-speed camera.

**Model:** Practical-RIFE — pure PyTorch, GPU

**Requires:** `uv`, GPU required

**Usage:**
```bash
cd skills/frame-interpolator && uv sync
uv run python scripts/interpolate.py --input ./input --output ./output --multiplier 2
```

---

### music-generator — Music Generation

**What it does:** Generates royalty-free background music from a text prompt. Optionally mixes the result under a video at target loudness so speech stays primary.

**Model:** MusicGen by Meta
- musicgen-small (300M) — ~6GB VRAM, fast
- musicgen-melody (1.5B) — higher quality, melody conditioning

**Requires:** `uv`, GPU recommended (16GB for medium model)

**Usage:**
```bash
cd skills/music-generator && uv sync
uv run python scripts/generate_music.py --prompt "warm acoustic guitar" \
  --duration 30 --output ./output/music.wav
```

---

### audio-splitter — Audio Separation

**What it does:** Separates vocals from background music in any video or audio file. Useful for getting clean voice tracks or stripping music before adding brand music.

**Model:** Demucs by Meta — GPU-accelerated

**Requires:** `uv`, GPU recommended

**Usage:**
```bash
cd skills/audio-splitter && uv sync
uv run python scripts/separate.py --input ./input --output ./output --stem vocals
```

---

### image-captioner — Auto-Caption

**What it does:** Runs a local vision-language model over each image and writes a JSON sidecar with a description, suggested Instagram caption, and detected tags. If brand fonts are specified and available in `brand-manager`, mention the preferred font in downstream handoff notes; this skill does not render text itself.

**Models:**
- moondream2 — 2B params, fast, runs on CPU
- Phi-4-multimodal — 3.8B, higher quality

**Requires:** `uv`, GPU recommended

**Usage:**
```bash
cd skills/image-captioner && uv sync
uv run python scripts/describe.py --input ./input --output ./output
```

Output:
```json
{
  "description": "A woman in a café holding a coffee cup.",
  "caption": "Morning rituals ☕ #coffeetime",
  "tags": ["portrait", "coffee", "indoor"]
}
```

---

### media-analyzer — Visual Intelligence

**What it does:** Analyzes images and videos with vision-language models, returning structured observations for composition, engagement potential, motion, and brand alignment.

**Modes:** local GPU inference or cloud inference via HuggingFace API

**Requires:** `uv`, `ffmpeg`, GPU recommended (30GB VRAM for local mode) or `HF_TOKEN` for cloud mode

**Usage:**
```bash
cd skills/media-analyzer && uv sync
uv run python scripts/analyze.py --input photo.jpg --output results/
uv run python scripts/analyze.py --input video.mp4 --output results/ --mode cloud --provider huggingface
```

---

### background-remover — Background Removal

**What it does:** Removes backgrounds from portraits or product shots. Outputs transparent PNGs or composites onto a solid colour or gradient.

**Model:** rembg with IS-Net / U2Net via ONNX Runtime

**Requires:** `uv`, GPU recommended

**Usage:**
```bash
cd skills/background-remover && uv sync
uv run python scripts/rembg_batch.py --input ./input --output ./output
```

---

### bokeh-effect — Depth Bokeh

**What it does:** Estimates per-pixel depth from a single photo using MiDaS, then applies lens blur weighted by depth. Makes phone photos look like shot with a fast prime lens.

**Model:** MiDaS DPT-Large

**Requires:** `uv`, GPU recommended

**Usage:**
```bash
cd skills/bokeh-effect && uv sync
uv run python scripts/bokeh.py --input ./input --output ./output
```

---

### photo-picker — Aesthetic Selection

**What it does:** Scores a folder of images by visual quality and copies the top K to output. Eliminates manual photo culling.

**Models:**
- improved-aesthetic-predictor — CLIP + MLP, ~1s/image on GPU
- PickScore — ranks images against a text prompt

**Requires:** `uv`, GPU recommended

**Usage:**
```bash
cd skills/photo-picker && uv sync
uv run python scripts/score.py --input ./input --output ./output --top 3
```

---

### video-enhancer — Video Enhancement

**What it does:** Sharpens, colour-grades, and normalises audio for a batch of videos. Three presets: `natural` (subtle), `cinematic` (warm + punchy), `vivid` (high-saturation). CPU-only — no GPU required.

**Requires:** `uv`, `ffmpeg`

**Usage:**
```bash
cd skills/video-enhancer && uv sync
uv run python scripts/enhance.py --preset cinematic
# Drop videos in skills/video-enhancer/input/, results appear in skills/video-enhancer/output/
```

---

### video-captioner — Animated Captions

**What it does:** Transcribes speech with Whisper and burns word-by-word animated captions into videos. Two built-in styles: minimalist (default) and futuristic (gold/magenta glow). If brand fonts are specified and available in `brand-manager`, static caption styling uses them before falling back to system fonts. CPU-only — no GPU required.

**Requires:** `uv`, `ffmpeg`

**Usage:**
```bash
cd skills/video-captioner && uv sync
# Default minimalist captions
uv run python scripts/caption_service.py

# Futuristic gold/magenta style
uv run python scripts/caption_service.py --css scripts/futuristic.css
# Drop videos in skills/video-captioner/input/, results appear in skills/video-captioner/output/
```

---

### remotion-video — Remotion Video Rendering

**What it does:** Renders one branded starter composition from a versioned render spec. It validates the spec, stages assets, renders an MP4 and thumbnail, and writes a manifest for downstream reuse. CPU only, no GPU required.

**Requires:** `uv`, `python3`, `node`, `npm`, `ffmpeg`, Chrome Headless Shell

**Usage:**
```bash
cd skills/remotion-video
uv sync
npm ci
npm run browser:ensure

# End to end smoke test from the checked in fixture spec
uv run python scripts/render.py --config config.json --render-spec fixtures/render-spec.valid.json

# Real render from the default input spec
uv run python scripts/render.py --config config.json
```

**Input contract:** `input/render-spec.json` by default, or `--render-spec <path>`. The spec uses `render_spec_version: "1.0"` and requires `composition`, `title`, `duration_seconds`, `fps`, `width`, `height`, `background`, `brand`, `scenes`, `assets`, and `output`.

**Output contract:** `output/<basename>.mp4`, `output/<thumbnail_filename>`, and `output/<manifest_filename>`. The manifest uses `manifest_version: "1.0"` and includes `render_id`, `composition`, `video_path`, `thumbnail_path`, `duration_seconds`, `fps`, `width`, `height`, `created_at`, `warnings`, and `source_spec_path`.

**Downstream reuse:** Consume the MP4, thumbnail, and manifest only. Use `source_spec_path` plus the manifest paths. Do not depend on Remotion internals, React components, or temp staging paths.

**Scope:** one branded starter composition only. No workflow integration. No multiple templates.

---

### giphy — Animated GIF Sticker Overlays

**What it does:** Overlays animated GIF stickers from the GIPHY API onto videos with optional bundled sound effects. Perfect for Instagram-style reactions, viral moments, and celebrations. CPU-only — no GPU required.

**Requires:** `uv`, `ffmpeg`, `GIPHY_API_KEY`

**API Key:** [developers.giphy.com/dashboard](https://developers.giphy.com/dashboard/)

**Usage:**
```bash
cd skills/giphy && uv sync
export GIPHY_API_KEY=your_key

# Download real GIPHY stickers for all bundled presets (one-time setup)
uv run python scripts/download_giphy_presets.py

# Process all videos in input/
uv run python scripts/giphy.py
```

**Config example:**
```json
{
  "effects": [{
    "trigger": { "type": "timestamp", "value": 4.0 },
    "gif": { "source": "giphy:confetti party", "mode": "fullscreen" },
    "sfx": { "source": "bundled:applause", "volume": 0.9 },
    "duration": 3.0
  }]
}
```

**GIF sources:** `giphy:<query>` · `bundled:<name>` · `local:<name>` · `favourite:<name>` · file path

**SFX sources:** `bundled:<name>` · `local:<name>` · file path *(Freesound search → use skills/freesound)*

---

### freesound — Social Sound Effects

**What it does:** Mixes professional sound effects from the Freesound API into videos with optional animated GIF overlays. SFX-first skill — use when audio reactions timed to specific moments are the primary goal. CPU-only — no GPU required.

**Requires:** `uv`, `ffmpeg`, `FREESOUND_API_KEY`

**API Key:** [freesound.org/apiv2/apply](https://freesound.org/apiv2/apply/)

**Usage:**
```bash
cd skills/freesound && uv sync
export FREESOUND_API_KEY=your_key

# Download real Freesound recordings for all bundled presets (one-time setup)
uv run python scripts/download_freesound_presets.py

# Process all videos in input/
uv run python scripts/freesound.py
```

**Config example:**
```json
{
  "effects": [{
    "trigger": { "type": "text_cue", "phrase": "check this out", "transcript": "./input/sub.srt" },
    "sfx": { "source": "freesound:crowd cheer", "volume": 0.85 },
    "gif": { "source": "bundled:confetti", "mode": "fullscreen" },
    "duration": 3.0
  }]
}
```

**SFX sources:** `freesound:<query>` · `bundled:<name>` · `local:<name>` · `favourite:<name>` · file path

**GIF sources:** `bundled:<name>` · `local:<name>` · file path *(GIPHY search → use skills/giphy)*

---

### pixabay — Royalty-Free Image & Video Overlays

**What it does:** Overlays royalty-free images and short video clips from the Pixabay API onto videos with optional bundled sound effects. No attribution required. Handles static images (PNG/JPG with `-loop 1`) and animated clips (MP4). CPU-only — no GPU required.

**Requires:** `uv`, `ffmpeg`, `PIXABAY_API_KEY`

**API Key:** [pixabay.com/api/docs](https://pixabay.com/api/docs/)

**Usage:**
```bash
cd skills/pixabay && uv sync
export PIXABAY_API_KEY=your_key

# Browse available assets before adding to config
uv run python scripts/pixabay_api.py images --query "sparkle transparent" --list
uv run python scripts/pixabay_api.py videos --query "confetti" --max-duration 5 --list

# Process all videos in input/
uv run python scripts/pixabay.py
```

**Config example:**
```json
{
  "effects": [{
    "trigger": { "type": "timestamp", "value": 4.0 },
    "overlay": {
      "source": "pixabay:sparkle glitter transparent",
      "mode": "positioned",
      "position": "top-right",
      "width": 220
    },
    "sfx": { "source": "bundled:whoosh", "volume": 0.85 },
    "duration": 3.0
  }]
}
```

**Overlay sources:** `pixabay:<query>` · `pixabay-video:<query>` · `local:<name>` · `favourite:<name>` · file path

**SFX sources:** `bundled:<name>` · `local:<name>` · file path *(Freesound search → use skills/freesound)*

---

### social-resizer — Image Processing

**What it does:** Processes a directory of images for Instagram using sharp (resize/crop/pad) and pilgram (Instagram filters). Reads a `config.json` and writes processed images to an output directory.

**Requires:** `uv`

**Usage:**
```bash
cd skills/social-resizer && uv sync
uv run python scripts/process.py --config config.json
```

---

### visual-hook — Visual Hook Overlays

**What it does:** Adds bold, high-contrast hook text overlays to images and videos in Instagram-safe zones. If brand fonts are specified and available in `brand-manager`, the hook renderer uses them before falling back to system fonts. Useful for questions, teasers, bold claims, and other scroll-stopping first-frame treatments. CPU-only — no GPU required.

**Requires:** `uv`, `ffmpeg`

**Usage:**
```bash
cd skills/visual-hook && uv sync
uv run python scripts/hook.py --config config.json
```

---

### end-cta — End CTA Renderer

**What it does:** Applies a brand-defined CTA at the end of content. Text and image CTAs can overlay images, while videos receive an appended CTA card or CTA video. If brand fonts are specified and available in `brand-manager`, text CTA rendering uses them before falling back to system fonts. CPU-only — no GPU required.

**Requires:** `uv`, `ffmpeg`

**Usage:**
```bash
cd skills/end-cta && uv sync
uv run python scripts/cta.py --config config.json
```

---

### post-scheduler — Content Scheduling

**What it does:** Schedules, creates, and manages social media posts on Instagram and LinkedIn using the Buffer GraphQL API.

**Requires:** `uv`, Buffer API key

**Optional staged local video support:**
- local `shareNow` video still uses `cloudflared`
- scheduled/queued local video can stage through Backblaze B2 using `BACKBLAZE_B2_ENV_FILE`
- installer support: `./installers/install-abra-on-openclaw.sh` scaffolds `~/.openclaw/post-scheduler-backblaze.env` and wires `env.BACKBLAZE_B2_ENV_FILE`
- required B2 keys in that file: `BACKBLAZE_B2_KEY_ID`, `BACKBLAZE_B2_APPLICATION_KEY`, `BACKBLAZE_B2_BUCKET_ID`, `BACKBLAZE_B2_BUCKET_NAME`
- `BUFFER_API_KEY` can be persisted in `~/.openclaw/openclaw.json` under `env`

**Usage:**
```bash
cd skills/post-scheduler && uv sync
uv run python scripts/posts.py create \
  --channel-id CHANNEL_ID \
  --text "Post caption" \
  --mode addToQueue
```

---

### social-analytics — Social Post Analytics

**What it does:** Fetches engagement and performance metrics for your own posts across major social platforms via the SociaVault API.

**Platforms:** Instagram, LinkedIn, TikTok, YouTube, Twitter/X, Facebook, Reddit, Threads

**Requires:** `uv`, `SOCIAVAULT_API_KEY`

**Usage:**
```bash
cd skills/social-analytics && uv sync
export SOCIAVAULT_API_KEY="sk_live_your_api_key_here"
uv run python scripts/linkedin_post.py --url "https://linkedin.com/posts/..." --output ./output
```

---

### canva-connector — Design Integration

**What it does:** MCP skill for Canva. Provides 23 tools for uploading assets, searching designs, creating designs, and managing exports.

**Requires:** Canva API credentials

**Usage:** Use via OpenClaw tool calls for design automation.

---

### brand-strategist — Brand Strategy (in brand-manager)

**What it does:** Develops comprehensive brand foundation, positioning, and identity. Analyzes market context and establishes core brand pillars.

**Features:**
- Brand positioning and differentiation
- Voice and tone guidelines
- Visual identity specifications
- Target audience definition

**Location:** `skills/brand-manager/brand-strategist/`

**Usage:**
```bash
cd skills/brand-manager/brand-strategist && uv sync
uv run python scripts/strategy.py --input ./input --output ./output
```

---

### growth-strategist — Growth Strategy (in brand-manager)

**What it does:** Provides growth strategy, competitive analysis, and market positioning recommendations. Helps identify growth opportunities and optimize reach.

**Features:**
- Competitive landscape analysis
- Growth opportunity identification
- Market positioning strategies
- Channel optimization recommendations

**Location:** `skills/brand-manager/growth-strategist/`

**Usage:**
```bash
cd skills/brand-manager/growth-strategist && uv sync
uv run python scripts/strategy.py --input ./input --output ./output
```

---

### seo-researcher — SEO Research (in brand-manager)

**What it does:** Conducts comprehensive SEO research including keyword analysis, search volume data, and optimization recommendations.

**Providers:** Uses multiple SEO tools (GSC, SEMRUSH, Ahrefs, DataForSEO, Keywords Everywhere, Plausible) — at least one required.

**Required Keys (at least one):**
- Google Search Console: `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN`
- SEMRUSH: `SEMRUSH_API_KEY`
- Ahrefs: `AHREFS_API_KEY`
- DataForSEO: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`
- Keywords Everywhere: `KEYWORDS_EVERYWHERE_API_KEY`
- Plausible: `PLAUSIBLE_API_KEY`, `PLAUSIBLE_SITE_ID`

**Location:** `skills/brand-manager/seo-researcher/`

**Usage:**
```bash
cd skills/brand-manager/seo-researcher
node scripts/run.mjs --task audit --domain example.com
```

---

### funnel-optimizer — Funnel Optimization (in brand-manager)

**What it does:** Analyzes conversion funnels, identifies optimization opportunities, and provides user journey mapping for improved conversions.

**Providers:** Uses analytics platforms (GA4, Mixpanel, Amplitude, Hotjar, Optimizely, PostHog) — at least one required.

**Required Keys (at least one):**
- Google Analytics 4: `GA4_CLIENT_ID`, `GA4_CLIENT_SECRET`, `GA4_REFRESH_TOKEN`, `GA4_PROPERTY_ID`
- Mixpanel: `MIXPANEL_SA_USERNAME`, `MIXPANEL_SECRET`
- Amplitude: `AMPLITUDE_API_KEY`, `AMPLITUDE_SECRET_KEY`
- Hotjar: `HOTJAR_SITE_ID`, `HOTJAR_API_TOKEN`
- Optimizely: `OPTIMIZELY_SDK_KEY`, `OPTIMIZELY_ACCESS_TOKEN`
- PostHog: `POSTHOG_PROJECT_TOKEN`, plus `POSTHOG_PROJECT_ID` and `POSTHOG_PERSONAL_API_KEY` for private analytics reads (`POSTHOG_HOST` optional)

**Location:** `skills/brand-manager/funnel-optimizer/`

**Usage:**
```bash
cd skills/brand-manager/funnel-optimizer && uv sync
uv run python scripts/funnel.py --input ./input --output ./output
```

---

### email-campaigner — Email Marketing

**What it does:** Creates and manages email marketing campaigns using multiple email service providers. Supports Resend, Mailchimp, SendGrid, Kit (ConvertKit), and Dub.

**Providers:** Email services — at least one required.

**Required Keys (at least one):**
- Resend: `RESEND_API_KEY`
- Mailchimp: `MAILCHIMP_API_KEY`, `MAILCHIMP_SERVER_PREFIX`
- SendGrid: `SENDGRID_API_KEY`
- Kit: `KIT_API_SECRET` (broadcasts are created as drafts; publish manually in the Kit dashboard)
- Dub: `DUB_API_KEY`

**Location:** `skills/email-campaigner/`

**Usage:**
```bash
cd skills/email-campaigner && uv sync
uv run python scripts/campaign.py --input ./input --output ./output
```

---

### ads-manager — Paid Advertising

**What it does:** Manages Google Ads campaigns including account setup, campaign creation, keyword management, and performance tracking.

**Providers:** Google Analytics 4 and Google Ads.

**Required Keys:**
- GA4: `GA4_ACCESS_TOKEN`, `GA4_PROPERTY_ID`
- Google Ads: `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_DEVELOPER_TOKEN`

**Location:** `skills/ads-manager/`

**Usage:**
```bash
cd skills/ads-manager && uv sync
uv run python scripts/ads.py --input ./input --output ./output
```

---

### revenue-manager — Revenue Operations

**What it does:** Provides CRM integration and revenue operations including contact management, pipeline tracking, and enrichment from multiple data providers.

**Providers:** CRM platforms — at least one required.

**Required Keys (at least one):**
- HubSpot: `HUBSPOT_ACCESS_TOKEN`
- Salesforce: `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_USERNAME`, `SALESFORCE_PASSWORD`, `SALESFORCE_SECURITY_TOKEN`
- Close: `CLOSE_API_KEY`
- Outreach: `OUTREACH_ACCESS_TOKEN`, `OUTREACH_REFRESH_TOKEN`
- Crossbeam: `CROSSBEAM_API_KEY`
- Apollo: `APOLLO_API_KEY`
- Clearbit: `CLEARBIT_API_KEY`
- ZoomInfo: `ZOOMINFO_ACCESS_TOKEN`
- Clay: `CLAY_API_KEY`
- Segment: `SEGMENT_WRITE_KEY`

**Location:** `skills/revenue-manager/`

**Usage:**
```bash
cd skills/revenue-manager && uv sync
uv run python scripts/revenue.py --input ./input --output ./output
```

---

## Quick Reference

### Creative & Media Skills

| Skill | Input | What it does | Min VRAM | CPU ok? |
|-------|-------|-------------|----------|---------|
| photo-picker | images | Score and pick the best photos | ~1 GB | ✅ fast |
| bokeh-effect | images | Synthetic bokeh / portrait mode | ~1.5 GB | ✅ acceptable |
| background-remover | images | Remove background | ~0.5 GB | ✅ acceptable |
| image-captioner | images | Auto-describe and caption | ~4 GB | ✅ slow |
| frame-interpolator | videos | Frame interpolation | ~2 GB | ⚠️ impractical |
| video-matte | videos | Remove video background | ~3 GB | ❌ no |
| audio-splitter | video/audio | Separate vocals from music | ~2 GB | ✅ slow |
| music-generator | prompt/video | Generate music | ~3 GB | ✅ very slow |
| animate-image | images | Image → video clip (fal.ai LTX-2.3, up to 4K) | None (cloud) | ✅ N/A |
| video-generator | images or none | Text→video or image→video via Higgsfield (Kling, Sora, Veo…) | None (cloud) | ✅ N/A |
| video-editor | video | Edit/inpaint video | ~8 GB | ❌ no |
| giphy | videos | Animated GIF stickers from GIPHY + optional SFX | 0 GB | ✅ instant |
| freesound | videos | Freesound SFX into video + optional GIF overlays | 0 GB | ✅ instant |
| pixabay | videos | Royalty-free image/video overlays + optional SFX | 0 GB | ✅ instant |
| video-enhancer | videos | Sharpen, colour grade, normalise audio | 0 GB | ✅ fast |
| video-captioner | videos | Whisper transcription + animated captions | 0 GB | ✅ ~30s/clip |
| visual-hook | images/videos | Bold hook text overlays for Instagram-safe zones | 0 GB | ✅ instant |
| end-cta | images/videos | Brand CTA overlays and appended CTA cards/videos | 0 GB | ✅ instant |

### Marketing & Growth Skills

| Skill | Location | What it does | Required Keys |
|-------|----------|-------------|---------------|
| brand-strategist | brand-manager/ | Brand foundation and identity | none |
| growth-strategist | brand-manager/ | Growth strategy and competitive analysis | none |
| seo-researcher | brand-manager/ | SEO research and keyword analysis | GSC, SEMRUSH, Ahrefs, DataForSEO, Keywords Everywhere, or Plausible |
| funnel-optimizer | brand-manager/ | Funnel analysis and conversion optimization | GA4, Mixpanel, Amplitude, Hotjar, Optimizely, or PostHog |
| email-campaigner | root | Email marketing campaigns | Resend, Mailchimp, SendGrid, Kit, or Dub |
| ads-manager | root | Google Ads campaign management | GA4 + Google Ads keys |
| revenue-manager | root | CRM and revenue operations | HubSpot, Salesforce, Close, or other CRM |

**Core Skills:** brand-manager, audio-transcriber, video-cutter, image-generator, video-enhancer, video-captioner, remotion-video, social-resizer, post-scheduler, canva-connector
