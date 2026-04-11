from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from .config import RemoteProviderConfig, require_provider_api_key

_PROVIDER_CONFIG_KEYS = frozenset({
    "provider",
    "hf_token_env",
    "replicate_api_key_env",
    "runpod_api_key_env",
    "runpod_endpoint_id_env",
    "fal_api_key_env",
    "fal_app_id_env",
    "remote_model",
    "remote_timeout_seconds",
})


class FalProvider:
    def __init__(self, remote: RemoteProviderConfig):
        if remote.provider != "fal":
            raise ValueError("fal provider config is required")
        self._remote = remote
        self._api_key = require_provider_api_key(remote)
        self._app_id = _resolve_app_id(remote)

    def run_skill(
        self,
        input_dir: Path,
        output_dir: Path,
        params: dict[str, Any],
    ) -> list[Path]:
        """
        Upload input files to fal CDN, submit job to fal endpoint,
        wait for completion, download outputs. Returns list of output paths.
        """
        import fal_client

        client = fal_client.SyncClient(key=self._api_key)

        input_files = sorted(p for p in input_dir.iterdir() if p.is_file())
        if not input_files:
            raise ValueError(f"No input files found in {input_dir}")

        input_urls = [client.upload_file(str(p)) for p in input_files]

        clean_params = {k: v for k, v in params.items() if k not in _PROVIDER_CONFIG_KEYS}

        handle = client.submit(
            self._app_id,
            arguments={
                "input_urls": input_urls,
                "params": clean_params,
            },
        )

        result = handle.get()

        output_dir.mkdir(parents=True, exist_ok=True)
        output_paths: list[Path] = []
        for file_obj in result.get("output_files", []):
            url: str = file_obj["url"] if isinstance(file_obj, dict) else file_obj.url
            filename = url.split("?")[0].rsplit("/", 1)[-1]
            dest = output_dir / filename
            _download_url(url, dest)
            output_paths.append(dest)

        return output_paths


def _resolve_app_id(remote: RemoteProviderConfig) -> str:
    if not remote.fal_app_id_env:
        raise ValueError(
            "fal_app_id_env must be set in the skill config to use the fal provider"
        )
    app_id = os.environ.get(remote.fal_app_id_env, "").strip()
    if not app_id:
        raise ValueError(
            f"missing required environment variable '{remote.fal_app_id_env}' "
            f"for fal app ID"
        )
    return app_id


def _download_url(url: str, dest: Path) -> None:
    import urllib.request
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
