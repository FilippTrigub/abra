# RunPod Serverless GPU Inference Implementation Plan

## Overview

Add RunPod Serverless as a remote GPU inference provider for all GPU-dependent skills.
Users without a local GPU run GPU-heavy skills by pointing them at a pre-deployed
RunPod endpoint. Local mode remains the unchanged default; remote is opt-in.

## Principles

- Local mode is the default (unchanged)
- Remote is **opt-in** via `"provider": "runpod"` in config
- Missing credentials fail fast — no silent fallback
- Follows the same provider pattern as existing `huggingface.py` / `replicate.py`

---

## How RunPod Serverless Works

1. A Docker image containing the skill's dependencies and a `runpod_handler.py` is
   built and pushed to Docker Hub.
2. The image is deployed to a RunPod Serverless endpoint once (via RunPod dashboard).
   RunPod assigns an **endpoint ID**.
3. The local client POSTs a JSON job to
   `https://api.runpod.ai/v2/{endpoint_id}/run` and polls `/status/{job_id}` until done.
4. The handler on the RunPod worker downloads input from B2, calls the skill CLI as a
   subprocess, uploads the output back to B2, and returns the output URL.

**Payload limit:** 10 MB for `/run`. Video and audio files are never inlined —
they are always staged through Backblaze B2.

---

## Target Skills

### High Priority (no CPU fallback)
| Skill | Min VRAM | Script |
|-------|----------|--------|
| `video-editor` | 8 GB | `scripts/vace.py` |
| `video-matte` | 3 GB | `scripts/matte.py` |
| `frame-interpolator` | 2 GB | `scripts/interpolate.py` |

### Medium Priority (CPU fallback exists)
| Skill | Script |
|-------|--------|
| `bokeh-effect` | `scripts/bokeh.py` |
| `background-remover` | `scripts/remove_bg.py` |
| `audio-splitter` | `scripts/split.py` |
| `photo-picker` | `scripts/pick.py` |

---

## File Transfer Strategy

RunPod workers cannot accept or return large binaries inline. All file I/O is
staged through a dedicated Backblaze B2 bucket.

```
Local machine              Backblaze B2 (staging)     RunPod worker
─────────────              ──────────────────────     ─────────────
upload input  ──────────►  runpod-staging bucket  ──► download input
                                                       run skill CLI
                           ◄──────────────────────    upload output
download output ◄─────────  pre-signed URL
```

**Storage backend:** Backblaze B2 — dedicated `runpod-staging` bucket (separate
from the post-scheduler bucket). Credentials live in a new env file:
`~/.openclaw/runpod-b2-staging.env`, provisioned by `install-abra.sh`.

**Bucket creation:** use the B2 CLI (one-time, manual):
```bash
b2 create-bucket runpod-staging allPrivate
```

Files are uploaded with a short TTL key and a unique job-scoped prefix
(`{job_id}/input.*`, `{job_id}/output.*`). Cleanup is manual or via B2 lifecycle rules.

---

## Model Weights Strategy

Model weights are stored on a **RunPod Network Volume** and mounted into each
worker at startup. This avoids bloating Docker images (Wan2.1 alone is ~10 GB)
and eliminates per-job download latency after first use.

**Cost:** $0.07/GB/month (standard), charged continuously regardless of whether
a worker is running. Estimated total for all 7 skills: ~30–50 GB → ~$2–4/month.

**Lifecycle:** Network Volumes persist until manually deleted on the RunPod
dashboard. There is no automatic expiry. One shared volume per datacenter region
is sufficient if all endpoints are deployed to the same region.

**Setup (one-time, manual):**
1. Create a Network Volume on RunPod dashboard (size: 100 GB to accommodate all skills)
2. Attach it to a temporary pod, download all model weights into it
3. Detach and reference the volume ID when deploying each Serverless endpoint

The volume mount path (e.g. `/runpod-volume/models`) is passed to each handler
via an env var baked into the Docker image or set at endpoint deployment time.

---

## Code Architecture

Skill scripts remain **CLI entry points** (unchanged contract with the Abra agent).
The RunPod integration layer lives in `lib/runpod/` as a shared Python package,
used by both:
- The **local client** (submits jobs, stages files) called from within `skills/_providers/runpod.py`
- The **handler base** (runs inside Docker on RunPod, downloads input, calls CLI, uploads output)

```
lib/
└── runpod/                        # NEW — shared Python package
    ├── __init__.py
    ├── client.py                  # RunpodClient: submit job, poll status
    └── b2_staging.py              # upload_file(), download_file(), presigned_url()

skills/
├── _providers/
│   ├── config.py                  # Add RUNPOD_API_KEY + runpod_* fields
│   ├── runpod.py                  # NEW — thin provider using lib/runpod/client.py
│   ├── huggingface.py             # unchanged
│   └── replicate.py              # unchanged
├── video-editor/
│   ├── config.json                # Add runpod_endpoint_id_env, runpod_gpu_type
│   ├── scripts/vace.py            # unchanged CLI
│   └── runpod_handler.py          # NEW — downloads input, calls vace.py, uploads output
├── video-matte/  …               # same pattern
├── frame-interpolator/  …
├── bokeh-effect/  …
├── background-remover/  …
├── audio-splitter/  …
└── photo-picker/  …

docker/
├── video-editor/Dockerfile        # NEW — one per skill
├── video-matte/Dockerfile
├── frame-interpolator/Dockerfile
├── bokeh-effect/Dockerfile
├── background-remover/Dockerfile
├── audio-splitter/Dockerfile
└── photo-picker/Dockerfile
```

---

## Config Schema

Add to each skill's `config.json`:

```json
{
  "provider": "local",
  "runpod_api_key_env": "RUNPOD_API_KEY",
  "runpod_endpoint_id_env": "RUNPOD_ENDPOINT_ID_VIDEO_EDITOR",
  "runpod_gpu_type": "NVIDIA A100 80GB",
  "remote_timeout_seconds": 600
}
```

`runpod_endpoint_id_env` is the name of the environment variable that holds
the endpoint ID (not the ID itself), consistent with how other API keys are handled.

### Recommended GPU Types per Skill

| Skill | Recommended GPU | VRAM |
|-------|----------------|------|
| `video-editor` | A100 SXM 80 GB | 80 GB |
| `video-matte` | RTX 4090 | 24 GB |
| `frame-interpolator` | RTX 4090 | 24 GB |
| `bokeh-effect` | RTX 4090 | 24 GB |
| `background-remover` | RTX 3090 | 24 GB |
| `audio-splitter` | RTX 3090 | 24 GB |
| `photo-picker` | RTX 3090 | 24 GB |

---

## Environment Variables

| Variable | Purpose | Stored in |
|----------|---------|-----------|
| `RUNPOD_API_KEY` | RunPod authentication | `openclaw.json env` |
| `RUNPOD_ENDPOINT_ID_VIDEO_EDITOR` | Endpoint for video-editor | `openclaw.json env` |
| `RUNPOD_ENDPOINT_ID_VIDEO_MATTE` | Endpoint for video-matte | `openclaw.json env` |
| `RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR` | Endpoint for frame-interpolator | `openclaw.json env` |
| `RUNPOD_ENDPOINT_ID_BOKEH_EFFECT` | Endpoint for bokeh-effect | `openclaw.json env` |
| `RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER` | Endpoint for background-remover | `openclaw.json env` |
| `RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER` | Endpoint for audio-splitter | `openclaw.json env` |
| `RUNPOD_ENDPOINT_ID_PHOTO_PICKER` | Endpoint for photo-picker | `openclaw.json env` |
| `BACKBLAZE_B2_RUNPOD_KEY_ID` | B2 staging bucket key ID | `runpod-b2-staging.env` |
| `BACKBLAZE_B2_RUNPOD_APPLICATION_KEY` | B2 staging bucket app key | `runpod-b2-staging.env` |
| `BACKBLAZE_B2_RUNPOD_BUCKET_NAME` | B2 staging bucket name | `runpod-b2-staging.env` |
| `RUNPOD_MODELS_PATH` | Mount path of the Network Volume | baked into Docker image |

---

## Key Code Patterns

### `lib/runpod/client.py`

```python
@dataclass(frozen=True)
class RunpodClient:
    api_key: str
    endpoint_id: str
    timeout_seconds: int = 600

    def submit(self, payload: dict) -> str:
        """POST to /run, return job_id."""
        ...

    def poll(self, job_id: str) -> dict:
        """Poll /status/{job_id} until COMPLETED or FAILED. Return output."""
        ...
```

### `lib/runpod/b2_staging.py`

```python
def upload_file(local_path: Path, *, key_id: str, app_key: str, bucket: str, prefix: str) -> str:
    """Upload file, return download URL."""
    ...

def download_file(url: str, dest: Path) -> None:
    """Download from pre-signed URL to local path."""
    ...
```

### `skills/_providers/runpod.py`

```python
class RunpodProvider:
    def __init__(self, remote: RemoteProviderConfig):
        self._client = RunpodClient(api_key=..., endpoint_id=..., timeout_seconds=...)
        self._b2 = B2StagingConfig.from_env()

    def run_skill(self, input_path: Path, params: dict) -> Path:
        """Stage input, submit job, poll, download output, return local path."""
        ...
```

### Per-skill `runpod_handler.py` pattern

```python
import runpod
import subprocess
from lib.runpod.b2_staging import download_file, upload_file

def handler(job):
    inp = job["input"]
    input_path = download_file(inp["input_url"], dest=Path("/tmp/input"))
    result = subprocess.run(
        ["python", "scripts/vace.py",
         "--input", str(input_path),
         "--output", "/tmp/output",
         "--prompt", inp["params"]["prompt"]],
        capture_output=True, check=True
    )
    output_url = upload_file(Path("/tmp/output"), ...)
    return {"output_url": output_url}

runpod.serverless.start({"handler": handler})
```

### Dockerfile pattern

```dockerfile
FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app
COPY lib/runpod/ ./lib/runpod/
COPY skills/video-editor/ ./skills/video-editor/
RUN pip install -r skills/video-editor/requirements.txt runpod b2sdk

ENV RUNPOD_MODELS_PATH=/runpod-volume/models
CMD ["python", "skills/video-editor/runpod_handler.py"]
```

**Image naming:** `filipptri/abra-{skill}:latest`
e.g. `filipptri/abra-video-editor:latest`, `filipptri/abra-video-matte:latest`

---

## install-abra.sh Changes

Add to `configure_skill_api_keys()`:
```bash
runpod_api_key="$(resolve_installer_env_value "RUNPOD_API_KEY")"
runpod_endpoint_id_video_editor="$(resolve_installer_env_value "RUNPOD_ENDPOINT_ID_VIDEO_EDITOR")"
# ... one per skill ...

runpod_api_key="$(prompt_secret_value "RUNPOD_API_KEY (runpod GPU inference, optional)" "${runpod_api_key}")"
runpod_endpoint_id_video_editor="$(prompt_secret_value "RUNPOD_ENDPOINT_ID_VIDEO_EDITOR (optional)" ...)"
# ...

INSTALL_RUNPOD_API_KEY="${runpod_api_key}"
# ...
```

Add a new `configure_runpod_b2_staging_env()` function mirroring the existing
`configure_post_scheduler_env()` pattern, writing to
`~/.openclaw/runpod-b2-staging.env`.

---

## Implementation Phases

### Phase 1 — Shared Infrastructure
1. Create `lib/runpod/__init__.py`, `lib/runpod/client.py`, `lib/runpod/b2_staging.py`
2. Add `runpod` to `VALID_REMOTE_PROVIDERS` in `skills/_providers/config.py`; add
   `runpod_api_key_env` and `runpod_endpoint_id_env` to `RemoteProviderConfig`
3. Create `skills/_providers/runpod.py` using `lib/runpod/client.py`
4. Update `install-abra.sh` — add `RUNPOD_API_KEY`, per-skill endpoint ID prompts,
   and `configure_runpod_b2_staging_env()`

### Phase 2 — High-Priority Skills
5. `video-editor` — `runpod_handler.py`, `docker/video-editor/Dockerfile`, `config.json`
6. `video-matte` — same
7. `frame-interpolator` — same

### Phase 3 — Medium-Priority Skills
8–11. `bokeh-effect`, `background-remover`, `audio-splitter`, `photo-picker` — same pattern

### Phase 4 — Ops (manual, outside codebase)
12. Create RunPod Network Volume (100 GB, standard) in region **EU-RO-1**; populate model weights
13. Build and push Docker images to Docker Hub under `filipptri/abra-{skill}:latest`
14. Deploy 7 Serverless endpoints on RunPod dashboard in **EU-RO-1**, each referencing the shared volume
15. Set endpoint ID env vars via `install-abra.sh` or directly in `openclaw.json`

### Phase 5 — Testing & Docs
16. Add `FakeRunpodProvider` to `tests/utils/remote_inference_mocks.py`
17. Add RunPod test cases to `tests/test_remote_inference_harness.py`
18. Update `docs/remote-inference.md`

---

## Resolved Decisions

| Decision | Choice |
|----------|--------|
| Docker Hub namespace | `filipptri/abra-{skill}:latest` |
| Network Volume | 1 shared volume, 100 GB standard |
| Datacenter region | **EU-RO-1** (Romania — closest EU region to Paris) |
| Job submission | `/run` + polling loop |
| File staging | Backblaze B2, dedicated `runpod-staging` bucket |
| Shared code location | `lib/runpod/` Python package |
