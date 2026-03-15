"""
test_video_captioner.py — E2E tests for the video-captioner skill.

Skill under test: skills/video-captioner
Script:          scripts/caption_service.py
CPU-only (Whisper tiny runs on CPU). All tests run everywhere.

Note: the first run may be slow as pycaps downloads the Whisper model (~140 MB).

Test fixture: tests/fixtures/clip_5s.mp4 (1080×1920, 30fps, 2s, stereo AAC)
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from conftest import (
    CLIP_DURATION_S,
    CLIP_HEIGHT,
    CLIP_WIDTH,
    SKILLS_DIR,
    run_skill,
    uv_sync,
    video_info,
)

SKILL = "video-captioner"
FUTURISTIC_CSS = SKILLS_DIR / SKILL / "scripts" / "futuristic.css"


# ---------------------------------------------------------------------------
# Shared setup
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True, scope="module")
def setup_venv() -> None:
    uv_sync(SKILL)


@pytest.fixture
def workdir(tmp_path: Path, test_clip: Path) -> tuple[Path, Path]:
    inp = tmp_path / "input"
    inp.mkdir()
    shutil.copy(test_clip, inp / test_clip.name)
    out = tmp_path / "output"
    out.mkdir()
    return inp, out


# ---------------------------------------------------------------------------
# TestCaptionerOutput — file-level assertions
# ---------------------------------------------------------------------------


class TestCaptionerOutput:
    """Output file existence, stream structure, and basic properties."""

    def test_produces_output_file(self, workdir: tuple[Path, Path]) -> None:
        """Exactly one output MP4 is created per input video."""
        inp, out = workdir
        result = run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
            ],
        )
        assert result.returncode == 0, f"stderr:\n{result.stderr}"
        out_files = list(out.glob("*.mp4"))
        assert len(out_files) == 1, f"Expected 1 output file, got {out_files}"

    def test_output_has_video_stream(self, workdir: tuple[Path, Path]) -> None:
        """Output contains a video stream."""
        inp, out = workdir
        run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
            ],
        )
        info = video_info(next(out.glob("*.mp4")))
        assert info["has_video"]

    def test_output_has_audio_stream(self, workdir: tuple[Path, Path]) -> None:
        """Output retains an audio stream."""
        inp, out = workdir
        run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
            ],
        )
        info = video_info(next(out.glob("*.mp4")))
        assert info["has_audio"], "Output video missing audio stream"

    def test_output_preserves_dimensions(self, workdir: tuple[Path, Path]) -> None:
        """Output resolution matches input resolution."""
        inp, out = workdir
        run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
            ],
        )
        info = video_info(next(out.glob("*.mp4")))
        assert info["width"] == CLIP_WIDTH, (
            f"Width: {info['width']}, expected {CLIP_WIDTH}"
        )
        assert info["height"] == CLIP_HEIGHT, (
            f"Height: {info['height']}, expected {CLIP_HEIGHT}"
        )

    def test_output_preserves_duration(self, workdir: tuple[Path, Path]) -> None:
        """Output duration is within ±1.0 s of input (caption render may pad slightly)."""
        inp, out = workdir
        run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
            ],
        )
        info = video_info(next(out.glob("*.mp4")))
        assert abs(info["duration"] - CLIP_DURATION_S) < 1.0, (
            f"Duration: {info['duration']:.2f}s, expected ~{CLIP_DURATION_S}s"
        )

    def test_output_is_nonempty(self, workdir: tuple[Path, Path]) -> None:
        """Output file is not empty."""
        inp, out = workdir
        run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
            ],
        )
        out_file = next(out.glob("*.mp4"))
        assert out_file.stat().st_size > 0, "Output file is empty"


# ---------------------------------------------------------------------------
# TestCaptionerStyles — CSS styling option
# ---------------------------------------------------------------------------


class TestCaptionerStyles:
    """Caption style variants."""

    def test_futuristic_css_exits_zero(self, workdir: tuple[Path, Path]) -> None:
        """Futuristic CSS flag succeeds and produces valid output."""
        inp, out = workdir
        result = run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--css",
                str(FUTURISTIC_CSS),
            ],
        )
        assert result.returncode == 0, f"stderr:\n{result.stderr}"
        out_files = list(out.glob("*.mp4"))
        assert len(out_files) == 1

    def test_futuristic_css_output_has_video(self, workdir: tuple[Path, Path]) -> None:
        """Futuristic CSS output contains a valid video stream."""
        inp, out = workdir
        run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--css",
                str(FUTURISTIC_CSS),
            ],
        )
        info = video_info(next(out.glob("*.mp4")))
        assert info["has_video"]

    def test_invalid_css_path_exits_nonzero(self, workdir: tuple[Path, Path]) -> None:
        """Non-existent CSS file causes non-zero exit."""
        inp, out = workdir
        result = run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--css",
                "/nonexistent/style.css",
            ],
        )
        assert result.returncode != 0


# ---------------------------------------------------------------------------
# TestCaptionerIdempotency
# ---------------------------------------------------------------------------


class TestCaptionerIdempotency:
    """Already-captioned videos are skipped on a second run."""

    def test_skips_existing_output(self, workdir: tuple[Path, Path]) -> None:
        """Running twice does not overwrite the existing output file."""
        inp, out = workdir
        run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
            ],
        )
        mtime_after_first = next(out.glob("*.mp4")).stat().st_mtime

        result = run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
            ],
        )
        assert result.returncode == 0
        mtime_after_second = next(out.glob("*.mp4")).stat().st_mtime

        assert mtime_after_first == mtime_after_second, (
            "Output file was overwritten on second run (should be skipped)"
        )


# ---------------------------------------------------------------------------
# TestCaptionerErrors — invalid inputs exit non-zero
# ---------------------------------------------------------------------------


class TestCaptionerErrors:
    """Bad inputs produce a non-zero exit code."""

    def test_missing_input_dir_exits_nonzero(self, tmp_path: Path) -> None:
        """Non-existent input directory causes exit code 1."""
        result = run_skill(
            SKILL,
            "caption_service.py",
            [
                "--input",
                str(tmp_path / "nonexistent"),
                "--output",
                str(tmp_path / "out"),
            ],
        )
        assert result.returncode != 0
