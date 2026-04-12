from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path
from typing import Any

from .config import RemoteProviderConfig, require_provider_api_key

# Ensure repo root is on sys.path so lib.runpod is importable
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

_PROVIDER_CONFIG_KEYS = frozenset({
    "provider",
    "hf_token_env",
    "replicate_api_key_env",
    "runpod_api_key_env",
    "runpod_endpoint_id_env",
    "remote_model",
    "remote_timeout_seconds",
})


class RunpodProvider:
    def __init__(self, remote: RemoteProviderConfig):
        if remote.provider != "runpod":
            raise ValueError("runpod provider config is required")
        self._remote = remote
        self._api_key = require_provider_api_key(remote)
        self._endpoint_id = _resolve_endpoint_id(remote)

    def run_skill(
        self,
        input_dir: Path,
        output_dir: Path,
        params: dict[str, Any],
    ) -> list[Path]:
        """
        Stage inputs to B2, submit a RunPod job, poll until done,
        download outputs to output_dir. Returns list of downloaded output paths.
        """
        from lib.runpod.client import RunpodClient
        from lib.runpod.b2_staging import (
            B2StagingConfig,
            upload_file,
            upload_files_from_dir,
            download_file,
        )

        b2 = B2StagingConfig.from_env()
        job_prefix = f"runpod/{uuid.uuid4().hex}"

        input_files = sorted(p for p in input_dir.iterdir() if p.is_file())
        if not input_files:
            raise ValueError(f"No input files found in {input_dir}")

        input_remote_names = [
            upload_file(p, b2, prefix=f"{job_prefix}/input")
            for p in input_files
        ]

        # Strip provider-related keys so the handler runs locally
        clean_params = {k: v for k, v in params.items() if k not in _PROVIDER_CONFIG_KEYS}

        client = RunpodClient(
            api_key=self._api_key,
            endpoint_id=self._endpoint_id,
            timeout_seconds=self._remote.remote_timeout_seconds,
        )
        job_id = client.submit({
            "input_remote_names": input_remote_names,
            "output_prefix": f"{job_prefix}/output",
            "params": clean_params,
        })

        result = client.poll(job_id)

        output_dir.mkdir(parents=True, exist_ok=True)
        output_paths: list[Path] = []
        for remote_name in result.get("output_remote_names", []):
            filename = remote_name.split("/")[-1]
            dest = output_dir / filename
            download_file(remote_name, dest, b2)
            output_paths.append(dest)

        return output_paths


def _resolve_endpoint_id(remote: RemoteProviderConfig) -> str:
    if not remote.runpod_endpoint_id_env:
        raise ValueError(
            "runpod_endpoint_id_env must be set in the skill config to use the runpod provider"
        )
    endpoint_id = os.environ.get(remote.runpod_endpoint_id_env, "").strip()
    if not endpoint_id:
        raise ValueError(
            f"missing required environment variable '{remote.runpod_endpoint_id_env}' "
            f"for RunPod endpoint ID"
        )
    return endpoint_id
