# Image-to-Video Dual Backend Design

## Goal

Extend the `image-to-video` skill so it can run either:
- the existing `diffusers`-based `Lightricks/LTX-Video` pipeline
- a headless `ComfyUI` pipeline for `LTX-2.3` GGUF models

The same script remains the public entrypoint. Backend selection can be
explicit or inferred from the selected model. GGUF downloads are managed by
the skill at runtime so the container does not grow without bound when users
switch models.

## Architecture

The skill keeps `scripts/img2vid.py` as the orchestrator. It validates config,
resolves the backend, and dispatches to one of two adapters:
- `DiffusersBackend` for the existing local Python pipeline
- `ComfyUIBackend` for headless workflow submission

The `ComfyUIBackend` owns:
- model download and cache metadata
- runtime discovery / startup for headless ComfyUI
- workflow loading and placeholder substitution
- output collection and copy-back into the skill output directory

## Model Management

The ComfyUI path uses a skill-owned cache under `skills/image-to-video/.cache`.
When a user requests a new model, the script:
1. checks whether the requested model is already active
2. if not, removes the previous skill-managed model artifacts
3. downloads the new GGUF file and any declared auxiliary assets
4. records the active model in `active-model.json`

This cleanup is scoped to the skill cache and does not touch unrelated
Hugging Face or ComfyUI caches.

## Runtime Contract

The Docker image installs ComfyUI plus the `ComfyUI-LTXVideo` and
`ComfyUI-GGUF` custom node repositories. The skill assumes that runtime exists
at `/opt/ComfyUI` unless overridden.

The ComfyUI backend is headless. It either connects to an already running API
endpoint or starts a local ComfyUI process and submits an exported API
workflow. The default workflow file included in the skill is only a placeholder
to document the required placeholders; a real exported API workflow must be
provided for actual LTX-2.3 runs.

## Testing

Coverage focuses on logic that can be verified offline:
- backend inference
- cache hit behavior
- cache replacement when the model changes

Full inference remains integration-level and depends on GPU, ComfyUI, and
weights being available.
