#!/usr/bin/env python3
"""fal.ai serverless handler for the frame-interpolator skill (clawrife)."""
import json
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import Any

import fal
from pydantic import BaseModel, Field

_SCRIPT = Path("/app/skills/frame-interpolator/scripts/interpolate.py")


class Input(BaseModel):
    input_urls: list[str] = Field(description="Input video URLs from fal CDN")
    params: dict[str, Any] = Field(default_factory=dict, description="Skill parameters")


class FileResult(BaseModel):
    url: str
    file_name: str


class Output(BaseModel):
    output_files: list[FileResult] = Field(description="Frame-interpolated output videos")


class FrameInterpolatorApp(fal.App, keep_alive=300):
    machine_type = "GPU"

    @fal.endpoint("/")
    def run(self, request: Input) -> Output:
        from fal.toolkit import File

        with tempfile.TemporaryDirectory(prefix="fal_frame_interpolator_") as tmp_str:
            tmp = Path(tmp_str)
            input_dir = tmp / "input"
            output_dir = tmp / "output"
            input_dir.mkdir()
            output_dir.mkdir()

            for url in request.input_urls:
                filename = url.split("?")[0].rsplit("/", 1)[-1]
                dest = input_dir / filename
                urllib.request.urlretrieve(url, dest)

            cfg = {**request.params, "input_dir": str(input_dir), "output_dir": str(output_dir)}
            cfg.pop("provider", None)
            cfg["device"] = "cuda"
            config_path = tmp / "config.json"
            config_path.write_text(json.dumps(cfg))

            result = subprocess.run(
                [sys.executable, str(_SCRIPT), "--config", str(config_path)],
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                raise RuntimeError(f"Processing failed: {result.stderr[-4000:]}")

            output_files = []
            for p in sorted(output_dir.iterdir()):
                if p.is_file():
                    fal_file = File.from_path(str(p))
                    output_files.append(FileResult(url=fal_file.url, file_name=p.name))

        return Output(output_files=output_files)
