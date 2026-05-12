import json
import os
import struct
import subprocess
from pathlib import Path
from typing import TypedDict

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL_NAME = "remotion-video"
SKILL_DIR = REPO_ROOT / "skills" / SKILL_NAME
VALID_SPEC = SKILL_DIR / "fixtures" / "render-spec.valid.json"
INVALID_SPEC = SKILL_DIR / "fixtures" / "render-spec.invalid.missing-composition.json"


class VideoInfo(TypedDict):
    has_audio: bool
    has_video: bool
    width: int
    height: int
    fps: int
    duration: float
    nb_frames: int


def _uv_sync() -> None:
    result = subprocess.run(
        ["uv", "sync"],
        cwd=SKILL_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        pytest.fail(f"uv sync failed for {SKILL_NAME}:\n{result.stderr}")


def _video_info(path: Path) -> VideoInfo:
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)],
        capture_output=True,
        text=True,
    )
    data = json.loads(probe.stdout)
    info: VideoInfo = {
        "has_audio": False,
        "has_video": False,
        "width": 0,
        "height": 0,
        "fps": 0,
        "duration": 0.0,
        "nb_frames": 0,
    }
    for stream in data.get("streams", []):
        if stream["codec_type"] == "video":
            info["has_video"] = True
            info["width"] = stream.get("width")
            info["height"] = stream.get("height")
            fps_parts = stream.get("r_frame_rate", "30/1").split("/")
            info["fps"] = round(int(fps_parts[0]) / int(fps_parts[1]))
            info["duration"] = float(stream.get("duration", 0))
            info["nb_frames"] = int(stream.get("nb_frames", 0))
        elif stream["codec_type"] == "audio":
            info["has_audio"] = True
    return info


def _render_command(spec_path: Path, output_dir: Path, *extra_args: str) -> list[str]:
    return [
        "uv",
        "run",
        "python",
        "scripts/render.py",
        "--render-spec",
        str(spec_path),
        "--output",
        str(output_dir),
        *extra_args,
    ]


def _run_render(spec_path: Path, output_dir: Path, *extra_args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        _render_command(spec_path, output_dir, *extra_args),
        cwd=SKILL_DIR,
        capture_output=True,
        text=True,
        env={**os.environ, "VIRTUAL_ENV": ""},
    )


def _load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_json(path: Path, payload: dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def _png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        signature = handle.read(8)
        if signature != b"\x89PNG\r\n\x1a\n":
            raise AssertionError(f"Expected PNG signature for {path}")
        _length = handle.read(4)
        chunk_type = handle.read(4)
        if chunk_type != b"IHDR":
            raise AssertionError(f"Expected IHDR chunk for {path}")
        width, height = struct.unpack(
            ">II",
            handle.read(8),
        )
    return width, height


def _artifact_paths(output_dir: Path) -> tuple[Path, Path, Path]:
    return (
        output_dir / "fixture-branded-render.mp4",
        output_dir / "fixture-branded-render.png",
        output_dir / "render-manifest.json",
    )


@pytest.fixture(scope="module", autouse=True)
def remotion_video_runtime() -> None:
    _uv_sync()
    result = subprocess.run(
        ["npm", "install"],
        cwd=SKILL_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        pytest.fail(f"npm install failed for {SKILL_NAME}:\n{result.stderr}")


@pytest.fixture(scope="module")
def successful_render(tmp_path_factory: pytest.TempPathFactory) -> dict[str, object]:
    output_dir = tmp_path_factory.mktemp("remotion-video-success")
    result = _run_render(VALID_SPEC, output_dir)
    video_path, thumbnail_path, manifest_path = _artifact_paths(output_dir)
    return {
        "result": result,
        "output_dir": output_dir,
        "video_path": video_path,
        "thumbnail_path": thumbnail_path,
        "manifest_path": manifest_path,
    }


class TestRemotionVideoE2E:
    def test_renders_valid_fixture_via_real_cli(self, successful_render: dict[str, object]):
        result = successful_render["result"]

        assert isinstance(result, subprocess.CompletedProcess)
        assert result.returncode == 0, result.stderr
        assert "> remotion-video@0.1.0 render" in result.stdout
        assert "tsx scripts/render.ts --spec" in result.stdout
        assert "Bundling Remotion entry point:" in result.stdout
        assert "Rendering video:" in result.stdout
        assert "Rendering thumbnail:" in result.stdout
        assert "Manifest written:" in result.stdout

    def test_writes_valid_mp4_manifest_and_thumbnail(self, successful_render: dict[str, object]):
        video_path = successful_render["video_path"]
        thumbnail_path = successful_render["thumbnail_path"]
        manifest_path = successful_render["manifest_path"]

        assert isinstance(video_path, Path)
        assert isinstance(thumbnail_path, Path)
        assert isinstance(manifest_path, Path)

        assert video_path.exists()
        assert thumbnail_path.exists()
        assert manifest_path.exists()

        info = _video_info(video_path)
        assert info["has_video"] is True
        assert info["has_audio"] is True
        assert info["width"] == 1080
        assert info["height"] == 1920
        assert info["fps"] == 30
        assert abs(info["duration"] - 2.0) < 0.2

        thumbnail_width, thumbnail_height = _png_dimensions(thumbnail_path)
        assert (thumbnail_width, thumbnail_height) == (1080, 1920)

        manifest = _load_json(manifest_path)
        assert manifest["manifest_version"] == "1.0"
        assert manifest["render_id"] == "fixture-branded-render"
        assert manifest["composition"] == "branded-starter"
        assert manifest["duration_seconds"] == 2
        assert manifest["fps"] == 30
        assert manifest["width"] == 1080
        assert manifest["height"] == 1920
        assert manifest["warnings"] == []
        assert manifest["source_spec_path"] == "fixtures/render-spec.valid.json"
        assert not str(manifest["video_path"]).startswith("/")
        assert not str(manifest["thumbnail_path"]).startswith("/")
        assert Path(manifest["video_path"]).name == video_path.name
        assert Path(manifest["thumbnail_path"]).name == thumbnail_path.name

    def test_invalid_spec_fails_before_render_and_leaves_no_success_manifest(self, tmp_path: Path):
        output_dir = tmp_path / "output"
        result = _run_render(INVALID_SPEC, output_dir)
        video_path, thumbnail_path, manifest_path = _artifact_paths(output_dir)

        assert result.returncode != 0
        assert "Render spec schema validation failed" in result.stderr
        assert "composition" in result.stderr
        assert "> remotion-video@0.1.0 render" not in result.stdout
        assert not video_path.exists()
        assert not thumbnail_path.exists()
        assert not manifest_path.exists()

    def test_missing_asset_fails_before_render_and_leaves_no_success_manifest(self, tmp_path: Path):
        spec_path = tmp_path / "render-spec.missing-asset.json"
        spec_payload = _load_json(VALID_SPEC)
        spec_payload["assets"]["images"][0]["path"] = "./does-not-exist.jpg"
        _write_json(spec_path, spec_payload)

        output_dir = tmp_path / "output"
        result = _run_render(spec_path, output_dir)
        video_path, thumbnail_path, manifest_path = _artifact_paths(output_dir)

        assert result.returncode != 0
        assert "Render spec validation failed" in result.stderr
        assert "does not exist" in result.stderr
        assert "> remotion-video@0.1.0 render" not in result.stdout
        assert not video_path.exists()
        assert not thumbnail_path.exists()
        assert not manifest_path.exists()

    def test_rerun_overwrites_by_default_and_no_overwrite_fails_cleanly(self, tmp_path: Path):
        output_dir = tmp_path / "output"

        first_result = _run_render(VALID_SPEC, output_dir)
        assert first_result.returncode == 0, first_result.stderr

        video_path, thumbnail_path, manifest_path = _artifact_paths(output_dir)
        first_video_bytes = video_path.read_bytes()
        first_thumbnail_bytes = thumbnail_path.read_bytes()
        first_manifest_bytes = manifest_path.read_bytes()

        no_overwrite_result = _run_render(VALID_SPEC, output_dir, "--no-overwrite")
        assert no_overwrite_result.returncode != 0
        assert "overwrite is disabled" in no_overwrite_result.stderr
        assert str(video_path) in no_overwrite_result.stderr
        assert str(thumbnail_path) in no_overwrite_result.stderr
        assert str(manifest_path) in no_overwrite_result.stderr
        assert video_path.read_bytes() == first_video_bytes
        assert thumbnail_path.read_bytes() == first_thumbnail_bytes
        assert manifest_path.read_bytes() == first_manifest_bytes

        overwrite_result = _run_render(VALID_SPEC, output_dir, "--overwrite")
        assert overwrite_result.returncode == 0, overwrite_result.stderr
        assert "> remotion-video@0.1.0 render" in overwrite_result.stdout
        assert video_path.exists()
        assert thumbnail_path.exists()
        assert manifest_path.exists()
        assert manifest_path.stat().st_mtime_ns >= video_path.stat().st_mtime_ns
