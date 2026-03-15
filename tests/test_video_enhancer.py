"""
test_video_enhancer.py — E2E tests for the video-enhancer skill.

Skill under test: skills/video-enhancer
Script:          scripts/enhance.py
CPU-only (no GPU required). All tests run everywhere.

Test fixture: tests/fixtures/clip_5s.mp4 (1080×1920, 30fps, 2s, stereo AAC)
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from conftest import (
    CLIP_DURATION_S,
    CLIP_HEIGHT,
    CLIP_WIDTH,
    run_skill,
    uv_sync,
    video_info,
)

SKILL = "video-enhancer"


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
# TestEnhancerOutput — file-level assertions
# ---------------------------------------------------------------------------


class TestEnhancerOutput:
    """Output file existence, codec, and stream structure."""

    def test_produces_output_file(self, workdir: tuple[Path, Path]) -> None:
        """Exactly one output MP4 is created per input video."""
        inp, out = workdir
        result = run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                "natural",
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
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                "natural",
            ],
        )
        info = video_info(next(out.glob("*.mp4")))
        assert info["has_video"]

    def test_output_has_audio_stream(self, workdir: tuple[Path, Path]) -> None:
        """Output retains audio stream after normalisation."""
        inp, out = workdir
        run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                "natural",
            ],
        )
        info = video_info(next(out.glob("*.mp4")))
        assert info["has_audio"], "Output video missing audio stream"

    def test_output_preserves_dimensions(self, workdir: tuple[Path, Path]) -> None:
        """Output resolution matches input resolution."""
        inp, out = workdir
        run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                "natural",
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
        """Output duration is within ±0.5 s of input."""
        inp, out = workdir
        run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                "natural",
            ],
        )
        info = video_info(next(out.glob("*.mp4")))
        assert abs(info["duration"] - CLIP_DURATION_S) < 0.5, (
            f"Duration: {info['duration']:.2f}s, expected ~{CLIP_DURATION_S}s"
        )


# ---------------------------------------------------------------------------
# TestEnhancerPresets — all 3 presets succeed
# ---------------------------------------------------------------------------


class TestEnhancerPresets:
    """Each preset exits 0 and produces a valid output."""

    @pytest.mark.parametrize("preset", ["natural", "cinematic", "vivid"])
    def test_preset_exits_zero(self, workdir: tuple[Path, Path], preset: str) -> None:
        """All three presets complete without error."""
        inp, out = workdir
        result = run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                preset,
            ],
        )
        assert result.returncode == 0, (
            f"Preset '{preset}' failed.\nstderr:\n{result.stderr}"
        )

    @pytest.mark.parametrize("preset", ["natural", "cinematic", "vivid"])
    def test_preset_produces_output(
        self, workdir: tuple[Path, Path], preset: str
    ) -> None:
        """All three presets produce a non-empty output file."""
        inp, out = workdir
        run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                preset,
            ],
        )
        out_files = list(out.glob("*.mp4"))
        assert len(out_files) == 1
        assert out_files[0].stat().st_size > 0, "Output file is empty"


# ---------------------------------------------------------------------------
# TestEnhancerPixelChange — verify enhancement actually changes the image
# ---------------------------------------------------------------------------


class TestEnhancerPixelChange:
    """Output pixels differ measurably from input after enhancement."""

    def test_cinematic_changes_pixels(
        self, workdir: tuple[Path, Path], tmp_path: Path
    ) -> None:
        """Cinematic preset measurably alters pixel values vs the raw input."""
        import numpy as np
        from PIL import Image

        inp, out = workdir
        run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                "cinematic",
            ],
        )

        output_video = next(out.glob("*.mp4"))
        input_video = next(inp.glob("*.mp4"))

        frame_in = tmp_path / "frame_in.png"
        frame_out = tmp_path / "frame_out.png"

        # Extract the same frame from both videos
        for src, dest in [(input_video, frame_in), (output_video, frame_out)]:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-ss",
                    "0.5",
                    "-i",
                    str(src),
                    "-vframes",
                    "1",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    str(dest),
                ],
                check=True,
            )

        arr_in = np.array(Image.open(frame_in).convert("RGB"), dtype=float)
        arr_out = np.array(Image.open(frame_out).convert("RGB"), dtype=float)

        mean_diff = float(np.abs(arr_out - arr_in).mean())
        assert mean_diff > 1.0, (
            f"Cinematic preset appears to have no effect: mean pixel diff = {mean_diff:.4f}"
        )


# ---------------------------------------------------------------------------
# TestEnhancerIdempotency
# ---------------------------------------------------------------------------


class TestEnhancerIdempotency:
    """Already-processed videos are skipped on a second run."""

    def test_skips_existing_output(self, workdir: tuple[Path, Path]) -> None:
        """Running twice does not duplicate or overwrite existing output."""
        inp, out = workdir
        run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                "natural",
            ],
        )
        mtime_after_first = next(out.glob("*.mp4")).stat().st_mtime

        result = run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                "natural",
            ],
        )
        assert result.returncode == 0
        mtime_after_second = next(out.glob("*.mp4")).stat().st_mtime

        assert mtime_after_first == mtime_after_second, (
            "Output file was overwritten on second run (should be skipped)"
        )


# ---------------------------------------------------------------------------
# TestEnhancerErrors — invalid inputs exit non-zero
# ---------------------------------------------------------------------------


class TestEnhancerErrors:
    """Bad inputs produce a non-zero exit code."""

    def test_missing_input_dir_exits_nonzero(self, tmp_path: Path) -> None:
        """Non-existent input directory causes exit code 1."""
        result = run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(tmp_path / "nonexistent"),
                "--output",
                str(tmp_path / "out"),
                "--preset",
                "natural",
            ],
        )
        assert result.returncode != 0

    def test_invalid_preset_exits_nonzero(self, workdir: tuple[Path, Path]) -> None:
        """Unknown preset name causes non-zero exit."""
        inp, out = workdir
        result = run_skill(
            SKILL,
            "enhance.py",
            [
                "--input",
                str(inp),
                "--output",
                str(out),
                "--preset",
                "ultramax",
            ],
        )
        assert result.returncode != 0
