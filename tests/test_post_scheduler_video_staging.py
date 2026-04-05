import base64
import contextlib
import importlib.util
import io
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = REPO_ROOT / "skills" / "post-scheduler" / "scripts" / "video_staging.py"


def _load_video_staging_module():
    spec = importlib.util.spec_from_file_location(
        "post_scheduler_video_staging", MODULE_PATH
    )
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


video_staging = _load_video_staging_module()


class DummyResponse:
    def __init__(
        self,
        *,
        ok: bool = True,
        status_code: int = 200,
        text: str = "",
        json_data: dict | None = None,
    ):
        self.ok = ok
        self.status_code = status_code
        self.text = text
        self._json_data = json_data or {}

    def json(self) -> dict:
        return self._json_data


def test_backblaze_b2_upload_uses_native_api_and_returns_public_url(
    tmp_path: Path,
):
    video_path = tmp_path / "clip.mp4"
    video_path.write_bytes(b"fake-video-bytes")

    calls: list[tuple[str, dict]] = []

    def fake_get(url: str, **kwargs):
        calls.append(("get", {"url": url, **kwargs}))
        return DummyResponse(
            json_data={
                "apiUrl": "https://api001.backblazeb2.com",
                "downloadUrl": "https://f001.backblazeb2.com",
                "authorizationToken": "account-token",
            }
        )

    def fake_post(url: str, **kwargs):
        calls.append(("post", {"url": url, **kwargs}))
        if url.endswith("/b2api/v2/b2_get_upload_url"):
            return DummyResponse(
                json_data={
                    "uploadUrl": "https://pod-000.backblaze.com/b2api/v2/b2_upload_file/xyz",
                    "authorizationToken": "upload-token",
                }
            )
        return DummyResponse(json_data={"fileId": "4_zabc"})

    with (
        patch.dict(
            video_staging.os.environ,
            {
                "BACKBLAZE_B2_KEY_ID": "key-id",
                "BACKBLAZE_B2_APPLICATION_KEY": "app-key",
                "BACKBLAZE_B2_BUCKET_ID": "bucket-123",
                "BACKBLAZE_B2_BUCKET_NAME": "public-videos",
            },
            clear=False,
        ),
        patch.object(video_staging.requests, "get", side_effect=fake_get),
        patch.object(video_staging.requests, "post", side_effect=fake_post),
    ):
        result = video_staging.stage_local_video(
            video_path=str(video_path),
            mode="customScheduled",
            due_at="2030-01-01T00:00:00Z",
            provider_name="backblaze-b2",
        )

    assert result.startswith(
        "https://f001.backblazeb2.com/file/public-videos/buffer-video-staging/"
    )
    assert result.endswith("/clip.mp4")

    auth_call = calls[0]
    assert auth_call[0] == "get"
    assert (
        auth_call[1]["url"]
        == "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"
    )
    expected_basic = base64.b64encode(b"key-id:app-key").decode("ascii")
    assert auth_call[1]["headers"]["Authorization"] == f"Basic {expected_basic}"

    upload_url_call = calls[1]
    assert upload_url_call[0] == "post"
    assert upload_url_call[1]["json"] == {"bucketId": "bucket-123"}
    assert upload_url_call[1]["headers"]["Authorization"] == "account-token"

    upload_call = calls[2]
    assert upload_call[0] == "post"
    assert upload_call[1]["url"].endswith("/b2_upload_file/xyz")
    assert upload_call[1]["headers"]["Authorization"] == "upload-token"
    assert upload_call[1]["headers"]["Content-Type"] == "video/mp4"
    assert upload_call[1]["headers"]["X-Bz-File-Name"].endswith("/clip.mp4")
    assert upload_call[1]["data"] == b"fake-video-bytes"


def test_backblaze_b2_requires_env_vars():
    with tempfile.TemporaryDirectory() as tmp_dir:
        video_path = Path(tmp_dir) / "clip.mp4"
        video_path.write_bytes(b"fake-video-bytes")

        stderr = io.StringIO()
        with (
            patch.dict(video_staging.os.environ, {}, clear=True),
            contextlib.redirect_stderr(stderr),
        ):
            try:
                video_staging.stage_local_video(
                    video_path=str(video_path),
                    mode="customScheduled",
                    due_at="2030-01-01T00:00:00Z",
                    provider_name="backblaze-b2",
                )
            except SystemExit as exc:
                assert exc.code == 1
            else:
                raise AssertionError(
                    "Expected stage_local_video to exit when env is missing"
                )

        assert "BACKBLAZE_B2_KEY_ID" in stderr.getvalue()


def test_backblaze_b2_defaults_unknown_extension_to_video_mp4():
    with tempfile.TemporaryDirectory() as tmp_dir:
        video_path = Path(tmp_dir) / "clip.unknown"
        video_path.write_bytes(b"data")

        assert video_staging._guess_content_type(video_path) == "video/mp4"


def test_backblaze_b2_is_treated_as_operator_managed_persistent_storage():
    provider = video_staging.PROVIDERS["backblaze-b2"]

    assert provider.retention is None
    assert provider.assumes_persistent_storage is True


def test_backblaze_b2_reads_missing_env_vars_from_configured_env_file(tmp_path: Path):
    configured_env_path = tmp_path / "b2.env"
    configured_env_path.write_text(
        "BACKBLAZE_B2_BUCKET_NAME=configured-bucket\n",
        encoding="utf-8",
    )

    with patch.dict(
        video_staging.os.environ,
        {video_staging._B2_ENV_FILE_VAR: str(configured_env_path)},
        clear=True,
    ):
        assert (
            video_staging._require_env("BACKBLAZE_B2_BUCKET_NAME")
            == "configured-bucket"
        )


def test_shell_env_overrides_configured_b2_env_file(tmp_path: Path):
    configured_env_path = tmp_path / "b2.env"
    configured_env_path.write_text(
        "BACKBLAZE_B2_BUCKET_NAME=configured-bucket\n",
        encoding="utf-8",
    )

    with patch.dict(
        video_staging.os.environ,
        {
            video_staging._B2_ENV_FILE_VAR: str(configured_env_path),
            "BACKBLAZE_B2_BUCKET_NAME": "shell-bucket",
        },
        clear=True,
    ):
        assert video_staging._require_env("BACKBLAZE_B2_BUCKET_NAME") == "shell-bucket"


def test_invalid_configured_b2_env_file_exits_cleanly(tmp_path: Path):
    missing_path = tmp_path / "missing.env"
    stderr = io.StringIO()

    with (
        patch.dict(
            video_staging.os.environ,
            {video_staging._B2_ENV_FILE_VAR: str(missing_path)},
            clear=True,
        ),
        contextlib.redirect_stderr(stderr),
    ):
        try:
            video_staging._require_env("BACKBLAZE_B2_BUCKET_NAME")
        except SystemExit as exc:
            assert exc.code == 1
        else:
            raise AssertionError(
                "Expected _require_env to exit when BACKBLAZE_B2_ENV_FILE is invalid"
            )

    assert video_staging._B2_ENV_FILE_VAR in stderr.getvalue()
