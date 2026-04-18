# Lambda Labs GPU Inference Implementation Plan

## Overview

Add Lambda Labs as a remote GPU inference provider for all GPU-using skills in the Abra skillset. This enables users without local GPU access to run GPU-dependent tasks on serverless Lambda infrastructure.

## Principles

- Local mode remains the default (unchanged)
- Remote providers are **opt-in only**
- Missing credentials fail fast — no silent fallback
- Implementation follows same pattern as existing HuggingFace/Replicate providers

## Target Skills

### High Priority (No CPU fallback)
| Skill | Min VRAM | Why Priority |
|-------|----------|--------------|
| video-editor | ≥8 GB | Core creative tool, cannot run on CPU |
| video-matte | ≥3 GB | Core creative tool, cannot run on CPU |
| frame-interpolator | ≥2 GB | Core creative tool, cannot run on CPU |

### Medium Priority (CPU fallback exists)
| Skill | CPU Capability | Notes |
|-------|-----------------|-------|
| bokeh-effect | Yes (slow) | Already supports `--device cpu` |
| background-remover | Yes | Already supports `--device cpu` |
| audio-splitter | Yes (3-5× realtime) | Already supports `--device cpu` |
| photo-picker | Yes | Already supports `--device cpu` |

## Provider Details

### Lambda Labs
- **Type:** True serverless GPU (per-second billing, no idle costs)
- **Pricing (2026):**
  - H100 (80GB): $2.49/hr
  - A100 (80GB): $1.50/hr
  - RTX 4090 (24GB): ~$0.60/hr
- **API:** Lambda Labs Inference API
- **Auth:** `LAMBDA_API_KEY` env var

## Implementation Structure

```
skills/
├── _providers/
│   ├── config.py          # Already exists, add LAMBDA_API_KEY
│   ├── huggingface.py     # Already exists
│   ├── replicate.py       # Already exists
│   └── lambdalabs.py      # NEW - Lambda Labs client
├── video-editor/
│   ├── config.json        # Add lambda settings
│   └── scripts/vace.py    # Add --provider lambda option
├── video-matte/
│   ├── config.json        # Add lambda settings
│   └── scripts/matte.py   # Add --provider lambda option
├── frame-interpolator/
│   ├── config.json        # Add lambda settings
│   └── scripts/interpolate.py
├── bokeh-effect/
├── background-remover/
├── audio-splitter/
└── photo-picker/
```

## Config Schema

For each skill, add to config.json:

```json
{
  "provider": "local",
  "lambda_api_key_env": "LAMBDA_API_KEY",
  "lambda_endpoint": "https://cloud.lambdalabs.com/api/v1/inference",
  "lambda_instance_type": "gpu_rtx4090",
  "remote_timeout_seconds": 600
}
```

### Lambda Instance Types

| Instance | VRAM | Price/hr | Best For |
|----------|------|----------|----------|
| `gpu_rtx4090` | 24GB | ~$0.60 | Smaller models (SD, U-Net, RAFT) |
| `gpu_a100_1` | 80GB | ~$1.50 | Larger models (Wan2.1, SDXL) |
| `gpu_h100_1` | 80GB | ~$2.49 | Highest performance |

## Implementation Steps

### Phase 1: Shared Infrastructure
1. Update `skills/_providers/config.py` — add `LAMBDA_API_KEY` to env vars
2. Create `skills/_providers/lambdalabs.py` — Lambda client class
3. Update `install-abra.sh` — add `LAMBDA_API_KEY` prompt/config

### Phase 2: High-Priority Skills
4. Update `video-editor` — add Lambda provider option
5. Update `video-matte` — add Lambda provider option
6. Update `frame-interpolator` — add Lambda provider option

### Phase 3: Medium-Priority Skills
7. Update `bokeh-effect` — add Lambda provider option
8. Update `background-remover` — add Lambda provider option
9. Update `audio-splitter` — add Lambda provider option
10. Update `photo-picker` — add Lambda provider option

### Phase 4: Documentation
11. Update `docs/remote-inference.md` — add Lambda Labs section
12. Update each skill's SKILL.md — document Lambda option

## Technical Considerations

### Container Images
Lambda Labs supports custom Docker images. For each skill:
1. Create a minimal Docker image with the skill's dependencies
2. Push to Lambda's container registry or Docker Hub
3. Reference in the Lambda call request

Alternatively, use Lambda's pre-built images where available.

### Cold Start
- Lambda cold start: ~10-30 seconds depending on instance
- Compare to Replicate (10-60s), RunPod (<200ms)
- Acceptable for batch processing, not for real-time

### API Pattern
```python
# Pseudocode
import lambda_gpu

response = lambda_gpu.run(
    image="your-skill-image:latest",
    instance_type="gpu_rtx4090",
    input_files={"input.mp4": open("input.mp4", "rb")},
    command="python scripts/process.py --input /inputs/input.mp4"
)
```

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `LAMBDA_API_KEY` | Lambda Labs authentication | Yes (for remote) |

## Install Script Updates

Add to `install-abra.sh`:

```bash
# In configure_skill_api_keys()
lambda_api_key="$(resolve_installer_env_value "LAMBDA_API_KEY")"
...
prompt_secret_value "LAMBDA_API_KEY (lambda labs GPU, optional)" "${lambda_api_key}"
...
set_config_env_value "LAMBDA_API_KEY" "${INSTALL_LAMBDA_API_KEY}"
```

## Testing

- Create test harness similar to existing remote inference tests
- Verify each skill works with `--provider lambda`
- Test error handling (missing credentials, timeouts)

## Wave 2 Limitations

- No provider auto-discovery
- No silent fallback to local mode
- No caching layer
- No multi-GPU support for large models
- Container image management is manual

## Timeline

- **Shared infrastructure:** 1-2 days
- **Per skill implementation:** ~0.5 day each
- **Testing:** 1-2 days total
- **Documentation:** 0.5 day

Total estimated: 5-7 days for all 7 skills