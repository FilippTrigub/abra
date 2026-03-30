from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from conftest import REPO_ROOT, skill_dir, uv_sync, video_info

SKILL = "visual-hook"
REPO_INPUT_DIR = REPO_ROOT / "input"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm"}

VIDEO_HOOK_TEXT = "WAIT TILL THE END"
IMAGE_HOOK_TEXT = "THIS CHANGES EVERYTHING"


def _pick_repo_image() -> Path:
    preferred = REPO_INPUT_DIR / "test-image1.jpeg"
    if preferred.exists():
        return preferred

    images = sorted(
        path
        for path in REPO_INPUT_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    assert images, f"No image files found in repo input dir: {REPO_INPUT_DIR}"
    return images[0]


def _pick_repo_video() -> Path:
    preferred = REPO_INPUT_DIR / "test17.mp4"
    if preferred.exists():
        return preferred

    videos = sorted(
        path
        for path in REPO_INPUT_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS
    )
    assert videos, f"No video files found in repo input dir: {REPO_INPUT_DIR}"
    return videos[0]


def _hook_roi(image: Image.Image) -> tuple[int, int, int, int]:
    width, height = image.size
    return (
        int(width * 0.10),
        int(height * 0.06),
        int(width * 0.90),
        int(height * 0.34),
    )


def _roi_mean_diff(before: Image.Image, after: Image.Image) -> float:
    box = _hook_roi(before)
    before_arr = np.asarray(before.crop(box).convert("RGB"), dtype=np.int16)
    after_arr = np.asarray(after.crop(box).convert("RGB"), dtype=np.int16)
    return float(np.abs(before_arr - after_arr).mean())


def _extract_frame(video_path: Path, timestamp_s: float, output_path: Path) -> None:
    result = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            str(timestamp_s),
            "-i",
            str(video_path),
            "-vframes",
            "1",
            "-hide_banner",
            "-loglevel",
            "error",
            str(output_path),
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert output_path.exists(), f"Frame extraction failed for {video_path}"


def _run_visual_hook(
    args: list[str], brand_assets_dir: Path
) -> subprocess.CompletedProcess:
    env = {
        **os.environ,
        "CLAW_BRAND_ASSETS_DIR": str(brand_assets_dir),
        "VIRTUAL_ENV": "",
    }
    return subprocess.run(
        ["uv", "run", "python", "scripts/hook.py", *args],
        cwd=skill_dir(SKILL),
        capture_output=True,
        text=True,
        env=env,
    )


@pytest.fixture(autouse=True, scope="module")
def setup_venv() -> None:
    uv_sync(SKILL)


@pytest.fixture
def image_workdir(tmp_path: Path) -> tuple[Path, Path, Path]:
    source = _pick_repo_image()
    inp = tmp_path / "input"
    out = tmp_path / "output"
    inp.mkdir()
    out.mkdir()
    copied = inp / source.name
    shutil.copy(source, copied)
    return source, copied, out


@pytest.fixture
def video_workdir(tmp_path: Path) -> tuple[Path, Path, Path]:
    source = _pick_repo_video()
    inp = tmp_path / "input"
    out = tmp_path / "output"
    inp.mkdir()
    out.mkdir()
    copied = inp / source.name
    shutil.copy(source, copied)
    return source, copied, out


@pytest.fixture
def brand_assets_dir(tmp_path: Path) -> Path:
    assets_dir = tmp_path / "brand-assets"
    videos_dir = assets_dir / "videos"
    videos_dir.mkdir(parents=True)
    hook_source = _pick_repo_video()
    hook_dest = videos_dir / "intro-fast.mp4"
    shutil.copy(hook_source, hook_dest)
    manifest = {
        "version": "1.0",
        "brand": "test-brand",
        "updated": "2026-03-30T00:00:00Z",
        "images": [],
        "fonts": [],
        "videos": [
            {
                "name": "intro-fast",
                "path": "videos/intro-fast.mp4",
                "tags": ["hook-video"],
                "default": True,
                "added": "2026-03-30T00:00:00Z",
            }
        ],
    }
    (assets_dir / "asset-manifest.json").write_text(json.dumps(manifest, indent=2))
    return assets_dir


class TestVisualHookE2E:
    def test_image_e2e_applies_visible_hook(
        self, image_workdir: tuple[Path, Path, Path], brand_assets_dir: Path
    ) -> None:
        _, input_image, out = image_workdir

        result = _run_visual_hook(
            [
                "--input",
                str(input_image.parent),
                "--output",
                str(out),
                "--text",
                IMAGE_HOOK_TEXT,
                "--preset",
                "neon-yellow",
                "--position",
                "upper-middle",
                "--format",
                "auto",
            ],
            brand_assets_dir,
        )

        assert result.returncode == 0, f"stderr:\n{result.stderr}"

        output_image = out / input_image.name
        assert output_image.exists(), f"Expected output image at {output_image}"

        with Image.open(input_image) as before, Image.open(output_image) as after:
            assert before.size == after.size
            diff = _roi_mean_diff(before, after)

        assert diff > 3.0, (
            f"Expected visible hook-region difference, got diff={diff:.3f}"
        )

    def test_video_e2e_applies_visible_hook(
        self,
        video_workdir: tuple[Path, Path, Path],
        tmp_path: Path,
        brand_assets_dir: Path,
    ) -> None:
        _, input_video, out = video_workdir

        result = _run_visual_hook(
            [
                "--input",
                str(input_video.parent),
                "--output",
                str(out),
                "--text",
                VIDEO_HOOK_TEXT,
                "--preset",
                "bold-white",
                "--position",
                "upper-middle",
                "--format",
                "auto",
                "--duration",
                "2.5",
                "--hook-video",
                "intro-fast",
            ],
            brand_assets_dir,
        )

        assert result.returncode == 0, f"stderr:\n{result.stderr}"

        output_video = out / f"{input_video.stem}.mp4"
        assert output_video.exists(), f"Expected output video at {output_video}"

        input_info = video_info(input_video)
        info = video_info(output_video)
        assert info["has_video"], "Output video missing video stream"
        assert info["duration"] > input_info["duration"] + 1.0

        input_frame = tmp_path / "input_frame.png"
        output_frame = tmp_path / "output_frame.png"
        _extract_frame(input_video, 0.5, input_frame)
        _extract_frame(output_video, 0.5, output_frame)

        with Image.open(input_frame) as before, Image.open(output_frame) as after:
            assert before.size == after.size
            diff = _roi_mean_diff(before, after)

        assert diff > 2.0, (
            f"Expected visible hook-region difference, got diff={diff:.3f}"
        )
