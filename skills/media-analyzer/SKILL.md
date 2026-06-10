---
name: media-analyzer
description: >-
  Analyze images and video frames using vision-language models. Provides detailed
  visual understanding: scene descriptions, object detection, composition analysis,
  motion tracking (video), and brand alignment scoring. Supports local GPU inference
  (30GB+ VRAM) or cloud inference via HuggingFace API.
metadata:
  {
    "openclaw":
      {
        "emoji": "👁️",
        "requires": { "bins": ["uv", "ffmpeg"] },
      },
  }
---

# Media Analyzer

Analyze images and video frames using state-of-the-art vision-language models to extract detailed visual insights for content optimization and brand alignment.

---

## Features

- **Image Analysis:** Scene description, object detection, composition analysis, suggested improvements
- **Video Frame Extraction:** Intelligently sample key frames from video
- **Frame-by-Frame Analysis:** Analyze selected frames from videos with temporal context
- **Brand Alignment:** Score visual content against brand identity
- **JSON Output:** Structured analysis for integration with downstream skills

---

## When to Use

Use this skill when you need to:
- **Understand visual content** before processing (e.g., what's in a video before editing)
- **Detect key moments** in videos (transitions, scene changes, speaker changes)
- **Score composition** of images for quality/engagement potential
- **Validate brand alignment** of visual assets
- **Generate frame-aware captions** with temporal context (e.g., "at 0:05, person gestures...")
- **Batch analyze** product photos or content inventory

---

## Setup (First Run Only)

```bash
cd "$SKILL_DIR" && uv sync
```

Model weights are downloaded on first use:
- **Qwen2.5-VL-32B** (~20-30 GB) — local GPU inference, best quality
- **Qwen2.5-VL-7B** (~8-12 GB) — local CPU/lightweight GPU fallback
- **HuggingFace API** — no local download needed, cloud-based

---

## Configuration

Edit `config.json` before running:

```json
{
  "input_dir": "./input",
  "output_dir": "./output",
  "device": "auto",
  "mode": "local",
  "model": "qwen2.5-vl-32b",
  "provider": null,
  "remote_model": "Qwen/Qwen2.5-VL-7B-Instruct",
  "hf_token_env": "HF_TOKEN",
  "remote_timeout_seconds": 600,
  "video_sampling": "smart",
  "max_frames": 10,
  "analysis_detail": "standard"
}
```

### Config Parameters

| Parameter | Default | Options | Description |
|-----------|---------|---------|---|
| `device` | `auto` | `auto`, `cpu`, `cuda` | Compute device for local inference |
| `mode` | `local` | `local`, `cloud` | Inference mode |
| `model` | `qwen2.5-vl-32b` | `qwen2.5-vl-32b`, `qwen2.5-vl-7b` | Local model size |
| `provider` | `null` | `null`, `huggingface` | Remote provider (if mode=cloud) |
| `video_sampling` | `smart` | `smart`, `uniform`, `keyframe` | Video frame sampling strategy |
| `max_frames` | `10` | 1-60 | Max frames to extract per minute of video |
| `analysis_detail` | `standard` | `quick`, `standard`, `detailed` | Analysis depth (affects latency/cost) |

---

## Usage

### Basic: Analyze images in directory

```bash
cd "$SKILL_DIR"
uv run python scripts/analyze.py --config config.json
```

### CLI Overrides

```bash
# Use cloud inference via HuggingFace
uv run python scripts/analyze.py \
  --input ./photos \
  --output ./results \
  --mode cloud \
  --provider huggingface

# Local analysis on CPU
uv run python scripts/analyze.py \
  --input ./video.mp4 \
  --output ./analysis \
  --device cpu \
  --model qwen2.5-vl-7b

# Detailed frame-by-frame video analysis
uv run python scripts/analyze.py \
  --input ./video.mp4 \
  --output ./results \
  --max-frames 30 \
  --analysis-detail detailed
```

---

## Input/Output

### Input

**Images:** `.jpg`, `.jpeg`, `.png`, `.webp`  
**Videos:** `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`  
**Mixed:** Directory with both images and video files

### Output

For each input file, writes a JSON analysis file:

```json
{
  "file": "video.mp4",
  "type": "video",
  "duration_seconds": 45,
  "analysis": {
    "overall_summary": "Upbeat talking-head video with strong engagement potential...",
    "key_moments": [
      {
        "timestamp": "0:05-0:10",
        "description": "Speaker makes eye contact and gestures",
        "engagement_score": 0.85,
        "visual_hooks": ["eye contact", "hand gesture"],
        "recommend_caption_position": "center"
      }
    ],
    "brand_alignment": {
      "score": 0.88,
      "observations": ["Professional background", "Clean lighting"],
      "improvements": ["Add brand logo overlay"]
    },
    "technical_quality": {
      "lighting": "good",
      "audio_clarity": "clear",
      "motion_stability": "stable"
    },
    "recommended_cuts": [0, 15, 32]
  },
  "frames_analyzed": 10,
  "inference_time_seconds": 12.5,
  "model_used": "Qwen2.5-VL-32B",
  "inference_mode": "local"
}
```

For image files, output contains:
- `description`: One-sentence overview
- `composition_analysis`: Rule of thirds, focus, balance
- `objects_detected`: List of identified objects/people
- `color_palette`: Dominant colors
- `engagement_potential`: 0-1 score for social media appeal
- `brand_alignment`: How well it matches brand identity

---

## Agent Workflow

### Before Running

Ask the user:

```
🎯 Analysis Type
  - Images only → describe composition, quality, brand fit
  - Video → extract key frames, frame-by-frame understanding
  - Mixed → process both

💻 Inference Mode
  - Local (30GB VRAM) → Qwen2.5-VL-32B, ~2-3 sec/frame (default if GPU available)
  - Local lite (8GB) → Qwen2.5-VL-7B, ~1 sec/frame
  - Cloud → HuggingFace API, slower but unlimited scale

🎬 Video Settings (if applicable)
  - Frame sampling: smart (default), uniform, or keyframe-only
  - Max frames: 5 (quick) to 30 (detailed)

📊 Analysis Depth
  - Quick — just descriptions
  - Standard — include composition + brand fit (default)
  - Detailed — add motion tracking + temporal context
```

### Run Command

After user confirms, run:

```bash
cd "$SKILL_DIR"
uv run python scripts/analyze.py --config config.json
```

### Progress Indicators

```
✓ Loading model Qwen2.5-VL-32B (this may take ~30s on first run)...
  Extracting frames from video.mp4...
  Frame 1/10: 0:04 — Speaker introduction
  Frame 2/10: 0:12 — Key point, hand gesture
  ...
✓ Analysis complete. Output: analysis.json
```

---

## Performance Notes

### Local Inference Timing

| Model | Device | Time per Frame | Notes |
|-------|--------|---|---|
| Qwen2.5-VL-32B | A100 (40GB) | 2-3 sec | Highest quality |
| Qwen2.5-VL-32B | RTX 4090 | 4-6 sec | Good quality, slower |
| Qwen2.5-VL-7B | RTX 4090 | 1-2 sec | Balanced speed/quality |
| Qwen2.5-VL-7B | CPU | 15-30 sec | Fallback, slow |

For a 60-second video with 10 frames:
- **32B model:** ~30 seconds (reasonable for batch processing)
- **7B model:** ~15 seconds
- **HuggingFace API:** ~60 seconds (network latency dependent)

### Cost (Cloud Mode)

**HuggingFace Inference API:** ~$0.01-0.03 per image, ~$0.50-2 per video (depending on length and detail level)

---

## Integration with Abra Workflows

### Workflow 1: Video → Reel (Enhanced)

```
video-to-reel workflow
  ↓
media-analyzer ← NEW (understand video before editing)
  ├─ Extract key frames
  ├─ Identify best cut points
  └─ Score engagement potential
  ↓
audio-transcriber (now has visual context)
  ↓
video-cutter (informed by visual analysis)
  ↓
... rest of workflow
```

### Workflow 2: Photo Batch → Posts (Enhanced)

```
image-to-post workflow
  ↓
media-analyzer ← NEW (score composition + brand fit)
  ├─ Rank images by engagement potential
  ├─ Check brand alignment
  └─ Identify composition improvements
  ↓
photo-picker (can use media-analyzer scores)
  ↓
... rest of workflow
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Out of memory (local) | Reduce `max_frames`, use `qwen2.5-vl-7b`, or switch to cloud mode |
| Slow inference | Use smaller model or cloud API; reduce frame sampling |
| Poor frame extraction | Ensure ffmpeg is installed: `which ffmpeg` |
| HuggingFace API timeout | Increase `remote_timeout_seconds` in config |
| Inaccurate descriptions | Use detailed analysis mode; results improve with quality input |

---

## Supported Models

### Local Models

- **Qwen2.5-VL-32B** (32B params, ~28-32 GB VRAM) — Recommended for 30GB systems
- **Qwen2.5-VL-7B** (7B params, ~8-12 GB VRAM) — Lightweight fallback
- Quantized variants (4-bit, 8-bit) reduce VRAM by 50-75%

### Cloud Models

- **HuggingFace Inference API:** Qwen2.5-VL-7B via hosted endpoint
- Other models available through Replicate integration (future)

---

## References

- [Qwen2.5-VL Models](https://huggingface.co/Qwen) — HuggingFace Hub
- [Vision Transformer Tutorial](https://huggingface.co/docs/transformers/tasks/image_classification)
- Related skills: `video-cutter`, `image-captioner`, `post-scheduler`

---
