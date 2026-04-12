#!/usr/bin/env python3
"""RunPod serverless handler for the background-remover skill (clawbg)."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import runpod

sys.path.insert(0, "/app")

from lib.runpod.b2_staging import B2StagingConfig, download_file, upload_files_from_dir

_SCRIPT = Path("/app/skills/background-remover/scripts/rembg_batch.py")


def handler(job: dict) -> dict:
    inp = job["input"]
    b2 = B2StagingConfig.from_env()

    with tempfile.TemporaryDirectory(prefix="runpod_background_remover_") as tmp_str:
        tmp = Path(tmp_str)
        input_dir = tmp / "input"
        output_dir = tmp / "output"
        input_dir.mkdir()
        output_dir.mkdir()

        for remote_name in inp["input_remote_names"]:
            filename = remote_name.split("/")[-1]
            download_file(remote_name, input_dir / filename, b2)

        cfg = {**inp.get("params", {}), "input_dir": str(input_dir), "output_dir": str(output_dir)}
        cfg.pop("provider", None)
        cfg["device"] = "cuda"  # always GPU on RunPod
        config_path = tmp / "config.json"
        config_path.write_text(json.dumps(cfg))

        result = subprocess.run(
            [sys.executable, str(_SCRIPT), "--config", str(config_path)],
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            return {"error": result.stderr[-4000:]}

        output_remote_names = upload_files_from_dir(output_dir, b2, prefix=inp["output_prefix"])

    return {"output_remote_names": output_remote_names}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
