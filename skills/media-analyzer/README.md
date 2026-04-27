# 👁️ Media Analyzer

Unified image and video analysis using vision-language models. Supports local GPU inference (30GB VRAM) or cloud inference via HuggingFace API.

## Features

- **Image Analysis** — Composition, objects, engagement potential, brand fit
- **Video Analysis** — Key frame extraction, frame-by-frame understanding, motion scoring
- **Dual Inference** — Local (fast, private) or Cloud (scalable, no setup)
- **Structured Output** — JSON with actionable metrics for downstream skills

## Quick Start

```bash
cd skills/media-analyzer && uv sync

# Analyze local (30GB GPU)
uv run python scripts/analyze.py --input photo.jpg --output results/

# Analyze via cloud (HuggingFace API)
uv run python scripts/analyze.py --input video.mp4 --output results/ \
  --mode cloud --provider huggingface
```

## Config

Edit `config.json`:

```json
{
  "mode": "local",              # local or cloud
  "device": "auto",             # auto, cpu, cuda
  "model": "qwen2.5-vl-32b",   # qwen2.5-vl-32b or qwen2.5-vl-7b
  "max_frames": 10,             # for videos
  "analysis_detail": "standard" # quick, standard, detailed
}
```

## Output Format

```json
{
  "file": "video.mp4",
  "type": "video",
  "duration_seconds": 45,
  "overall_summary": "...",
  "key_moments": [
    {
      "timestamp": "0:05-0:10",
      "description": "Speaker makes eye contact",
      "engagement_score": 0.85,
      "visual_hooks": ["eye contact", "gesture"]
    }
  ],
  "brand_alignment": {
    "score": 0.88,
    "observations": ["Professional"],
    "improvements": ["Add logo"]
  },
  "frames_analyzed": 10,
  "model_used": "Qwen2.5-VL-32B"
}
```

## Provider Selection

### Local Mode (Recommended for 30GB VRAM)

✅ **Qwen2.5-VL-32B**
- 2-3 sec per frame inference
- Private, no API calls
- Best quality

❌ Requires: GPU with 28-32GB VRAM

### Cloud Mode (HuggingFace)

✅ **HuggingFace Inference API**
- Uses existing `HuggingFaceProvider`
- No local GPU needed
- Slower (~5-15 sec per frame)
- Cost: $0.01-0.03 per image

✅ Requires: `HF_TOKEN` environment variable

## Integration with Abra

### Video → Reel

```
media-analyzer ← NEW
  ├─ Extract key frames
  ├─ Engagement scoring
  └─ Cut recommendations
    ↓
  → audio-transcriber (informed by visual analysis)
    ↓
  → video-cutter (ML-driven cut points)
```

### Image → Post

```
media-analyzer ← NEW
  ├─ Composition scoring
  ├─ Engagement potential
  └─ Brand alignment check
    ↓
  → photo-picker (ranked by scores)
```

## Performance

| Model | Device | Time/Frame | Video (10 frames) |
|-------|--------|-----------|---|
| Qwen-32B | A100 | 2-3 sec | ~25 sec |
| Qwen-32B | RTX 4090 | 4-6 sec | ~50 sec |
| Qwen-7B | RTX 4090 | 1-2 sec | ~15 sec |
| Qwen-7B | CPU | 15-30 sec | ~3 min |
| Cloud | HF API | 5-15 sec | ~60 sec |

## Documentation

- **SKILL.md** — Agent workflow, usage patterns, troubleshooting
- **Architecture** — `../../docs/media-analyzer-architecture.md`
- **Vision Models Research** — `../../docs/vision-models-research.md`

## Dependencies

```
torch>=2.0
transformers>=4.40
pillow>=10.0
opencv-python>=4.8
huggingface-hub>=0.19
```

And system: `ffmpeg` (for video processing)

## Environment

```bash
# For cloud mode (HuggingFace)
export HF_TOKEN="hf_..."
```

## Examples

### Analyze video with smart frame sampling

```bash
uv run python scripts/analyze.py \
  --input talk.mp4 \
  --output analysis/ \
  --mode local \
  --max-frames 15 \
  --analysis-detail detailed
```

### Batch analyze photos

```bash
uv run python scripts/analyze.py \
  --input /photos/batch \
  --output /results
```

### Use cloud (no GPU needed)

```bash
uv run python scripts/analyze.py \
  --input images/ \
  --output results/ \
  --mode cloud \
  --provider huggingface
```

## Status

- ✅ Architecture designed
- ✅ Config schema finalized
- ✅ Script implemented
- 📋 Unit tests pending
- 📋 Integration with video-cutter pending
- 📋 Integration with photo-picker pending
