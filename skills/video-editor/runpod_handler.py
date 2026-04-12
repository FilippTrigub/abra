#!/usr/bin/env python3
"""
RunPod serverless handler for the video-editor skill (clawvace).

Expects job input:
  input_remote_names: list[str]   — B2 file names to download as input
  output_prefix: str              — B2 prefix for uploading results
  params: dict                    — skill config overrides (no provider keys)

Returns:
  output_remote_names: list[str]  — B2 file names of produced outputs
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import runpod

sys.path.insert(0, "/app")

from lib.runpod.b2_staging import B2StagingConfig, download_file, upload_files_from_dir

_SCRIPT = Path("/app/skills/video-editor/scripts/vace.py")


def handler(job: dict) -> dict:
    inp = job["input"]
    input_remote_names: list[str] = inp["input_remote_names"]
    output_prefix: str = inp["output_prefix"]
    params: dict = inp.get("params", {})

    b2 = B2StagingConfig.from_env()

    with tempfile.TemporaryDirectory(prefix="runpod_video_editor_") as tmp_str:
        tmp = Path(tmp_str)
        input_dir = tmp / "input"
        output_dir = tmp / "output"
        input_dir.mkdir()
        output_dir.mkdir()

        for remote_name in input_remote_names:
            filename = remote_name.split("/")[-1]
            download_file(remote_name, input_dir / filename, b2)

        cfg = {
            **params,
            "input_dir": str(input_dir),
            "output_dir": str(output_dir),
        }
        cfg.pop("provider", None)

        config_path = tmp / "config.json"
        config_path.write_text(json.dumps(cfg))

        result = subprocess.run(
            [sys.executable, str(_SCRIPT), "--config", str(config_path)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return {"error": result.stderr[-4000:]}

        output_remote_names = upload_files_from_dir(output_dir, b2, prefix=output_prefix)

    return {"output_remote_names": output_remote_names}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
