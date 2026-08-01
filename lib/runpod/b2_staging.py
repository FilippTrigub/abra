from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

_ENV_ALIASES = {
    "key_id": ("BACKBLAZE_B2_REMOTE_KEY_ID", "BACKBLAZE_B2_RUNPOD_KEY_ID"),
    "app_key": ("BACKBLAZE_B2_REMOTE_APPLICATION_KEY", "BACKBLAZE_B2_RUNPOD_APPLICATION_KEY"),
    "bucket_name": ("BACKBLAZE_B2_REMOTE_BUCKET_NAME", "BACKBLAZE_B2_RUNPOD_BUCKET_NAME"),
}


@dataclass(frozen=True)
class B2StagingConfig:
    key_id: str
    app_key: str
    bucket_name: str

    @classmethod
    def from_env(cls) -> B2StagingConfig:
        values = {
            name: next((os.environ[key].strip() for key in keys if os.environ.get(key, "").strip()), "")
            for name, keys in _ENV_ALIASES.items()
        }
        missing = [keys[0] for name, keys in _ENV_ALIASES.items() if not values[name]]
        if missing:
            raise ValueError(
                f"Missing required B2 staging environment variables: {', '.join(missing)}"
            )
        return cls(
            **values,
        )

    def _api(self):
        try:
            import b2sdk.v2 as b2
        except ImportError as exc:
            raise ImportError(
                "b2sdk is required for RunPod B2 staging: pip install b2sdk"
            ) from exc
        info = b2.InMemoryAccountInfo()
        api = b2.B2Api(info)
        api.authorize_account("production", self.key_id, self.app_key)
        return api


def upload_file(local_path: Path, config: B2StagingConfig, *, prefix: str) -> str:
    """Upload a single file to B2. Returns the remote file name (bucket path)."""
    api = config._api()
    bucket = api.get_bucket_by_name(config.bucket_name)
    remote_name = f"{prefix}/{local_path.name}"
    bucket.upload_local_file(
        local_file=str(local_path),
        file_name=remote_name,
    )
    return remote_name


def upload_files_from_dir(
    directory: Path, config: B2StagingConfig, *, prefix: str
) -> list[str]:
    """Upload all files in directory to B2. Returns list of remote file names."""
    api = config._api()
    bucket = api.get_bucket_by_name(config.bucket_name)
    remote_names = []
    for file_path in sorted(directory.iterdir()):
        if not file_path.is_file():
            continue
        remote_name = f"{prefix}/{file_path.name}"
        bucket.upload_local_file(
            local_file=str(file_path),
            file_name=remote_name,
        )
        remote_names.append(remote_name)
    return remote_names


def download_file(remote_name: str, dest: Path, config: B2StagingConfig) -> None:
    """Download a file from B2 by its remote name to dest path."""
    api = config._api()
    bucket = api.get_bucket_by_name(config.bucket_name)
    download = bucket.download_file_by_name(remote_name)
    download.save_to(str(dest))
