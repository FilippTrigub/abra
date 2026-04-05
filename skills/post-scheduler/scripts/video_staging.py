from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import hashlib
import mimetypes
import os
from pathlib import Path
from urllib.parse import quote
import sys
from collections.abc import Callable

import requests

_B2_ENV_FILE_VAR = "BACKBLAZE_B2_ENV_FILE"
_B2_ENV_NAMES = {
    "BACKBLAZE_B2_KEY_ID",
    "BACKBLAZE_B2_APPLICATION_KEY",
    "BACKBLAZE_B2_BUCKET_ID",
    "BACKBLAZE_B2_BUCKET_NAME",
}

FIXED_SAFETY_MARGIN = timedelta(hours=12)
SCHEDULED_VIDEO_MODES = {
    "addToQueue",
    "customScheduled",
    "recommendedTime",
    "shareNext",
}


@dataclass(frozen=True)
class StagingProvider:
    name: str
    retention: timedelta | None
    upload: Callable[[Path], str]
    assumes_persistent_storage: bool = False


def _extract_plain_url(body: str) -> str:
    return body.strip()


def _upload_to_0x0(path: Path) -> str:
    with path.open("rb") as handle:
        response = requests.post(
            "https://0x0.st",
            files={"file": (path.name, handle)},
            timeout=120,
        )

    if not response.ok:
        print(
            f"Error: 0x0.st upload failed with HTTP {response.status_code}: "
            f"{response.text[:500]}",
            file=sys.stderr,
        )
        sys.exit(1)

    final_url = _extract_plain_url(response.text)
    if not final_url.startswith("http"):
        print(
            f"Error: 0x0.st returned an invalid URL: {final_url!r}",
            file=sys.stderr,
        )
        sys.exit(1)

    return final_url


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value

    value = _read_b2_env_file_value(name)
    if value:
        return value

    print(
        f"Error: missing required environment variable {name} for Backblaze B2 video staging.",
        file=sys.stderr,
    )
    sys.exit(1)


def _read_b2_env_file_value(name: str) -> str:
    if name not in _B2_ENV_NAMES:
        return ""

    configured_env_path = _configured_b2_env_path()
    if configured_env_path is None:
        return ""

    return _read_env_file_value(configured_env_path, name)


def _configured_b2_env_path() -> Path | None:
    raw_path = os.environ.get(_B2_ENV_FILE_VAR, "").strip()
    if not raw_path:
        return None

    path = Path(raw_path).expanduser()
    if not path.is_file():
        print(
            f"Error: {_B2_ENV_FILE_VAR} must point to a readable dotenv file: {path}",
            file=sys.stderr,
        )
        sys.exit(1)

    return path


def _read_env_file_value(path: Path, name: str) -> str:
    if not path.exists():
        return ""

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, raw_value = line.split("=", 1)
        key = key.strip()
        if key != name:
            continue

        value = raw_value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        return value.strip()

    return ""


def _b2_headers(key_id: str, application_key: str) -> dict[str, str]:
    token = base64.b64encode(f"{key_id}:{application_key}".encode("utf-8")).decode(
        "ascii"
    )
    return {"Authorization": f"Basic {token}"}


def _guess_content_type(path: Path) -> str:
    guessed_type, _ = mimetypes.guess_type(path.name)
    return guessed_type or "video/mp4"


def _build_b2_file_name(path: Path, digest: str) -> str:
    safe_name = quote(path.name, safe="._-")
    return f"buffer-video-staging/{digest}/{safe_name}"


def _upload_to_backblaze_b2(path: Path) -> str:
    key_id = _require_env("BACKBLAZE_B2_KEY_ID")
    application_key = _require_env("BACKBLAZE_B2_APPLICATION_KEY")
    bucket_id = _require_env("BACKBLAZE_B2_BUCKET_ID")
    bucket_name = _require_env("BACKBLAZE_B2_BUCKET_NAME")

    authorize_response = requests.get(
        "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
        headers=_b2_headers(key_id, application_key),
        timeout=120,
    )
    if not authorize_response.ok:
        print(
            "Error: Backblaze B2 authorize_account failed with HTTP "
            f"{authorize_response.status_code}: {authorize_response.text[:500]}",
            file=sys.stderr,
        )
        sys.exit(1)

    authorize_data = authorize_response.json()
    api_url = authorize_data.get("apiUrl")
    download_url = authorize_data.get("downloadUrl")
    account_token = authorize_data.get("authorizationToken")
    if not api_url or not download_url or not account_token:
        print(
            "Error: Backblaze B2 authorize_account response missing apiUrl, "
            "downloadUrl, or authorizationToken.",
            file=sys.stderr,
        )
        sys.exit(1)

    upload_url_response = requests.post(
        f"{api_url}/b2api/v2/b2_get_upload_url",
        headers={"Authorization": account_token},
        json={"bucketId": bucket_id},
        timeout=120,
    )
    if not upload_url_response.ok:
        print(
            "Error: Backblaze B2 b2_get_upload_url failed with HTTP "
            f"{upload_url_response.status_code}: {upload_url_response.text[:500]}",
            file=sys.stderr,
        )
        sys.exit(1)

    upload_url_data = upload_url_response.json()
    upload_url = upload_url_data.get("uploadUrl")
    upload_auth_token = upload_url_data.get("authorizationToken")
    if not upload_url or not upload_auth_token:
        print(
            "Error: Backblaze B2 b2_get_upload_url response missing uploadUrl "
            "or authorizationToken.",
            file=sys.stderr,
        )
        sys.exit(1)

    file_bytes = path.read_bytes()
    file_sha1 = hashlib.sha1(file_bytes).hexdigest()
    file_name = _build_b2_file_name(path, file_sha1)
    content_type = _guess_content_type(path)

    upload_response = requests.post(
        upload_url,
        headers={
            "Authorization": upload_auth_token,
            "Content-Type": content_type,
            "X-Bz-File-Name": file_name,
            "X-Bz-Content-Sha1": file_sha1,
        },
        data=file_bytes,
        timeout=120,
    )
    if not upload_response.ok:
        print(
            "Error: Backblaze B2 upload failed with HTTP "
            f"{upload_response.status_code}: {upload_response.text[:500]}",
            file=sys.stderr,
        )
        sys.exit(1)

    return f"{download_url}/file/{quote(bucket_name, safe='')}/{file_name}"


PROVIDERS: dict[str, StagingProvider] = {
    "0x0.st": StagingProvider(
        name="0x0.st",
        retention=timedelta(days=30),
        upload=_upload_to_0x0,
    ),
    "backblaze-b2": StagingProvider(
        name="backblaze-b2",
        retention=None,
        upload=_upload_to_backblaze_b2,
        assumes_persistent_storage=True,
    ),
}


def requires_video_staging(mode: str, video_url: str | None) -> bool:
    return bool(
        video_url and not video_url.startswith("http") and mode in SCHEDULED_VIDEO_MODES
    )


def stage_local_video(
    video_path: str,
    mode: str,
    due_at: str | None,
    provider_name: str | None,
) -> str:
    path = Path(video_path).resolve()
    if not path.exists():
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)

    if not provider_name:
        print(
            "Error: local videos for scheduled/queued modes require "
            "--video-staging-provider.",
            file=sys.stderr,
        )
        sys.exit(1)

    provider = PROVIDERS.get(provider_name)
    if provider is None:
        choices = ", ".join(sorted(PROVIDERS))
        print(
            f"Error: unsupported video staging provider '{provider_name}'. "
            f"Choose one of: {choices}",
            file=sys.stderr,
        )
        sys.exit(1)

    if provider.assumes_persistent_storage:
        _required_retention(mode, due_at)
    elif provider.retention is None:
        print(
            f"Error: staging provider '{provider.name}' has unknown retention; refusing to use it.",
            file=sys.stderr,
        )
        sys.exit(1)
    else:
        required_retention = _required_retention(mode, due_at)
        if provider.retention <= required_retention:
            print(
                f"Error: staging provider '{provider.name}' retains uploads for "
                f"{_format_duration(provider.retention)}, but this post needs strictly more "
                f"than {_format_duration(required_retention)} to cover the scheduled publish time plus 12h.",
                file=sys.stderr,
            )
            sys.exit(1)

    return _upload_staged_video(path, provider)


def _required_retention(mode: str, due_at: str | None) -> timedelta:
    if not due_at:
        if mode == "customScheduled":
            print(
                "Error: --due-at is required for local videos in customScheduled mode.",
                file=sys.stderr,
            )
            sys.exit(1)

        print(
            "Error: local videos in scheduled/queued modes require a known due-at time "
            "to verify staging retention. Use a remote URL, or switch to customScheduled "
            "with --due-at.",
            file=sys.stderr,
        )
        sys.exit(1)

    due_at_utc = _parse_due_at(due_at)
    now_utc = datetime.now(UTC)
    return (due_at_utc - now_utc) + FIXED_SAFETY_MARGIN


def _parse_due_at(raw: str) -> datetime:
    normalized = raw.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"

    try:
        due_at = datetime.fromisoformat(normalized)
    except ValueError:
        print(
            f"Error: invalid --due-at value '{raw}'. Expected ISO8601.",
            file=sys.stderr,
        )
        sys.exit(1)

    if due_at.tzinfo is None:
        print(
            f"Error: invalid --due-at value '{raw}'. Timezone is required.",
            file=sys.stderr,
        )
        sys.exit(1)

    return due_at.astimezone(UTC)


def _upload_staged_video(path: Path, provider: StagingProvider) -> str:
    print(f"Staging local video via {provider.name}...", file=sys.stderr)
    final_url = provider.upload(path)
    if not final_url.startswith("http"):
        print(
            f"Error: {provider.name} returned an invalid URL: {final_url!r}",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Staged local video → {final_url}", file=sys.stderr)
    return final_url


def _format_duration(duration: timedelta) -> str:
    total_seconds = int(duration.total_seconds())
    sign = "-" if total_seconds < 0 else ""
    total_seconds = abs(total_seconds)
    days, remainder = divmod(total_seconds, 24 * 60 * 60)
    hours, remainder = divmod(remainder, 60 * 60)
    minutes, _ = divmod(remainder, 60)

    parts: list[str] = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes or not parts:
        parts.append(f"{minutes}m")
    return sign + " ".join(parts)
