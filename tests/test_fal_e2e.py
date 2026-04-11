"""
test_fal_e2e.py — End-to-end tests for fal.ai GPU inference.

These tests require deployed fal.ai apps and a FAL_KEY.
They are skipped automatically when:
  - FAL_APP_ID_<SKILL> env var is not set or empty
  - FAL_KEY env var is not set

Credentials are loaded from .env at the repo root.

Skills tested:
  1. background-remover  — image→image, smallest payload
  2. bokeh-effect        — image→image, depth model
  3. audio-splitter      — audio→audio stems
  4. frame-interpolator  — frames→frames, video motion
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from PIL import Image

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = Path(__file__).parent / "fixtures"
TEST_FRAMES_DIR = FIXTURES_DIR / "frames"
TEST_CLIP = FIXTURES_DIR / "clip_5s.mp4"

# ---------------------------------------------------------------------------
# Env loading
# ---------------------------------------------------------------------------


def _parse_env_file(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    if not path.exists():
        return result
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            result[key] = value
    return result


def _build_fal_env() -> dict[str, str]:
    env = {**os.environ}
    env.update(_parse_env_file(REPO_ROOT / ".env"))
    return env


_ENV = _build_fal_env()

# ---------------------------------------------------------------------------
# Skip helpers
# ---------------------------------------------------------------------------


def _fal_key_configured() -> bool:
    return bool(_ENV.get("FAL_KEY", "").strip())


def requires_fal_app(app_id_env: str):
    """Skip decorator: skip unless FAL_KEY and app ID are both set."""
    missing: list[str] = []
    if not _fal_key_configured():
        missing.append("FAL_KEY")
    if not _ENV.get(app_id_env, "").strip():
        missing.append(app_id_env)

    if missing:
        reason = f"fal.ai e2e skipped — missing env vars: {', '.join(missing)}"
        return pytest.mark.skipif(True, reason=reason)
    return pytest.mark.skipif(False, reason="all fal vars present")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run_skill_with_config(
    skill_name: str,
    script: str,
    extra_args: list[str],
    config: dict,
    *,
    timeout: int = 600,
) -> subprocess.CompletedProcess:
    skill_dir = REPO_ROOT / "skills" / skill_name
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, dir=skill_dir
    ) as tmp:
        json.dump(config, tmp)
        cfg_path = Path(tmp.name)

    try:
        cmd = [
            "uv", "run", "python",
            f"scripts/{script}",
            "--config", str(cfg_path),
        ] + extra_args

        result = subprocess.run(
            cmd,
            cwd=skill_dir,
            capture_output=True,
            text=True,
            env=_ENV,
            timeout=timeout,
        )
    finally:
        cfg_path.unlink(missing_ok=True)

    return result


# ---------------------------------------------------------------------------
# background-remover
# ---------------------------------------------------------------------------

class TestFalBackgroundRemover:
    SKILL = "background-remover"
    APP_ID_ENV = "FAL_APP_ID_BACKGROUND_REMOVER"

    @pytest.fixture
    def workdir(self, tmp_path):
        inp = tmp_path / "input"
        inp.mkdir()
        frames = sorted(TEST_FRAMES_DIR.glob("*.jpg"))
        assert frames, f"No test frames found in {TEST_FRAMES_DIR}"
        shutil.copy(frames[0], inp)
        out = tmp_path / "output"
        out.mkdir()
        return inp, out

    @requires_fal_app("FAL_APP_ID_BACKGROUND_REMOVER")
    def test_produces_rgba_png(self, workdir):
        """Single image goes through fal, comes back as RGBA PNG."""
        inp, out = workdir

        cfg = {
            "provider": "fal",
            "fal_api_key_env": "FAL_KEY",
            "fal_app_id_env": self.APP_ID_ENV,
            "input_dir": str(inp),
            "output_dir": str(out),
            "model": "isnet-general-use",
            "bg": None,
            "output_format": "png",
            "remote_timeout_seconds": 300,
        }

        result = _run_skill_with_config(self.SKILL, "rembg_batch.py", [], cfg, timeout=360)
        assert result.returncode == 0, (
            f"background-remover fal e2e failed\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )

        pngs = list(out.glob("*.png"))
        assert len(pngs) == 1, f"Expected 1 PNG output, got {len(pngs)}: {pngs}"

        with Image.open(pngs[0]) as img:
            assert img.mode == "RGBA", f"Expected RGBA, got {img.mode}"


# ---------------------------------------------------------------------------
# bokeh-effect
# ---------------------------------------------------------------------------

class TestFalBokehEffect:
    SKILL = "bokeh-effect"
    APP_ID_ENV = "FAL_APP_ID_BOKEH_EFFECT"

    @pytest.fixture
    def workdir(self, tmp_path):
        inp = tmp_path / "input"
        inp.mkdir()
        frames = sorted(TEST_FRAMES_DIR.glob("*.jpg"))
        assert frames, f"No test frames in {TEST_FRAMES_DIR}"
        shutil.copy(frames[0], inp)
        out = tmp_path / "output"
        out.mkdir()
        return inp, out

    @requires_fal_app("FAL_APP_ID_BOKEH_EFFECT")
    def test_produces_blurred_output(self, workdir):
        """Output image differs from input (bokeh blur applied on GPU)."""
        import numpy as np

        inp, out = workdir

        cfg = {
            "provider": "fal",
            "fal_api_key_env": "FAL_KEY",
            "fal_app_id_env": self.APP_ID_ENV,
            "input_dir": str(inp),
            "output_dir": str(out),
            "blur_strength": 15,
            "remote_timeout_seconds": 300,
        }

        result = _run_skill_with_config(self.SKILL, "bokeh.py", [], cfg, timeout=360)
        assert result.returncode == 0, (
            f"bokeh-effect fal e2e failed\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )

        outputs = list(out.iterdir())
        assert len(outputs) == 1, f"Expected 1 output, got {len(outputs)}"

        src_path = next(inp.glob("*.jpg"))
        src_arr = np.array(Image.open(src_path))
        dst_arr = np.array(Image.open(outputs[0]))
        diff = np.abs(src_arr.astype(int) - dst_arr.astype(int)).mean()
        assert diff > 0.5, f"Output identical to input (diff={diff:.3f}) — blur not applied"


# ---------------------------------------------------------------------------
# audio-splitter
# ---------------------------------------------------------------------------

class TestFalAudioSplitter:
    SKILL = "audio-splitter"
    APP_ID_ENV = "FAL_APP_ID_AUDIO_SPLITTER"

    @pytest.fixture
    def workdir(self, tmp_path):
        assert TEST_CLIP.exists(), f"Test clip not found: {TEST_CLIP}"
        inp = tmp_path / "input"
        inp.mkdir()
        audio_path = inp / "audio.wav"
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(TEST_CLIP), "-vn", "-acodec", "pcm_s16le",
             "-ar", "44100", "-ac", "2", str(audio_path)],
            check=True,
            capture_output=True,
        )
        out = tmp_path / "output"
        out.mkdir()
        return inp, out

    @requires_fal_app("FAL_APP_ID_AUDIO_SPLITTER")
    def test_produces_stems(self, workdir):
        """Demucs on fal produces at least 2 output audio stems."""
        inp, out = workdir

        cfg = {
            "provider": "fal",
            "fal_api_key_env": "FAL_KEY",
            "fal_app_id_env": self.APP_ID_ENV,
            "input_dir": str(inp),
            "output_dir": str(out),
            "model": "htdemucs",
            "stems": ["vocals", "other"],
            "remote_timeout_seconds": 600,
        }

        result = _run_skill_with_config(self.SKILL, "separate.py", [], cfg, timeout=660)
        assert result.returncode == 0, (
            f"audio-splitter fal e2e failed\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )

        outputs = [p for p in out.rglob("*") if p.is_file()]
        assert len(outputs) >= 2, (
            f"Expected ≥2 stem files, got {len(outputs)}: {[p.name for p in outputs]}"
        )
        for stem_path in outputs:
            assert stem_path.stat().st_size > 1024, (
                f"Stem file too small: {stem_path.name} ({stem_path.stat().st_size} bytes)"
            )


# ---------------------------------------------------------------------------
# frame-interpolator
# ---------------------------------------------------------------------------

class TestFalFrameInterpolator:
    SKILL = "frame-interpolator"
    APP_ID_ENV = "FAL_APP_ID_FRAME_INTERPOLATOR"

    @pytest.fixture
    def workdir(self, tmp_path):
        assert TEST_CLIP.exists(), f"Test clip not found: {TEST_CLIP}"
        inp = tmp_path / "input"
        inp.mkdir()
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(TEST_CLIP), "-vf", "fps=3", "-frames:v", "6",
             str(inp / "frame_%04d.jpg")],
            check=True,
            capture_output=True,
        )
        out = tmp_path / "output"
        out.mkdir()
        return inp, out

    @requires_fal_app("FAL_APP_ID_FRAME_INTERPOLATOR")
    def test_output_has_more_frames_than_input(self, workdir):
        """2× interpolation doubles frame count."""
        inp, out = workdir
        n_input = len(list(inp.glob("*.jpg")))

        cfg = {
            "provider": "fal",
            "fal_api_key_env": "FAL_KEY",
            "fal_app_id_env": self.APP_ID_ENV,
            "input_dir": str(inp),
            "output_dir": str(out),
            "multiplier": 2,
            "remote_timeout_seconds": 300,
        }

        result = _run_skill_with_config(self.SKILL, "interpolate.py", [], cfg, timeout=360)
        assert result.returncode == 0, (
            f"frame-interpolator fal e2e failed\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )

        n_output = len([p for p in out.rglob("*") if p.is_file()])
        assert n_output > n_input, (
            f"Expected more output frames than input ({n_input}), got {n_output}"
        )
