from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path
from typing import Any

from .config import RemoteProviderConfig

_PROVIDERS_ROOT = Path(__file__).resolve().parent.parent
if str(_PROVIDERS_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROVIDERS_ROOT))

_PROVIDER_CONFIG_KEYS = frozenset({
    "provider", "hf_token_env", "replicate_api_key_env", "runpod_api_key_env",
    "runpod_endpoint_id_env", "modal_token_id_env", "modal_token_secret_env",
    "modal_app_name", "modal_function_name", "remote_model", "remote_timeout_seconds",
})


class ModalProvider:
    """Run an Abra GPU skill in a deployed Modal Function.

    Inputs and outputs stay in B2 so media is never sent as an invocation payload.
    """

    def __init__(self, remote: RemoteProviderConfig):
        if remote.provider != "modal":
            raise ValueError("modal provider config is required")
        self._remote = remote
        self._require_credentials()
        if not remote.modal_function_name:
            raise ValueError("modal_function_name must be set to use the modal provider")

    def run_skill(self, input_dir: Path, output_dir: Path, params: dict[str, Any]) -> list[Path]:
        try:
            import modal
        except ImportError as exc:
            raise ImportError("modal is required for Modal remote inference: pip install modal") from exc

        from lib.runpod.b2_staging import B2StagingConfig, download_file, upload_file

        b2 = B2StagingConfig.from_env()
        prefix = f"modal/{uuid.uuid4().hex}"
        input_files = sorted(path for path in input_dir.iterdir() if path.is_file())
        if not input_files:
            raise ValueError(f"No input files found in {input_dir}")
        input_remote_names = [upload_file(path, b2, prefix=f"{prefix}/input") for path in input_files]
        clean_params = {key: value for key, value in params.items() if key not in _PROVIDER_CONFIG_KEYS}
        function = modal.Function.from_name(self._remote.modal_app_name, self._remote.modal_function_name)
        result = function.remote({
            "input_remote_names": input_remote_names,
            "output_prefix": f"{prefix}/output",
            "params": clean_params,
        })
        if not isinstance(result, dict):
            raise RuntimeError(f"Modal function returned an invalid result: {result!r}")
        if result.get("error"):
            raise RuntimeError(f"Modal function error: {result['error']}")

        output_dir.mkdir(parents=True, exist_ok=True)
        output_paths: list[Path] = []
        for remote_name in result.get("output_remote_names", []):
            destination = output_dir / remote_name.split("/")[-1]
            download_file(remote_name, destination, b2)
            output_paths.append(destination)
        return output_paths

    def _require_credentials(self) -> None:
        missing = [
            env_name for env_name in (
                self._remote.modal_token_id_env,
                self._remote.modal_token_secret_env,
            ) if not os.environ.get(env_name, "").strip()
        ]
        if missing:
            raise ValueError("Missing required Modal environment variables: " + ", ".join(missing))
