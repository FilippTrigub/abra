"""Modal deployment for Abra's optional GPU media skills.

Deploy with: modal deploy modal_apps/abra_media.py
Create a Modal Secret named ``abra-remote-b2`` containing the generic
BACKBLAZE_B2_REMOTE_* credentials before deployment.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import modal

app = modal.App("abra-media")
B2_SECRET = modal.Secret.from_name("abra-remote-b2")


def _image(skill: str) -> modal.Image:
    # Reuse the maintained RunPod images: they already contain CUDA, the skill,
    # B2 helpers, and the corresponding model dependencies.
    return modal.Image.from_registry(f"filipptri/abra-{skill}:latest").env({
        "HF_HOME": "/modal-volume/huggingface",
        "TORCH_HOME": "/modal-volume/torch",
        "U2NET_HOME": "/modal-volume/u2net",
        "DEMUCS_HOME": "/modal-volume/demucs",
    })


def _volume(skill: str) -> modal.Volume:
    return modal.Volume.from_name(f"abra-{skill}-models", create_if_missing=True)


def _run(job: dict[str, Any], script: str) -> dict[str, Any]:
    from lib.runpod.b2_staging import B2StagingConfig, download_file, upload_files_from_dir

    b2 = B2StagingConfig.from_env()
    with tempfile.TemporaryDirectory(prefix="abra_modal_") as temp_dir:
        root = Path(temp_dir)
        input_dir, output_dir = root / "input", root / "output"
        input_dir.mkdir()
        output_dir.mkdir()
        for remote_name in job["input_remote_names"]:
            download_file(remote_name, input_dir / remote_name.split("/")[-1], b2)
        config = {**job.get("params", {}), "input_dir": str(input_dir), "output_dir": str(output_dir), "device": "cuda"}
        config.pop("provider", None)
        config_path = root / "config.json"
        config_path.write_text(json.dumps(config))
        result = subprocess.run([sys.executable, script, "--config", str(config_path)], capture_output=True, text=True)
        if result.returncode:
            return {"error": result.stderr[-4000:] or result.stdout[-4000:]}
        return {"output_remote_names": upload_files_from_dir(output_dir, b2, prefix=job["output_prefix"])}


@app.function(image=_image("background-remover"), gpu=["L4", "T4"], timeout=600, max_containers=1, secrets=[B2_SECRET], volumes={"/modal-volume": _volume("background-remover")})
def background_remover(job: dict[str, Any]) -> dict[str, Any]:
    return _run(job, "/app/skills/background-remover/scripts/rembg_batch.py")


@app.function(image=_image("bokeh-effect"), gpu=["L4", "T4"], timeout=600, max_containers=1, secrets=[B2_SECRET], volumes={"/modal-volume": _volume("bokeh-effect")})
def bokeh_effect(job: dict[str, Any]) -> dict[str, Any]:
    return _run(job, "/app/skills/bokeh-effect/scripts/bokeh.py")


@app.function(image=_image("audio-splitter"), gpu=["L4", "T4"], timeout=600, max_containers=1, secrets=[B2_SECRET], volumes={"/modal-volume": _volume("audio-splitter")})
def audio_splitter(job: dict[str, Any]) -> dict[str, Any]:
    return _run(job, "/app/skills/audio-splitter/scripts/separate.py")


@app.function(image=_image("frame-interpolator"), gpu=["L40S", "A10"], timeout=900, max_containers=1, secrets=[B2_SECRET], volumes={"/modal-volume": _volume("frame-interpolator")})
def frame_interpolator(job: dict[str, Any]) -> dict[str, Any]:
    return _run(job, "/app/skills/frame-interpolator/scripts/interpolate.py")


@app.function(image=_image("photo-picker"), gpu=["L4", "T4"], timeout=600, max_containers=1, secrets=[B2_SECRET], volumes={"/modal-volume": _volume("photo-picker")})
def photo_picker(job: dict[str, Any]) -> dict[str, Any]:
    return _run(job, "/app/skills/photo-picker/scripts/score.py")


@app.function(image=_image("video-matte"), gpu=["L40S", "A10"], timeout=900, max_containers=1, secrets=[B2_SECRET], volumes={"/modal-volume": _volume("video-matte")})
def video_matte(job: dict[str, Any]) -> dict[str, Any]:
    return _run(job, "/app/skills/video-matte/scripts/matte.py")


@app.function(image=_image("video-editor"), gpu=["A100-80GB", "H100"], timeout=900, max_containers=1, secrets=[B2_SECRET], volumes={"/modal-volume": _volume("video-editor")})
def video_editor(job: dict[str, Any]) -> dict[str, Any]:
    return _run(job, "/app/skills/video-editor/scripts/vace.py")
