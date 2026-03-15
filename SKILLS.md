# Skills Reference

Comprehensive documentation for all Abra skills. Each skill operates independently: drop files into `./input`, get results in `./output`. Combine as needed.

All skills follow the same conventions:
- Python deps managed with `uv` (`uv sync` + `uv run`)
- Scripts live in `$SKILL_DIR/scripts/`
- Input dir: `./input` (or override with `--input`)
- Output dir: `./output` (or override with `--output`)

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
| video-editor | ~8 GB | ❌ no | hours per clip |

**Recommendation:** When VRAM is limited, prefer tools marked ✅. Generative tools (`animate-image`, `video-editor`) are best run when LLM is idle.

---

## Core Skills

---

### brand-manager — Brand Identity Management

**What it does:** Maintains and applies brand identity across all content operations. Ensures every output aligns with the personal brand's voice, values, and visual identity.

**Features:**
- Brand asset storage (logos, fonts, templates)
- Voice and tone guidelines
- Visual identity specifications
- Content adaptation to brand standards

**Usage:**
```bash
# Store a brand image
python skills/brand-manager/scripts/brand_assets.py store-image \
  --input ./logo.png --name main-logo --tags logo,primary

# List all assets
python skills/brand-manager/scripts/brand_assets.py list
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

**What it does:** Runs a local vision-language model over each image and writes a JSON sidecar with a description, suggested Instagram caption, and detected tags.

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

### video-enhancer — Video Processing

**What it does:** Instagram video enhancement and captioning pipeline. Includes sharpening, colour grading, warmth adjustments, audio normalisation, or burning animated captions.

**Requires:** `uv`, GPU recommended

**Usage:**
```bash
cd skills/video-enhancer && uv sync
uv run python scripts/caption_service.py --output output --preset cinematic
```

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

### post-scheduler — Content Scheduling

**What it does:** Schedules, creates, and manages social media posts on Instagram and LinkedIn using the Buffer GraphQL API.

**Requires:** `uv`, Buffer API key

**Usage:**
```bash
cd skills/post-scheduler && uv sync
uv run python scripts/posts.py create \
  --channel-id CHANNEL_ID \
  --text "Post caption" \
  --mode addToQueue
```

---

### canva-connector — Design Integration

**What it does:** MCP skill for Canva. Provides 23 tools for uploading assets, searching designs, creating designs, and managing exports.

**Requires:** Canva API credentials

**Usage:** Use via OpenClaw tool calls for design automation.

---

## Quick Reference

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
| animate-image | images | Image → video clip | ~8 GB | ❌ no |
| video-editor | video | Edit/inpaint video | ~8 GB | ❌ no |
| sticker | videos | GIF stickers + social sound effects | 0 GB | ✅ instant |

Core: brand-manager, audio-transcriber, video-cutter, image-generator, video-enhancer, social-resizer, post-scheduler, canva-connector
