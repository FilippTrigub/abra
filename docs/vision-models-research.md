# Vision & Multimodal Models Research for Abra

**Date:** 2026-04-27  
**Context:** Evaluate image/video understanding models to add agent vision capabilities to Abra  
**Current System:** Abra uses HuggingFace, Replicate, and RunPod as inference providers

---

## Executive Summary

Abra can integrate multiple vision models to allow agents to understand and analyze images/video frames. The best models for 2026 balance:
- **Video frame understanding** (critical for video workflows)
- **Local/GPU deployment** (compatible with existing RunPod infrastructure)
- **Cost & VRAM efficiency** (to fit existing workflow constraints)
- **Multimodal capabilities** (image + video + text understanding)

---

## Tier 1: Production-Ready Models (Recommended)

### 1. **Qwen2.5-VL-32B** / **Qwen2.5-VL-72B**
- **Strength:** Best overall for video understanding + long documents
- **Video Support:** Up to 1 hour of video with precise frame-by-frame analysis
- **Image Resolution:** 4K support with dynamic resolution handling
- **Capabilities:**
  - Frame-level video understanding (describe what's happening at each second)
  - Scene detection and summarization
  - Text extraction from images (OCR-adjacent)
  - Multilingual understanding
- **Deployment:**
  - Available on HuggingFace Hub
  - Runs on 40GB+ VRAM (72B) or 20GB+ VRAM (32B)
  - Replicate has official deployments
- **Use Case for Abra:** Understand content in user-uploaded videos before processing, extract key moments, auto-generate captions/hooks
- **VRAM:** 20-40 GB (could fall back to 7B variant for CPU)

### 2. **Molmo 2** (Allen AI)
- **Strength:** Specialized in grounded vision + video with localization
- **Capabilities:**
  - Multi-image + video understanding
  - Spatial localization (identify *where* things are in frames)
  - Motion tracking across frames
  - Point/gesture recognition
- **Deployment:** Open source on HuggingFace
- **Use Case for Abra:** Detect objects/people in video for intelligent editing, track motion for cuts, identify key moments
- **VRAM:** ~16-24 GB

### 3. **Qwen3-VL** (if available)
- **Strength:** Next generation, supports hours-long videos with second-level indexing
- **Capabilities:**
  - Process entire books or hours of video
  - Maintain precise recall across long sequences
  - Frame-by-frame description with temporal understanding
- **Status:** Emerging model, likely available mid-2026
- **Use Case for Abra:** Long-form video understanding for podcasts, conferences, webinars

---

## Tier 2: Efficient Models (Lower VRAM)

### 4. **GLM-4.1V-9B-Thinking**
- **Strength:** 9B parameter model matching 72B quality on STEM/reasoning tasks
- **Capabilities:**
  - Strong document analysis (layout, tables, charts)
  - 4K image resolution support
  - Video understanding with reasoning
- **VRAM:** ~12-16 GB
- **Deployment:** Available on HuggingFace
- **Use Case for Abra:** Analyze infographics, charts, technical diagrams in content; reason about complex visual compositions

### 5. **DeepSeek-VL** (1.3B) + **DeepSeek-OCR**
- **Strength:** Lightest viable VLM; OCR specialization
- **Capabilities:**
  - Text recognition (layouts, tables, chemical formulas)
  - Light image understanding
  - Geometry reconstruction
- **VRAM:** ~2-4 GB
- **Deployment:** HuggingFace
- **Use Case for Abra:** Extract text from images, analyze document-heavy content, fallback for CPU-only environments
- **Limitation:** Not suitable for video understanding

### 6. **Pixtral 12B** (Mistral)
- **Strength:** Dense, efficient, native 4K support
- **Capabilities:**
  - Image understanding and reasoning
  - Video frame analysis (but not true video understanding)
  - OCR and text extraction
- **VRAM:** ~8-12 GB
- **Deployment:** Via OpenLLM or Replicate
- **Use Case for Abra:** Lightweight per-frame analysis; fallback when video-specific models aren't available

### 7. **Microsoft Phi-4-multimodal** (5.6B)
- **Strength:** Speech + vision + text in unified architecture
- **Capabilities:**
  - Cross-modal learning
  - Edge/device-friendly
- **VRAM:** ~6-8 GB
- **Deployment:** HuggingFace
- **Use Case for Abra:** Future integration with audio understanding; speech-to-gesture recognition

---

## Tier 3: Specialized Models

### 8. **Gemma 3 Multimodal**
- **Strength:** Google's efficient multimodal model
- **Capabilities:** General image understanding, lightweight
- **VRAM:** ~4-6 GB
- **Deployment:** HuggingFace
- **Use Case:** CPU/edge deployment fallback

---

## Deployment Strategy for Abra

### Current Infrastructure
- **Providers:** HuggingFace, Replicate, RunPod
- **GPU Options:** A100 (40GB/80GB), H100, RTX 4090, etc.
- **Fallback:** CPU support with quantized models

### Recommended Implementation

#### Phase 1: Add Video Understanding (Immediate)
**Model:** Qwen2.5-VL-32B  
**Provider:** HuggingFace or Replicate  
**Integration Points:**
```python
# New skill: video-analyzer
# Takes: video file or frame sequence
# Returns: JSON with frame-by-frame analysis
{
  "frames": [
    {
      "timestamp": "0:00-0:05",
      "description": "Person speaking at desk",
      "objects": ["person", "desk", "computer"],
      "motion": "minimal",
      "hook_potential": 0.3
    }
  ],
  "video_summary": "...",
  "recommended_cuts": [0, 15, 32]
}
```

#### Phase 2: Add Image Analysis (Medium Priority)
**Models:** GLM-4.1V-9B or Pixtral 12B  
**New Skill:** image-analyzer  
**Use:** Auto-analyze photos for brand fit, composition, quality before enhancement

#### Phase 3: Add OCR/Text Extraction (Low Priority)
**Model:** DeepSeek-OCR  
**New Skill:** image-text-extractor  
**Use:** Extract text from screenshots, documents for blog-to-post pipelines

---

## Hardware Requirements

| Model | VRAM (optimal) | VRAM (quantized) | Deployment |
|-------|---|---|---|
| Qwen2.5-VL-72B | 80GB | 32GB (4-bit) | A100 or dual H100 |
| Qwen2.5-VL-32B | 40GB | 16GB (4-bit) | Single A100 |
| Molmo 2 | 24GB | 12GB (4-bit) | A100-40GB |
| GLM-4.1V-9B | 16GB | 8GB (4-bit) | RTX 4090 / A6000 |
| Pixtral 12B | 12GB | 6GB (4-bit) | RTX 4090 |
| DeepSeek-VL 1.3B | 4GB | 2GB (quantized) | Laptop/edge |

---

## Integration with Existing Abra Skills

### Before & After Architecture

**Current:**
```
Video Input
  ↓
audio-transcriber (text)
  ↓
video-cutter (human-guided or heuristic)
  ↓
...processing...
```

**Enhanced:**
```
Video Input
  ↓
video-analyzer (Qwen2.5-VL) ← NEW
  ├─ Frame-by-frame understanding
  ├─ Scene detection
  └─ Recommended cut points (ML-driven)
  ↓
audio-transcriber (timestamps now aligned with visual analysis)
  ↓
video-cutter (informed by visual + audio)
  ↓
...processing...
```

### New Skills to Add

1. **video-analyzer**
   - Input: Video file
   - Output: JSON with frame descriptions, scene boundaries, engagement scores
   - Provider: HuggingFace (Qwen2.5-VL-32B)

2. **image-analyzer**
   - Input: Image(s)
   - Output: JSON with visual analysis, composition score, brand alignment
   - Provider: HuggingFace (GLM-4.1V-9B or Pixtral 12B)

3. **frame-extractor**
   - Input: Video
   - Output: Key frames based on video-analyzer output
   - Provider: Local (ffmpeg)

4. **image-text-extractor**
   - Input: Image
   - Output: Extracted text, layout analysis
   - Provider: HuggingFace (DeepSeek-OCR)

---

## Cost Estimates (via Replicate/HuggingFace)

| Model | Cost/sec | Cost/min | Typical use |
|-------|----------|----------|---|
| Qwen2.5-VL-72B | $0.10-0.15 | $6-9 | One full video |
| Qwen2.5-VL-32B | $0.05-0.08 | $3-5 | One full video |
| GLM-4.1V-9B | $0.02-0.03 | $1.20-1.80 | Batch image analysis |
| Pixtral 12B | $0.01-0.02 | $0.60-1.20 | Per-frame analysis |

**Recommendation:** Run video-analyzer on key segments (first 30s + mid-point) for cost-effective understanding, not full video.

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| GPU VRAM constraints | Quantize models (4-bit); use smaller variants; batch process frames |
| High inference latency on long videos | Subsample frames (1fps → 0.1fps); use streaming inference |
| Cost overruns on premium models | Cap analysis to video clips <2min; use cheaper models for low-stakes analysis |
| Model hallucinations in captions | Always validate model output before using in public posts; pair with human review |
| Video format compatibility | Normalize inputs via ffmpeg; pre-process to H.264 MP4 |

---

## Recommended Next Steps

1. **PoC:** Deploy Qwen2.5-VL-32B on RunPod, test on 10-20 sample videos from actual workflows
2. **Integration:** Write video-analyzer skill wrapper with HuggingFace provider integration
3. **Evaluation:** Measure:
   - Accuracy of frame descriptions (manual spot-check)
   - Latency per minute of video
   - Cost per workflow run
   - Improvement in downstream skill outputs (video-cutter quality)
4. **Rollout:** Integrate into video-to-reel workflow as optional `--analyze-video` flag
5. **Expansion:** Add image-analyzer and text-extractor based on PoC learnings

---

## Sources

- [Best Open-Source Vision Language Models of 2026 — Labellerr](https://www.labellerr.com/blog/top-open-source-vision-language-models/)
- [Multimodal AI: The Best Open-Source Vision Language Models in 2026 — BentoML](https://www.bentoml.com/blog/multimodal-ai-a-guide-to-open-source-vision-language-models)
- [Top 10 Vision Language Models in 2026 — DataCamp](https://www.datacamp.com/blog/top-vision-language-models)
- [Molmo 2: Video Understanding and Tracking — AI2](https://allenai.org/blog/molmo2)
- [Best Open Source Multimodal Models in 2026 — Silicon Flow](https://www.siliconflow.io/articles/en/best-open-source-multimodal-models-2025)
- [Best Vision & Multimodal LLMs January 2026 — WhatLLM](https://whatllm.org/blog/best-vision-models-january-2026)
