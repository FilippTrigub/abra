"""
test_runpod_e2e.py — End-to-end tests for RunPod Serverless GPU inference.

These tests require real RunPod endpoints and Backblaze B2 credentials.
They are skipped automatically when:
  - RUNPOD_ENDPOINT_ID_<SKILL> env var is not set
  - BACKBLAZE_B2_RUNPOD_* env vars are not set

All credentials are loaded from .env and backblaze.backup.env at the repo root.

Skills tested (in order of complexity):
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
# Env loading — parse KEY=value from .env files (no dotenv dependency needed)
# ---------------------------------------------------------------------------


def _parse_env_file(path: Path) -> dict[str, str]:
    """Parse a shell-style KEY=VALUE env file. Strips quotes. Ignores comments."""
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


def _build_runpod_env() -> dict[str, str]:
    """Merge shell env, .env, and backblaze.backup.env into a single dict."""
    env = {**os.environ}
    env.update(_parse_env_file(REPO_ROOT / ".env"))
    env.update(_parse_env_file(REPO_ROOT / "backblaze.backup.env"))
    return env


# Build once at module load so skip markers can interrogate it
_ENV = _build_runpod_env()

# ---------------------------------------------------------------------------
# Skip helpers
# ---------------------------------------------------------------------------

_B2_VARS = (
    "BACKBLAZE_B2_RUNPOD_KEY_ID",
    "BACKBLAZE_B2_RUNPOD_APPLICATION_KEY",
    "BACKBLAZE_B2_RUNPOD_BUCKET_NAME",
)


def _b2_configured() -> bool:
    return all(_ENV.get(k, "").strip() for k in _B2_VARS)


def _runpod_key_configured() -> bool:
    return bool(_ENV.get("RUNPOD_API_KEY", "").strip())


def requires_runpod_endpoint(endpoint_env: str):
    """Skip decorator: skip unless B2, API key, and endpoint ID are all set."""
    missing: list[str] = []
    if not _runpod_key_configured():
        missing.append("RUNPOD_API_KEY")
    if not _b2_configured():
        missing.extend(k for k in _B2_VARS if not _ENV.get(k, "").strip())
    if not _ENV.get(endpoint_env, "").strip():
        missing.append(endpoint_env)

    if missing:
        reason = f"RunPod e2e skipped — missing env vars: {', '.join(missing)}"
        return pytest.mark.skipif(True, reason=reason)
    return pytest.mark.skipif(False, reason="all RunPod vars present")


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
    """Write config to a temp file and run the skill via uv run."""
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
# background-remover — image → transparent PNG
# ---------------------------------------------------------------------------

class TestRunpodBackgroundRemover:
    """
    Full e2e: local JPEG → B2 staging → RunPod handler → rembg → B2 → local PNG.

    Verifies:
    - Exit code 0
    - One PNG output per input image
    - PNG is RGBA (transparent background when bg=null)
    - Output dimensions match input
    """

    SKILL = "background-remover"
    ENDPOINT_ENV = "RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER"

    @pytest.fixture
    def workdir(self, tmp_path):
        inp = tmp_path / "input"
        inp.mkdir()
        frames = sorted(TEST_FRAMES_DIR.glob("*.jpg"))
        assert frames, f"No test frames found in {TEST_FRAMES_DIR}"
        shutil.copy(frames[0], inp)  # single image — keep job fast
        out = tmp_path / "output"
        out.mkdir()
        return inp, out

    @requires_runpod_endpoint("RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER")
    def test_produces_rgba_png(self, workdir):
        """Single image goes through RunPod, comes back as RGBA PNG."""
        inp, out = workdir

        cfg = {
            "provider": "runpod",
            "runpod_api_key_env": "RUNPOD_API_KEY",
            "runpod_endpoint_id_env": self.ENDPOINT_ENV,
            "input_dir": str(inp),
            "output_dir": str(out),
            "device": "auto",
            "model": "isnet-general-use",
            "bg": None,
            "output_format": "png",
            "remote_timeout_seconds": 300,
        }

        result = _run_skill_with_config(
            self.SKILL, "rembg_batch.py", [], cfg, timeout=360
        )
        assert result.returncode == 0, (
            f"background-remover RunPod e2e failed\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}"
        )

        pngs = list(out.glob("*.png"))
        assert len(pngs) == 1, f"Expected 1 PNG output, got {len(pngs)}: {pngs}"

        with Image.open(pngs[0]) as img:
            assert img.mode == "RGBA", f"Expected RGBA, got {img.mode}"

    @requires_runpod_endpoint("RUNPOD_ENDPOINT_ID_BACKGROUND_REMOVER")
    def test_output_dimensions_match_input(self, workdir):
        """RunPod handler preserves image dimensions."""
        inp, out = workdir

        cfg = {
            "provider": "runpod",
            "runpod_api_key_env": "RUNPOD_API_KEY",
            "runpod_endpoint_id_env": self.ENDPOINT_ENV,
            "input_dir": str(inp),
            "output_dir": str(out),
            "device": "auto",
            "model": "isnet-general-use",
            "bg": None,
            "output_format": "png",
            "remote_timeout_seconds": 300,
        }

        _run_skill_with_config(self.SKILL, "rembg_batch.py", [], cfg, timeout=360)

        for jpg in inp.glob("*.jpg"):
            png = out / (jpg.stem + ".png")
            assert png.exists(), f"Expected output {png} not found"
            with Image.open(jpg) as src, Image.open(png) as dst:
                assert src.size == dst.size, (
                    f"Dimension mismatch: input {src.size} vs output {dst.size}"
                )


# ---------------------------------------------------------------------------
# bokeh-effect — image → bokeh blur PNG
# ---------------------------------------------------------------------------

class TestRunpodBokehEffect:
    """
    Full e2e: local JPEG → B2 → RunPod depth+bokeh → B2 → local JPG.
    """

    SKILL = "bokeh-effect"
    ENDPOINT_ENV = "RUNPOD_ENDPOINT_ID_BOKEH_EFFECT"

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

    @requires_runpod_endpoint("RUNPOD_ENDPOINT_ID_BOKEH_EFFECT")
    def test_produces_blurred_output(self, workdir):
        """Output image differs from input (blur applied on GPU)."""
        import numpy as np

        inp, out = workdir

        cfg = {
            "provider": "runpod",
            "runpod_api_key_env": "RUNPOD_API_KEY",
            "runpod_endpoint_id_env": self.ENDPOINT_ENV,
            "input_dir": str(inp),
            "output_dir": str(out),
            "device": "auto",
            "blur_strength": 15,
            "remote_timeout_seconds": 300,
        }

        result = _run_skill_with_config(
            self.SKILL, "bokeh.py", [], cfg, timeout=360
        )
        assert result.returncode == 0, (
            f"bokeh-effect RunPod e2e failed\n"
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
# audio-splitter — audio stems separation
# ---------------------------------------------------------------------------

class TestRunpodAudioSplitter:
    """
    Full e2e: audio track extracted from test clip → B2 → RunPod demucs → B2 → stems.

    Verifies vocals + accompaniment stems are produced and are non-empty audio files.
    """

    SKILL = "audio-splitter"
    ENDPOINT_ENV = "RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER"

    @pytest.fixture
    def workdir(self, tmp_path):
        assert TEST_CLIP.exists(), f"Test clip not found: {TEST_CLIP}"
        inp = tmp_path / "input"
        inp.mkdir()
        # Extract audio from test clip to WAV
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

    @requires_runpod_endpoint("RUNPOD_ENDPOINT_ID_AUDIO_SPLITTER")
    def test_produces_vocal_and_accompaniment_stems(self, workdir):
        """Demucs on RunPod produces at least 2 output audio stems."""
        inp, out = workdir

        cfg = {
            "provider": "runpod",
            "runpod_api_key_env": "RUNPOD_API_KEY",
            "runpod_endpoint_id_env": self.ENDPOINT_ENV,
            "input_dir": str(inp),
            "output_dir": str(out),
            "model": "htdemucs",
            "stems": ["vocals", "other"],
            "device": "auto",
            "remote_timeout_seconds": 600,
        }

        result = _run_skill_with_config(
            self.SKILL, "separate.py", [], cfg, timeout=660
        )
        assert result.returncode == 0, (
            f"audio-splitter RunPod e2e failed\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )

        outputs = [p for p in out.rglob("*") if p.is_file()]
        assert len(outputs) >= 2, (
            f"Expected ≥2 stem files, got {len(outputs)}: {[p.name for p in outputs]}"
        )
        for stem_path in outputs:
            assert stem_path.stat().st_size > 1024, (
                f"Stem file too small (likely empty): {stem_path.name} "
                f"({stem_path.stat().st_size} bytes)"
            )


# ---------------------------------------------------------------------------
# frame-interpolator — increase frame rate
# ---------------------------------------------------------------------------

class TestRunpodFrameInterpolator:
    """
    Full e2e: short video → extract frames → B2 → RunPod RIFE → B2 → interpolated frames.

    Verifies output frame count > input frame count (interpolation happened).
    """

    SKILL = "frame-interpolator"
    ENDPOINT_ENV = "RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR"

    @pytest.fixture
    def workdir(self, tmp_path):
        assert TEST_CLIP.exists(), f"Test clip not found: {TEST_CLIP}"
        inp = tmp_path / "input"
        inp.mkdir()
        # Extract 6 frames from clip (keeps job fast while proving interpolation)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(TEST_CLIP), "-vf", "fps=3", "-frames:v", "6",
             str(inp / "frame_%04d.jpg")],
            check=True,
            capture_output=True,
        )
        out = tmp_path / "output"
        out.mkdir()
        return inp, out

    @requires_runpod_endpoint("RUNPOD_ENDPOINT_ID_FRAME_INTERPOLATOR")
    def test_output_has_more_frames_than_input(self, workdir):
        """2× interpolation doubles frame count."""
        inp, out = workdir
        n_input = len(list(inp.glob("*.jpg")))

        cfg = {
            "provider": "runpod",
            "runpod_api_key_env": "RUNPOD_API_KEY",
            "runpod_endpoint_id_env": self.ENDPOINT_ENV,
            "input_dir": str(inp),
            "output_dir": str(out),
            "multiplier": 2,
            "device": "auto",
            "remote_timeout_seconds": 300,
        }

        result = _run_skill_with_config(
            self.SKILL, "interpolate.py", [], cfg, timeout=360
        )
        assert result.returncode == 0, (
            f"frame-interpolator RunPod e2e failed\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )

        n_output = len([p for p in out.rglob("*") if p.is_file()])
        assert n_output > n_input, (
            f"Expected more output frames than input ({n_input}), got {n_output}"
        )
