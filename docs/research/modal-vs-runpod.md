# Modal as the remote GPU provider

**Recommendation: yes.** Use Modal as the preferred successor to RunPod Serverless for the seven existing remote GPU skills, but deploy it alongside RunPod first. Modal reduces the present capacity risk through ordered GPU fallback lists; it cannot guarantee instant allocation, so retain timeouts, retries, polling, and observability.

## Repository scope

Exactly seven skills implement `provider: "runpod"`: `video-editor`, `video-matte`, `frame-interpolator`, `bokeh-effect`, `background-remover`, `audio-splitter`, and `photo-picker`. Each has a `runpod_handler.py`, endpoint configuration, and Docker image. The first three have no practical CPU path, making them the highest-value migration targets.

This does not include other GPU-capable skills: `audio-transcriber`, `image-captioner`, `image-generator`, `media-analyzer`, and `music-generator` use local/Hugging Face/Replicate paths; `animate-image` and `video-generator` use other cloud APIs. CPU-only media skills are unaffected.

## Why Modal fits

Modal supports T4, L4, A10, L40S, A100 (40/80 GB), RTX Pro 6000, H100/H200, and newer GPUs. A function can supply a preferred ordered GPU list, and Modal tries each option in order. This is a direct mitigation for the current RunPod endpoints being restricted to fluctuating GPU stock in one region; it is not a capacity guarantee. [Modal GPU acceleration](https://modal.com/docs/guide/gpu)

Suggested benchmark starting points: `A100-80GB` for `video-editor`; `L40S` then `A10` for `video-matte` and `frame-interpolator`; `L4` then `T4` for the four light skills. These are compatibility/performance hypotheses, not committed defaults. Modal recommends the 48-GB L40S as a general inference starting point. [Modal GPU acceleration](https://modal.com/docs/guide/gpu)

## Migration shape

This is not a configuration-only swap. Keep every skill's local CLI and `input/`/`output/` contract, but replace the shared `skills/_providers/runpod.py` client and each `runpod_handler.py` with a Modal Python app/function. Modal Images can build from code or existing container images, so the current Docker hierarchy is a practical starting point. [Modal Images](https://modal.com/docs/guide/images)

Retain Backblaze B2 staging initially: upload inputs, invoke an asynchronous remote job, download outputs. That preserves the existing artifact contract and avoids sending videos/audio inline; Modal has a 100-MB invocation payload limit. The Modal function should download B2 files to ephemeral disk, invoke the existing CLI with CUDA, upload results, and return artifact names.

Use a Modal Volume for model caches (`HF_HOME`, `TORCH_HOME`, `U2NET_HOME`, `DEMUCS_HOME`), preferably read-only during inference after warm-up. Volumes are intended for write-once/read-many ML weights. They have commit/reload semantics, so they must not be an uncoordinated shared output directory. [Modal Volumes](https://modal.com/docs/guide/volumes)

Affected code/config surfaces besides the seven skills: `skills/_providers/config.py`; `lib/runpod/`; `docker/base/Dockerfile` and seven Dockerfiles; both installer scripts; `platform/src/lib/runtime-env/definitions.ts`; remote-inference/RunPod docs; and RunPod e2e tests. `CLOUD.md` says the Azure `runpod-staging` container was decommissioned, so existing B2 staging remains the relevant artifact dependency.

## Operational guardrails

- Set a per-skill timeout above the existing 300/600 seconds. Modal's default is five minutes and functions can be configured from one second to 24 hours; scheduling time is excluded. [Timeouts](https://modal.com/docs/guide/timeouts)
- Use retries only for idempotent B2 job prefixes. Modal independently retries failed mapped inputs and reschedules crashed containers. [Retries](https://modal.com/docs/guide/retries)
- Do not use Modal Queue as the source of truth for long-lived jobs: its persistence is not guaranteed and messages are cleared after 24 hours without writes. Preserve polling or add a durable platform job record. [Queues](https://modal.com/docs/guide/queues)
- Cold-start latency remains. Cache weights, load models in an enter hook, and enable `min_containers`/`buffer_containers` only where latency justifies billed idle capacity. [Cold starts](https://modal.com/docs/guide/cold-start)
- Do not synchronously hold dashboard HTTP requests for video jobs: Modal web endpoints time out after 150 seconds. Use background invocation and status polling. [Webhook timeouts](https://modal.com/docs/guide/webhook-timeouts)

Modal bills GPU, CPU, memory, and storage by use; compare the live rate card before committing. [Modal pricing](https://modal.com/pricing)

## Rollout

1. Pilot `background-remover`, retaining B2, to validate deployment, cold start, output fidelity, fallback allocation, retries, and cost.
2. Move the other five light/medium skills with shared model-cache volumes where useful.
3. Port `video-editor` last and independently benchmark `A100-80GB`.
4. Add `modal` alongside `runpod`; set it as default only after queue-to-completion, failures, and cost meet targets. Remove RunPod only after the fallback period.

## Sources and repository evidence

- [Modal GPU acceleration](https://modal.com/docs/guide/gpu), [Images](https://modal.com/docs/guide/images), [Volumes](https://modal.com/docs/guide/volumes), [Cold starts](https://modal.com/docs/guide/cold-start), [Timeouts](https://modal.com/docs/guide/timeouts), [Retries](https://modal.com/docs/guide/retries), [Queues](https://modal.com/docs/guide/queues), [Webhook timeouts](https://modal.com/docs/guide/webhook-timeouts), and [Pricing](https://modal.com/pricing).
- Repository: `PRODUCT.md`, `CLOUD.md`, `SKILLS.md`, `docs/remote-inference.md`, `docs/runpod-deployment.md`, shared RunPod provider code, the seven configurations/handlers above, and internal notes consulted 2026-08-01: `/home/filipp/Repos/HQ1/Obsidian/HQ1/notes/Tech/Modal.md` and `RunPod.md`.
