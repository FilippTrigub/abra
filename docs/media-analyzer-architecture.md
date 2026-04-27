# Media Analyzer Skill Architecture

**Date:** 2026-04-27  
**Status:** Ready for Implementation  
**Related:** `skills/media-analyzer/`

---

## Overview

The **media-analyzer** skill provides unified image and video understanding for the Abra system. It supports both local GPU inference and cloud-based inference via HuggingFace Inference API.

**Key Design Decision:** Single skill for images + videos (not separate skills) because:
1. Shared model infrastructure (same VLM for both)
2. Unified analysis JSON schema
3. Seamless video frame extraction and analysis
4. Easier maintenance than parallel implementations

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  media-analyzer Skill                                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Input: Images or Videos (or both)                           │
│    ├─ Images: .jpg, .png, .webp                             │
│    └─ Videos: .mp4, .mov, .avi, .mkv                        │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Inference Mode Selection                                    │
│                                                               │
│  ┌──────────────────┐          ┌──────────────────┐         │
│  │  LOCAL MODE      │          │  CLOUD MODE      │         │
│  │  (30GB VRAM)     │          │  (HuggingFace)   │         │
│  │                  │          │                  │         │
│  │ ✓ Qwen-32B      │          │ ✓ API-based      │         │
│  │ ✓ Qwen-7B       │          │ ✓ No setup needed│         │
│  │ ✓ No API calls   │          │ ✓ Slower        │         │
│  │ ✓ Fast inference │          │ ✓ Scalable      │         │
│  └──────────────────┘          └──────────────────┘         │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Processing Pipeline                                         │
│                                                               │
│  1. Load Input                                               │
│     ├─ Image: PIL.Image.open()                              │
│     └─ Video: ffmpeg extract frames                         │
│                                                               │
│  2. Prepare Model                                            │
│     ├─ Local: Load from HuggingFace Hub                     │
│     └─ Cloud: HuggingFaceProvider.chat_with_image()        │
│                                                               │
│  3. Generate Prompts                                         │
│     ├─ Image: Composition, objects, engagement             │
│     └─ Video: Frame-by-frame with timestamps               │
│                                                               │
│  4. Run Inference                                            │
│     ├─ Local: model.generate()                             │
│     └─ Cloud: API call (huggingface_hub)                   │
│                                                               │
│  5. Parse Response                                           │
│     └─ JSON with analysis metrics                          │
│                                                               │
│  6. Write Output                                             │
│     └─ {filename}_analysis.json per input file            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Provider Integration

### How It Uses Existing Providers

The skill integrates with Abra's existing provider system (`skills/_providers/`):

#### 1. **Local Mode** (No Provider)

```python
# Load model directly from HuggingFace Hub
model, processor = load_local_model("qwen2.5-vl-32b", device="cuda")

# Call model inference
response = analyze_image_local(image_path, model, processor, prompt)
```

**Workflow:**
1. User specifies `"mode": "local"` in config
2. Script loads `transformers.AutoModel` from HuggingFace Hub
3. Inference runs on local GPU/CPU
4. No API key needed; no provider wrapper required

**Models Supported:**
- `qwen2.5-vl-32b` (32B, ~28-32GB VRAM) — Maps to `Qwen/Qwen2.5-VL-32B-Instruct`
- `qwen2.5-vl-7b` (7B, ~8-12GB VRAM) — Maps to `Qwen/Qwen2.5-VL-7B-Instruct`
- Both downloaded automatically from HuggingFace on first run

#### 2. **Cloud Mode** (HuggingFace Provider)

```python
from skills._providers.huggingface import HuggingFaceProvider
from skills._providers.config import remote_provider_from_config

# Create provider from config
provider_cfg = remote_provider_from_config(cfg)
hf_provider = HuggingFaceProvider(provider_cfg)

# Use existing chat_with_image method
response = hf_provider.chat_with_image(
    image_bytes,
    model="Qwen/Qwen2.5-VL-7B-Instruct",
    prompt=prompt,
)
```

**Workflow:**
1. User specifies `"mode": "cloud"` and `"provider": "huggingface"` in config
2. Script uses `HuggingFaceProvider` (from `skills/_providers/huggingface.py`)
3. Calls existing `chat_with_image()` method (already supports vision models)
4. Requires `HF_TOKEN` environment variable
5. Inference runs on HuggingFace Inference API servers

**Config Example:**
```json
{
  "mode": "cloud",
  "provider": "huggingface",
  "remote_model": "Qwen/Qwen2.5-VL-7B-Instruct",
  "hf_token_env": "HF_TOKEN"
}
```

---

## Provider Suitability Analysis

### Why HuggingFace Provider?

| Provider | Suitable? | Reason |
|----------|-----------|--------|
| **HuggingFace** | ✅ YES | Has `chat_with_image()` for vision; Qwen models available; supports image in base64 |
| **Replicate** | ⚠️ MAYBE | Has `caption_image()` but only for captions, not general vision tasks; less flexible |
| **RunPod** | ❌ NO | Designed for containerized tasks with file staging; overkill for simple inference |

**HuggingFace is the best choice** because:
1. Native vision support via `chat_with_image()`
2. Qwen2.5-VL models available on their Inference API
3. Works seamlessly with existing `HuggingFaceProvider` class
4. Simple base64 image encoding (no file staging needed)
5. Flexible timeout settings already in config

### Why Not Replicate?

Replicate's `caption_image()` is too specialized:
```python
# Replicate only has caption_image()
result = provider.caption_image(image_path, model=model, prompt=prompt)
```

This generates captions only. Media Analyzer needs:
- Object detection
- Composition analysis
- Engagement scoring
- Brand alignment
- Video temporal analysis

These require a general-purpose vision model with custom prompting, which HuggingFace supports via `chat_with_image()`.

### Why Not RunPod?

RunPod provider is designed for:
- Custom Docker containers
- File staging via Backblaze B2
- Long-running batch jobs
- GPU pod management

Media Analyzer needs:
- Simple per-image/per-frame inference
- Quick turnaround (<5 sec per frame)
- No container customization
- Direct API calls

RunPod would add unnecessary complexity and latency.

---

## Config Schema

```json
{
  "input_dir": "./input",
  "output_dir": "./output",

  "mode": "local",
  "device": "auto",

  "model": "qwen2.5-vl-32b",

  "provider": null,
  "remote_model": "Qwen/Qwen2.5-VL-7B-Instruct",
  "hf_token_env": "HF_TOKEN",
  "replicate_api_key_env": "REPLICATE_API_TOKEN",
  "remote_timeout_seconds": 600,

  "video_sampling": "smart",
  "max_frames": 10,
  "analysis_detail": "standard",

  "score_brand_alignment": true,
  "extract_key_moments": true,
  "detailed_composition_analysis": true
}
```

### Config Parameter Explanation

| Parameter | Type | Default | Options | Notes |
|-----------|------|---------|---------|-------|
| `mode` | string | `local` | `local`, `cloud` | Inference location |
| `device` | string | `auto` | `auto`, `cpu`, `cuda` | Compute device (local only) |
| `model` | string | `qwen2.5-vl-32b` | `qwen2.5-vl-32b`, `qwen2.5-vl-7b` | Local model size |
| `provider` | string\|null | `null` | `null`, `huggingface` | Cloud provider (cloud mode) |
| `remote_model` | string | `Qwen/Qwen2.5-VL-7B-Instruct` | Any HuggingFace model | Cloud model to use |
| `hf_token_env` | string | `HF_TOKEN` | Any env var | Where to read HF API key |
| `remote_timeout_seconds` | int | `600` | 1-3600 | API timeout in seconds |
| `video_sampling` | string | `smart` | `smart`, `uniform`, `keyframe` | Frame extraction strategy |
| `max_frames` | int | `10` | 1-120 | Max frames per minute of video |
| `analysis_detail` | string | `standard` | `quick`, `standard`, `detailed` | Analysis depth / cost |

---

## Data Flow

### Image Analysis Flow

```
Input Image (JPG, PNG, etc.)
    ↓
[Load via PIL.Image]
    ↓
[Generate analysis prompt]
    ↓
┌─────────────────────────────────┐
│ INFERENCE ENGINE                │
├─────────────────────────────────┤
│                                  │
│  LOCAL MODE:                     │
│  ├─ Load Qwen-32B from Hub      │
│  ├─ model.generate()            │
│  └─ Return response             │
│                                  │
│  CLOUD MODE:                     │
│  ├─ Encode image as base64      │
│  ├─ Call HuggingFace API        │
│  └─ Return response             │
│                                  │
└─────────────────────────────────┘
    ↓
[Parse JSON response]
    ↓
ImageAnalysis dataclass
├─ description
├─ composition (rule of thirds, colors)
├─ objects_detected
├─ engagement_potential (0-1)
├─ brand_alignment
└─ technical_quality
    ↓
Write {filename}_analysis.json
    ↓
Output Directory
```

### Video Analysis Flow

```
Input Video (MP4, MOV, etc.)
    ↓
[Get metadata: FPS, duration, total frames]
    ↓
[Compute frame indices using sampling strategy]
├─ smart: first, last, middle, evenly distributed
├─ uniform: N evenly-spaced frames
└─ keyframe: only first, middle, last
    ↓
[Extract frames via ffmpeg to temp directory]
    ↓
For each extracted frame:
    ├─ Generate frame-specific prompt with timestamp
    ├─ Run inference (same as image analysis)
    ├─ Parse response
    └─ Store as KeyMoment
    ↓
VideoAnalysis dataclass
├─ overall_summary
├─ key_moments[] (each with timestamp, description, engagement score)
├─ brand_alignment
├─ technical_quality
├─ recommended_cuts (frame numbers)
└─ frames_analyzed (count)
    ↓
Write {filename}_analysis.json
    ↓
Output Directory
```

---

## Performance Characteristics

### Local Inference (GPU)

| Model | Device | Per-Frame | Per-Minute Video | 30GB VRAM Fit? |
|-------|--------|-----------|---|---|
| Qwen-32B | A100-40GB | 2-3 sec | ~2 min (10 frames) | ✅ Yes |
| Qwen-32B | RTX 4090 | 4-6 sec | ~5 min (10 frames) | ✅ Yes (tight) |
| Qwen-7B | RTX 4090 | 1-2 sec | ~1 min (10 frames) | ✅ Yes |
| Qwen-7B | CPU | 15-30 sec | ~3-5 min (10 frames) | ✅ Yes |

**Recommendation for 30GB VRAM:**
- Use `qwen2.5-vl-32b` with `device: cuda`
- Inference time: ~2-3 sec per frame
- For 60-second video with 10 frames: ~25-30 seconds total

### Cloud Inference (HuggingFace API)

| Operation | Latency | Cost |
|-----------|---------|------|
| Image analysis | 5-15 sec | $0.01-0.03 |
| Per video frame | 5-15 sec | $0.01-0.03 |
| 60-sec video (10 frames) | ~60 sec | $0.10-0.30 |

**Note:** Cloud is slower due to network latency but costs are very reasonable for occasional use.

---

## Integration with Abra Workflows

### Video → Reel Workflow (Enhanced)

**Before:**
```
video → audio-transcriber → video-cutter → ... → scheduler
```

**After:**
```
video → media-analyzer ← NEW (understand video structure)
    ├─ Extract key frames with engagement scores
    ├─ Identify optimal cut points
    └─ Get frame-by-frame descriptions
       ↓
    → audio-transcriber (now has visual context)
       ↓
    → video-cutter (informed by media-analyzer recommendations)
       ↓
    → ... rest of workflow
```

### Image → Post Workflow (Enhanced)

**Before:**
```
photos → photo-picker → enhancements → ... → scheduler
```

**After:**
```
photos → media-analyzer ← NEW (score each photo)
    ├─ Composition analysis
    ├─ Engagement potential
    └─ Brand alignment score
       ↓
    → photo-picker (now has scores to rank by)
       ↓
    → ... rest of workflow
```

---

## Usage Examples

### Example 1: Analyze a single image (local)

```bash
cd skills/media-analyzer
uv run python scripts/analyze.py \
  --input ./hero.jpg \
  --output ./results \
  --mode local \
  --device cuda \
  --model qwen2.5-vl-32b
```

Output: `results/hero_analysis.json`

### Example 2: Analyze video frames (cloud, fast)

```bash
cd skills/media-analyzer
uv run python scripts/analyze.py \
  --input ./talk.mp4 \
  --output ./results \
  --mode cloud \
  --provider huggingface \
  --max-frames 5 \
  --analysis-detail quick
```

Output: `results/talk_analysis.json` (5 key frames analyzed)

### Example 3: Batch analyze all photos in directory (local, detailed)

```bash
cd skills/media-analyzer
uv run python scripts/analyze.py \
  --input ./photo_batch \
  --output ./analysis \
  --mode local \
  --analysis-detail detailed
```

Output: Multiple JSON files in `analysis/`

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|-----------|
| `CUDA out of memory` | Model too large for GPU | Use `qwen2.5-vl-7b` or smaller |
| `Module not found: transformers` | Dependencies not installed | Run `uv sync` first |
| `Failed to load image` | Unsupported format | Convert to JPG/PNG first |
| `ffmpeg not found` | Required for video processing | `apt-get install ffmpeg` |
| `HF_TOKEN not set` | Cloud mode without API key | Set `HF_TOKEN` environment variable |
| `Request timeout` | API call too slow | Increase `remote_timeout_seconds` in config |

---

## Testing Strategy

### Unit Tests

```python
# Test local inference
def test_analyze_image_local():
    model, processor = load_local_model("qwen2.5-vl-7b", "cpu")
    analysis = analyze_image(test_image_path, "local", model, processor)
    assert analysis.engagement_potential >= 0
    assert len(analysis.objects_detected) > 0

# Test config validation
def test_validate_config_invalid_mode():
    cfg = {"mode": "invalid"}
    with pytest.raises(SystemExit):
        validate_config(cfg)

# Test video frame extraction
def test_extract_video_frames():
    frames, duration = extract_video_frames(test_video_path, tmpdir, "smart", 5)
    assert len(frames) == 5
    assert duration > 0
```

### Integration Tests

- [ ] Test local inference with Qwen-32B on GPU
- [ ] Test cloud inference via HuggingFace API
- [ ] Test video frame extraction with multiple codecs
- [ ] Test batch image analysis
- [ ] Test config overrides via CLI

### Performance Tests

- [ ] Measure inference latency per model
- [ ] Measure VRAM usage during inference
- [ ] Test throughput on batch of 100 images

---

## Future Enhancements

1. **Quantization:** Support 4-bit/8-bit quantized models for lower VRAM footprint
2. **Batching:** Process multiple frames in parallel for faster video analysis
3. **Caching:** Cache model embeddings to speed up similar images
4. **Replicate Integration:** Add caption video models from Replicate
5. **Audio Analysis:** Extract audio track for speech-to-text + speaker detection
6. **Motion Tracking:** Use optical flow for motion analysis in videos
7. **Custom Prompting:** Allow users to provide custom analysis prompts

---

## References

- Vision Model Research: `docs/vision-models-research.md`
- Skills Provider System: `skills/_providers/`
- Image Captioner (Related): `skills/image-captioner/`
- HuggingFace Transformers: https://huggingface.co/docs/transformers
- Qwen2.5-VL Documentation: https://huggingface.co/Qwen

---
