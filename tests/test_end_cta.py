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

SKILL = "end-cta"
REPO_INPUT_DIR = REPO_ROOT / "input"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm"}


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


def _pick_repo_cta_image() -> Path:
    preferred = REPO_INPUT_DIR / "512.png"
    if preferred.exists():
        return preferred
    images = sorted(
        path
        for path in REPO_INPUT_DIR.iterdir()
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )
    assert images, f"No image files found in repo input dir: {REPO_INPUT_DIR}"
    return images[-1]


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


def _run_end_cta(
    args: list[str], brand_assets_dir: Path
) -> subprocess.CompletedProcess:
    env = {
        **os.environ,
        "CLAW_BRAND_ASSETS_DIR": str(brand_assets_dir),
        "VIRTUAL_ENV": "",
    }
    return subprocess.run(
        ["uv", "run", "python", "scripts/cta.py", *args],
        cwd=skill_dir(SKILL),
        capture_output=True,
        text=True,
        env=env,
    )


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
    assert output_path.exists()


def _lower_middle_roi(image: Image.Image) -> tuple[int, int, int, int]:
    width, height = image.size
    return (
        int(width * 0.18),
        int(height * 0.62),
        int(width * 0.82),
        int(height * 0.92),
    )


def _roi_mean_diff(
    before: Image.Image, after: Image.Image, box: tuple[int, int, int, int]
) -> float:
    before_arr = np.asarray(before.crop(box).convert("RGB"), dtype=np.int16)
    after_arr = np.asarray(after.crop(box).convert("RGB"), dtype=np.int16)
    return float(np.abs(before_arr - after_arr).mean())


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
    images_dir = assets_dir / "images"
    videos_dir = assets_dir / "videos"
    images_dir.mkdir(parents=True)
    videos_dir.mkdir(parents=True)

    image_asset = images_dir / "follow-card.png"
    video_asset = videos_dir / "subscribe-end.mp4"
    shutil.copy(_pick_repo_cta_image(), image_asset)
    shutil.copy(_pick_repo_video(), video_asset)

    manifest = {
        "version": "1.0",
        "brand": "test-brand",
        "updated": "2026-03-30T00:00:00Z",
        "images": [
            {
                "name": "follow-card",
                "path": "images/follow-card.png",
                "tags": ["cta-source"],
                "added": "2026-03-30T00:00:00Z",
            }
        ],
        "fonts": [],
        "videos": [
            {
                "name": "subscribe-end",
                "path": "videos/subscribe-end.mp4",
                "tags": ["cta-source"],
                "default": False,
                "added": "2026-03-30T00:00:00Z",
            }
        ],
        "ctas": [
            {
                "name": "book-call",
                "type": "text",
                "text": "Book a call",
                "tags": ["cta"],
                "default": True,
                "added": "2026-03-30T00:00:00Z",
            },
            {
                "name": "follow-image",
                "type": "image",
                "asset_path": "images/follow-card.png",
                "tags": ["cta"],
                "default": False,
                "added": "2026-03-30T00:00:00Z",
            },
            {
                "name": "subscribe-video",
                "type": "video",
                "asset_path": "videos/subscribe-end.mp4",
                "tags": ["cta"],
                "default": False,
                "added": "2026-03-30T00:00:00Z",
            },
        ],
    }
    (assets_dir / "asset-manifest.json").write_text(json.dumps(manifest, indent=2))
    return assets_dir


class TestEndCtaE2E:
    def test_text_cta_on_image(
        self, image_workdir: tuple[Path, Path, Path], brand_assets_dir: Path
    ) -> None:
        _, input_image, out = image_workdir
        result = _run_end_cta(
            [
                "--input",
                str(input_image.parent),
                "--output",
                str(out),
                "--cta",
                "book-call",
            ],
            brand_assets_dir,
        )
        assert result.returncode == 0, result.stderr
        output_image = out / input_image.name
        assert output_image.exists()
        with Image.open(input_image) as before, Image.open(output_image) as after:
            diff = _roi_mean_diff(before, after, _lower_middle_roi(before))
        assert diff > 2.0

    def test_image_cta_on_image(
        self, image_workdir: tuple[Path, Path, Path], brand_assets_dir: Path
    ) -> None:
        _, input_image, out = image_workdir
        result = _run_end_cta(
            [
                "--input",
                str(input_image.parent),
                "--output",
                str(out),
                "--cta",
                "follow-image",
            ],
            brand_assets_dir,
        )
        assert result.returncode == 0, result.stderr
        output_image = out / input_image.name
        assert output_image.exists()
        with Image.open(input_image) as before, Image.open(output_image) as after:
            diff = _roi_mean_diff(before, after, _lower_middle_roi(before))
        assert diff > 2.0

    def test_video_cta_on_image_errors(
        self, image_workdir: tuple[Path, Path, Path], brand_assets_dir: Path
    ) -> None:
        _, input_image, out = image_workdir
        result = _run_end_cta(
            [
                "--input",
                str(input_image.parent),
                "--output",
                str(out),
                "--cta",
                "subscribe-video",
            ],
            brand_assets_dir,
        )
        assert result.returncode != 0
        assert "cannot be applied to image inputs" in result.stderr

    def test_text_cta_on_video(
        self, video_workdir: tuple[Path, Path, Path], brand_assets_dir: Path
    ) -> None:
        _, input_video, out = video_workdir
        result = _run_end_cta(
            [
                "--input",
                str(input_video.parent),
                "--output",
                str(out),
                "--cta",
                "book-call",
                "--duration",
                "2.0",
            ],
            brand_assets_dir,
        )
        assert result.returncode == 0, result.stderr
        output_video = out / f"{input_video.stem}.mp4"
        assert output_video.exists()
        assert (
            video_info(output_video)["duration"]
            > video_info(input_video)["duration"] + 1.5
        )

    def test_image_cta_on_video(
        self, video_workdir: tuple[Path, Path, Path], brand_assets_dir: Path
    ) -> None:
        _, input_video, out = video_workdir
        result = _run_end_cta(
            [
                "--input",
                str(input_video.parent),
                "--output",
                str(out),
                "--cta",
                "follow-image",
                "--duration",
                "2.0",
            ],
            brand_assets_dir,
        )
        assert result.returncode == 0, result.stderr
        output_video = out / f"{input_video.stem}.mp4"
        assert output_video.exists()
        assert (
            video_info(output_video)["duration"]
            > video_info(input_video)["duration"] + 1.5
        )

    def test_video_cta_on_video(
        self, video_workdir: tuple[Path, Path, Path], brand_assets_dir: Path
    ) -> None:
        _, input_video, out = video_workdir
        result = _run_end_cta(
            [
                "--input",
                str(input_video.parent),
                "--output",
                str(out),
                "--cta",
                "subscribe-video",
            ],
            brand_assets_dir,
        )
        assert result.returncode == 0, result.stderr
        output_video = out / f"{input_video.stem}.mp4"
        assert output_video.exists()
        input_duration = video_info(input_video)["duration"]
        output_duration = video_info(output_video)["duration"]
        assert output_duration > input_duration + 1.0
