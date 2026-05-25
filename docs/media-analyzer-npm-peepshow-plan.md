# Media Analyzer npm + Peepshow Rewrite Plan

**Date:** 2026-05-19  
**Status:** Proposed  
**Scope:** Rewrite `skills/media-analyzer` as the unified npm-based media understanding skill for Abra.  
**Related skills:** `skills/media-analyzer`, `skills/audio-transcriber`  
**External reference:** `https://github.com/t0mtaylor/peepshow`, `https://www.peepshow.dev/`

---

## Summary

Rewrite `media-analyzer` as an npm-first skill that absorbs the useful parts of Peepshow and folds in `audio-transcriber` capability. The resulting skill should be easy for agents to invoke, should keep Abra's workflow contracts stable, and should support two primary modes:

1. **Transcript-only mode** — produce a transcript and brand-aware summary/context without frame analysis.
2. **Full analysis mode** — produce transcript, extracted frames/timeline, visual analysis, brand alignment, key moments, engagement scoring, and recommended cuts.

This is an improvement of the existing `media-analyzer` skill, not a new skill.

---

## Goals

- Replace the Python-heavy `media-analyzer` runtime with an npm-based implementation.
- Use Peepshow's strongest ideas for video ingestion: video-to-frames, transcript/timeline extraction, manifests, local reports, and LLM-friendly output.
- Fold `audio-transcriber` into `media-analyzer` so agents have one obvious skill for media understanding.
- Keep transcript-only usage cheap and fast by making frame analysis optional.
- Require brand context in both transcript-only and full-analysis modes.
- Preserve downstream workflow compatibility, especially transcript JSON with top-level `segments`.

---

## Non-Goals

- Do not create a separate `peepshow` or `video-context-extractor` skill.
- Do not remove `audio-transcriber` immediately; deprecate after workflow compatibility is proven.
- Do not blindly vendor Peepshow runtime code unless the local clone shows small, reusable, MIT-compatible source modules.
- Do not make full VLM/frame analysis mandatory for transcript-only workflows.
- Do not break `post-scheduler` text derivation in `workflows/run.py`.

---

## Current State

### `media-analyzer`

Current files:

- `skills/media-analyzer/SKILL.md`
- `skills/media-analyzer/config.json`
- `skills/media-analyzer/scripts/analyze.py`
- `docs/media-analyzer-architecture.md`

Current behavior:

- Accepts images and videos.
- Extracts/samples video frames.
- Runs local or cloud vision-language analysis.
- Emits one JSON file per input: `<stem>_analysis.json`.

Current video output fields include:

- `file`
- `type`
- `duration_seconds`
- `overall_summary`
- `key_moments[]`
- `brand_alignment`
- `technical_quality`
- `recommended_cuts`
- `frames_analyzed`
- `model_used`
- `inference_mode`

### `audio-transcriber`

Current files:

- `skills/audio-transcriber/SKILL.md`
- `skills/audio-transcriber/config.json`
- `skills/audio-transcriber/scripts/transcriber.py`

Current behavior:

- Accepts audio and video files.
- Extracts audio from video when needed.
- Runs local or remote ASR.
- Emits one JSON file per input: `<stem>_transcription.json`.

Current transcript output shape:

```json
{
  "file": "video.mp4",
  "duration": 120.5,
  "language": "en",
  "model": "distil-whisper/distil-large-v3",
  "segments": [
    { "start": 0.0, "end": 4.2, "text": "..." }
  ]
}
```

This shape is migration-critical because `workflows/run.py` derives scheduler text by reading top-level `segments` from JSON files.

---

## Desired End State

`media-analyzer` becomes the single skill for media context extraction and analysis:

```text
skills/media-analyzer/
├── input/
├── output/
├── src/
│   ├── cli.ts
│   ├── config.ts
│   ├── brand-context.ts
│   ├── ingest/
│   │   ├── peepshow.ts
│   │   ├── audio.ts
│   │   └── manifest.ts
│   ├── transcript/
│   │   ├── asr.ts
│   │   └── normalize.ts
│   ├── analysis/
│   │   ├── prompts.ts
│   │   ├── vision.ts
│   │   └── scoring.ts
│   └── output/
│       ├── transcript.ts
│       ├── analysis.ts
│       └── report.ts
├── scripts/
│   └── analyze.mjs
├── config.json
├── package.json
├── tsconfig.json
├── SKILL.md
└── README.md
```

The supported invocation should remain simple:

```bash
cd skills/media-analyzer
npm install
npm run analyze -- --input ./input --output ./output --mode transcript
```

or:

```bash
npm run analyze -- --input ./input --output ./output --mode full
```

For Abra workflow compatibility, keep a wrapper script at a predictable path if needed:

```bash
node scripts/analyze.mjs --input ./input --output ./output --mode full
```

---

## Modes

### 1. Transcript-only mode

Purpose: fast, cheap transcript extraction for `audio-to-post`, scheduling text, and lightweight brand-aware summarization.

CLI:

```bash
npm run analyze -- --input ./input --output ./output --mode transcript
```

Behavior:

- Accept audio or video.
- Extract audio if source is video.
- Produce `<stem>_transcription.json` with top-level `segments`.
- Load brand context.
- Produce optional `<stem>_brand_context.json` or include brand-aware summary in the main media-analysis output.
- Skip frame extraction and VLM analysis unless explicitly requested.

Required output:

```json
{
  "file": "video.mp4",
  "duration": 120.5,
  "language": "en",
  "model": "...",
  "segments": [
    { "start": 0.0, "end": 4.2, "text": "..." }
  ]
}
```

This preserves compatibility with `workflows/run.py` and `post-scheduler` text derivation.

### 2. Full analysis mode

Purpose: rich video/image understanding for reels, editing decisions, captions, hooks, and brand alignment.

CLI:

```bash
npm run analyze -- --input ./input --output ./output --mode full
```

Behavior:

- Accept image, audio, or video.
- For audio: run transcript-only behavior plus brand-aware summary.
- For images: run visual analysis against brand context.
- For videos:
  - Extract transcript.
  - Extract frames/timeline using Peepshow-inspired ingestion.
  - Emit manifest/report artifacts.
  - Run optional VLM/frame analysis.
  - Score brand alignment, engagement potential, and key moments.
  - Emit recommended cuts.

Required output:

- `<stem>_transcription.json` when media has audio.
- `<stem>_analysis.json` for full media analysis.
- Optional `frames/<stem>/...` and `manifests/<stem>.json` artifacts.

---

## Brand Context Requirement

Both modes must load brand context.

Supported brand inputs:

1. `--brand-file ../../BRAND.md`
2. `--brand-assets ../brand-manager/brand-assets/asset-manifest.json`
3. Config defaults:

```json
{
  "brand_file": "../../BRAND.md",
  "brand_assets_manifest": "../brand-manager/brand-assets/asset-manifest.json",
  "require_brand_context": true
}
```

Behavior when brand context is missing:

- Default: fail clearly with remediation instructions.
- Optional override: `--allow-missing-brand-context` for tests or isolated local runs.

Transcript-only mode should use brand context to produce a brand-aware summary, topic map, or repurposing hints, even when frame analysis is disabled.

Full-analysis mode should use brand context for:

- brand alignment scoring,
- visual style recommendations,
- caption/hook positioning suggestions,
- recommended cuts based on the user's voice and content goals.

---

## Peepshow Usage Strategy

Step 1 is to clone Peepshow locally for inspection:

```bash
git clone https://github.com/t0mtaylor/peepshow vendor/peepshow
```

Use the clone to identify reusable concepts and verify runtime availability. Do not automatically copy code.

Preferred integration order:

1. **Use Peepshow as reference and CLI inspiration.**
2. **Call Peepshow via npm/CLI if the published runtime gives stable frame/transcript artifacts.**
3. **Reimplement small ideas in TypeScript only when that is simpler than shelling out.**
4. **Vendor code only if it is clearly present, small, MIT-compatible, and easier to maintain locally.**

Peepshow-inspired features to adopt:

- frame/timeline manifest,
- run directory with stable artifacts,
- JSON/Markdown/paths emission options,
- local HTML report,
- sink-like output adapters where useful,
- LLM-friendly compact context output.

---

## Config Contract

Proposed `skills/media-analyzer/config.json`:

```json
{
  "input_dir": "./input",
  "output_dir": "./output",

  "mode": "full",
  "analyze_frames": true,
  "transcribe": true,

  "brand_file": "../../BRAND.md",
  "brand_assets_manifest": "../brand-manager/brand-assets/asset-manifest.json",
  "require_brand_context": true,

  "ingestion_backend": "native",
  "peepshow_command": "peepshow",
  "emit_frames": true,
  "emit_manifest": true,
  "emit_report": true,

  "language": "en",
  "asr_provider": "local",
  "asr_model": "distil-whisper/distil-large-v3",

  "vision_provider": "huggingface",
  "vision_model": "Qwen/Qwen2.5-VL-7B-Instruct",
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

CLI overrides should use agent-friendly flags:

```bash
--mode transcript|full
--input PATH
--output PATH
--brand-file PATH
--brand-assets-manifest PATH
--analyze-frames true|false
--transcribe true|false
--max-frames N
--analysis-detail quick|standard|detailed
```

---

## Output Contract

### Transcript artifact

Always emit this when transcription runs:

```text
<output>/<stem>_transcription.json
```

Shape must keep top-level `segments`:

```json
{
  "file": "video.mp4",
  "duration": 120.5,
  "language": "en",
  "model": "distil-whisper/distil-large-v3",
  "provider": "local",
  "brand_context_used": true,
  "segments": [
    { "start": 0.0, "end": 4.2, "text": "..." }
  ],
  "brand_summary": {
    "core_message": "...",
    "topics": ["..."],
    "repurposing_notes": ["..."]
  }
}
```

### Analysis artifact

Emit this in full mode:

```text
<output>/<stem>_analysis.json
```

Recommended shape:

```json
{
  "file": "video.mp4",
  "type": "video",
  "mode": "full",
  "brand_context_used": true,
  "duration_seconds": 120.5,
  "transcript_path": "video_transcription.json",
  "manifest_path": "manifests/video_manifest.json",
  "frames_path": "frames/video/",
  "overall_summary": "...",
  "key_moments": [
    {
      "timestamp": "0:05-0:10",
      "description": "...",
      "engagement_score": 0.85,
      "visual_hooks": ["..."],
      "recommend_caption_position": "center"
    }
  ],
  "brand_alignment": {
    "score": 0.88,
    "observations": ["..."],
    "improvements": ["..."]
  },
  "technical_quality": {
    "lighting": "good",
    "audio_clarity": "clear",
    "motion_stability": "stable"
  },
  "recommended_cuts": [0, 15, 32],
  "frames_analyzed": 10,
  "model_used": "Qwen/Qwen2.5-VL-7B-Instruct",
  "inference_mode": "cloud"
}
```

---

## Workflow Migration

### `video-to-reel`

Current:

```text
brand-manager → audio-transcriber → video-cutter → ...
```

Target:

```text
brand-manager → media-analyzer --mode full → video-cutter → ...
```

The `video-cutter` step can continue reading transcript segments if the merged analyzer emits `<stem>_transcription.json` with the current top-level `segments` shape.

### `audio-to-post`

Current:

```text
brand-manager → audio-transcriber → brand-manager → post-scheduler
```

Target:

```text
brand-manager → media-analyzer --mode transcript → brand-manager → post-scheduler
```

The scheduler remains compatible if transcript JSON keeps top-level `segments`.

### `image-to-post`

Optional future improvement:

```text
brand-manager → media-analyzer --mode full → image-captioner? → post-scheduler
```

Do not change this workflow in the first migration unless tests show the analyzer can replace `image-captioner` safely.

---

## Deprecation Plan for `audio-transcriber`

1. Keep `skills/audio-transcriber` present during the first rewrite.
2. Add docs noting that `media-analyzer --mode transcript` is the preferred path.
3. Update workflows to use `media-analyzer` once transcript artifacts are verified.
4. Keep a compatibility shim if external agents still call `audio-transcriber`.
5. Remove or archive `audio-transcriber` only after workflow and scheduler tests pass.

---

## Implementation Phases

### Phase 1 — Research and local clone

- Clone Peepshow locally under `vendor/peepshow` or `/tmp/peepshow` for inspection.
- Verify what source code is available in the repo versus npm package.
- Identify stable Peepshow CLI commands and output artifacts.
- Decide whether `media-analyzer` shells out to Peepshow or reimplements selected ingestion pieces.

### Phase 2 — npm skill scaffold

- Add `package.json`, `tsconfig.json`, and npm scripts to `skills/media-analyzer`.
- Add `src/` TypeScript structure.
- Keep `scripts/analyze.mjs` as a stable executable entry point.
- Preserve `config.json` loading and CLI override behavior.

### Phase 3 — transcript mode

- Implement audio extraction for video.
- Implement ASR provider abstraction.
- Emit `<stem>_transcription.json` with top-level `segments`.
- Load brand context and add brand-aware summary fields.
- Validate against `audio-to-post` expectations.

### Phase 4 — full mode ingestion

- Add frame extraction/timeline manifest.
- Add optional Peepshow CLI backend or Peepshow-inspired native backend.
- Emit frames, manifest, and optional report artifacts.
- Ensure `--analyze-frames false` skips this path cleanly.

### Phase 5 — full mode analysis

- Implement vision provider calls.
- Generate brand-aware prompts.
- Produce key moments, brand alignment, engagement scoring, technical quality, and recommended cuts.
- Preserve existing `<stem>_analysis.json` field names where possible.

### Phase 6 — workflow migration

- Update `workflows/creative/video-to-reel/config.json` to call `media-analyzer` instead of `audio-transcriber`.
- Update `workflows/creative/audio-to-post/config.json` to call `media-analyzer` in transcript mode.
- Update `workflows/run.py` only if needed for mode params or transcript discovery.
- Update `WORKFLOW.md`, `SKILLS.md`, and skill docs.

### Phase 7 — compatibility and cleanup

- Add or update tests for transcript-only and full analysis modes.
- Keep `audio-transcriber` as compatibility fallback.
- Document deprecation path.

---

## Verification Plan

Minimum checks before workflow migration:

- Transcript-only mode processes `.mp3`, `.wav`, and `.mp4` inputs.
- Transcript output keeps top-level `segments`.
- `workflows/run.py` can derive scheduler text from analyzer-produced transcript JSON.
- Full mode emits both transcript and analysis JSON for a video.
- Full mode can skip frame analysis with `--mode transcript` or `--analyze-frames false`.
- Missing brand context fails clearly unless explicitly overridden.
- Existing `video-to-reel` and `audio-to-post` workflows still schedule correctly after step replacement.

Suggested test fixtures:

- Short audio-only file.
- Short talking-head video with audio.
- Silent video.
- Image-only input.
- Missing `BRAND.md` case.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Peepshow GitHub repo lacks runtime source | Copying code may be impossible or unhelpful | Clone for reference, integrate via npm CLI or reimplement small ideas |
| npm rewrite breaks workflow runner expectations | Existing workflows fail | Preserve transcript JSON artifact and top-level `segments` |
| Full analysis becomes too slow/expensive | Agents avoid using the skill | Make transcript-only mode first-class and frame analysis optional |
| Brand context missing in transcript mode | Outputs become generic | Require brand file/manifest by default |
| Mixed media responsibilities make skill too complex | Harder maintenance | Separate internal modules: ingest, transcript, analysis, output |
| `audio-transcriber` callers break | Regression for existing users | Keep compatibility skill/shim until migration is proven |

---

## Key Decisions

1. `media-analyzer` becomes the canonical media understanding skill.
2. `audio-transcriber` functionality is folded in, but transcript-only mode remains cheap and simple.
3. Brand context is required for both transcript and full analysis modes.
4. Frame analysis is optional.
5. Transcript JSON must preserve top-level `segments`.
6. Peepshow is used as a reference and possible CLI backend, not blindly vendored.
