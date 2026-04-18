# Docker Test Image Design

## Goal

Provide a clean, reproducible way to run the repository test suite with GPU
access and no host-side installation of Python, `uv`, ComfyUI, or skill
dependencies.

## Scope

The test image is separate from the main OpenClaw image. It does not inherit
from `alpine/openclaw` and does not install OpenClaw-specific runtime layers.
It is focused on the Python-based skill test suite under `tests/`.

## Image Layout

- Base image: NVIDIA CUDA Ubuntu runtime image so the container can run with
  `--gpus all`
- System packages: Python, build tools, FFmpeg, Git, Curl, and shared
  libraries needed by multimedia and model tooling
- Python package manager: `uv`
- ComfyUI installation in `/opt/ComfyUI`
- Custom nodes required by the LTX GGUF path:
  - `ComfyUI-LTXVideo`
  - `ComfyUI-KJNodes`
  - `ComfyUI-GGUF`
  - `ComfyUI-VideoHelperSuite`

## Environment Setup

The image copies the repository into `/workspace` and pre-runs `uv sync` for:
- `tests/`
- each skill referenced by the current test suite

This moves environment setup from test runtime into image build time, making
the test container reproducible and reducing startup variance.

## Test Execution

The image provides a small entrypoint script that:
1. optionally prefetches test models with `tests/utils/download_models.py`
2. runs `pytest`

Model prefetch is enabled by default so a clean container can execute the
suite without extra manual setup. It can be disabled with
`SKIP_MODEL_PREFETCH=1` when a faster run is needed and the cache is already
present.

## GPU Contract

The container must still be launched with NVIDIA runtime support, for example
with `docker run --gpus all ...`. The Dockerfile sets NVIDIA visibility and
driver capability environment variables, but actual GPU access still depends on
the host Docker/NVIDIA setup.
