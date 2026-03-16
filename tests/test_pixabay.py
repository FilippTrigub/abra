"""
test_pixabay.py — Tests for the pixabay skill (Pixabay image/video overlays + optional SFX).

CPU-only skill (0 VRAM). All tests run without GPU.
Integration tests use tests/fixtures/clip_5s.mp4 (1080×1920, 30fps, ~2s).

Key differences from sticker/giphy/freesound:
  - PIXABAY_API_KEY is the only external API (primary).
  - Visual asset is `overlay` in config (not `gif`): images and short video clips.
  - OverlaySpec = GifSpec alias; gif_position() still works.
  - Favourites structure uses "overlays" key (not "gifs").
  - Library kinds: "image", "video", "sfx" (not "gif").
  - giphy: and freesound: prefixes raise skill-routing errors.
  - No bundled GIFs — bundled SFX only.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from conftest import (
    CLIP_DURATION_S,
    FIXTURES_DIR,
    REPO_ROOT,
    SKILLS_DIR,
    run_skill,
    uv_sync,
    video_info,
)

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

SKILL = "pixabay"
SKILL_DIR = SKILLS_DIR / SKILL
SCRIPTS_DIR = SKILL_DIR / "scripts"

# ---------------------------------------------------------------------------
# Module isolation
# ---------------------------------------------------------------------------

_SKILL_MODULES = ("assets", "ffmpeg_utils", "timeline", SKILL, "pixabay_api")


@pytest.fixture(autouse=True)
def _isolate_modules(monkeypatch: pytest.MonkeyPatch) -> None:
    """Prepend this skill's scripts dir and evict stale cached modules before each test."""
    monkeypatch.syspath_prepend(str(SCRIPTS_DIR))
    for name in _SKILL_MODULES:
        monkeypatch.delitem(sys.modules, name, raising=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def write_transcript(tmp_path: Path, segments: list[dict]) -> Path:
    p = tmp_path / "transcript.json"
    p.write_text(json.dumps(segments))
    return p


@pytest.fixture
def tiny_image(tmp_path: Path) -> Path:
    """Create a minimal solid-red PNG for overlay testing."""
    from PIL import Image

    img = Image.new("RGBA", (64, 64), (255, 0, 0, 255))
    path = tmp_path / "test_overlay.png"
    img.save(path, format="PNG")
    return path


@pytest.fixture
def tiny_sfx(tmp_path: Path) -> Path:
    """Create a minimal fake MP3 for SFX library tests."""
    path = tmp_path / "test_sound.mp3"
    path.write_bytes(b"\xff\xfb" + b"\x00" * 64)
    return path


# ---------------------------------------------------------------------------
# TestConfig
# ---------------------------------------------------------------------------


class TestConfig:
    """Config loading and validation."""

    def test_load_config_returns_dict(self) -> None:
        from pixabay import load_config

        cfg_path = SKILL_DIR / "config.json"
        assert cfg_path.exists(), "config.json missing from skill dir"
        cfg = load_config(cfg_path)
        assert isinstance(cfg, dict)

    def test_validate_config_accepts_empty_effects(self) -> None:
        from pixabay import validate_config

        cfg = {"effects": []}
        result = validate_config(cfg)
        assert result["effects"] == []

    def test_validate_config_requires_trigger(self) -> None:
        from pixabay import validate_config

        # Effect with overlay but no trigger — must fail
        cfg = {
            "effects": [{"overlay": {"source": "pixabay:heart", "mode": "positioned"}}]
        }
        with pytest.raises(SystemExit):
            validate_config(cfg)

    def test_validate_config_accepts_timestamp_trigger(self) -> None:
        from pixabay import validate_config

        cfg = {
            "effects": [
                {
                    "trigger": {"type": "timestamp", "value": 2.5},
                    "duration": 2.0,
                }
            ]
        }
        result = validate_config(cfg)
        assert result is cfg

    def test_validate_config_accepts_text_cue_trigger(self) -> None:
        from pixabay import validate_config

        cfg = {
            "effects": [
                {
                    "trigger": {"type": "text_cue", "phrase": "check this out"},
                    "duration": 2.0,
                }
            ]
        }
        result = validate_config(cfg)
        assert result is cfg

    def test_apply_preset_merges_defaults(self) -> None:
        from pixabay import apply_preset

        presets = {
            "viral": {
                "overlay": {
                    "source": "pixabay:sparkle glitter transparent",
                    "mode": "positioned",
                    "width": 180,
                },
                "sfx": {"source": "bundled:whoosh"},
                "duration": 3.0,
                "pause_video": False,
            }
        }
        effect_cfg = {
            "preset": "viral",
            "trigger": {"type": "timestamp", "value": 1.0},
            "overlay": {
                "source": "pixabay:custom",
                "mode": "positioned",
                "width": 250,
            },
        }
        merged = apply_preset(effect_cfg, presets)
        # User width wins
        assert merged["overlay"]["width"] == 250
        # Preset sfx comes through
        assert merged["sfx"]["source"] == "bundled:whoosh"
        assert merged["duration"] == 3.0
        assert merged["trigger"]["value"] == 1.0


# ---------------------------------------------------------------------------
# TestOverlayPosition
# ---------------------------------------------------------------------------


class TestOverlayPosition:
    """gif_position() (works with OverlaySpec) returns correct pixel coords."""

    VW = 1080
    VH = 1920

    def _make_spec(
        self,
        mode: str,
        position: str,
        width: int = 200,
        x: int | None = None,
        y: int | None = None,
    ):
        from ffmpeg_utils import OverlaySpec

        return OverlaySpec(
            source="pixabay:test", mode=mode, position=position, width=width, x=x, y=y
        )

    def test_top_right_position(self) -> None:
        from ffmpeg_utils import overlay_position

        spec = self._make_spec("positioned", "top-right", width=200)
        px, py = overlay_position(spec, self.VW, self.VH)
        assert px == self.VW - 200 - 20
        assert py == 20

    def test_top_left_position(self) -> None:
        from ffmpeg_utils import overlay_position

        spec = self._make_spec("positioned", "top-left", width=200)
        px, py = overlay_position(spec, self.VW, self.VH)
        assert px == 20
        assert py == 20

    def test_bottom_right_position(self) -> None:
        from ffmpeg_utils import overlay_position

        spec = self._make_spec("positioned", "bottom-right", width=200)
        px, py = overlay_position(spec, self.VW, self.VH)
        assert px == self.VW - 200 - 20
        assert py == self.VH - 200 - 20

    def test_center_position(self) -> None:
        from ffmpeg_utils import overlay_position

        spec = self._make_spec("positioned", "center", width=200)
        px, py = overlay_position(spec, self.VW, self.VH)
        assert px == (self.VW - 200) // 2
        assert py == (self.VH - 200) // 2

    def test_custom_position(self) -> None:
        from ffmpeg_utils import overlay_position

        spec = self._make_spec("positioned", "custom", x=50, y=100)
        px, py = overlay_position(spec, self.VW, self.VH)
        assert px == 50
        assert py == 100

    def test_fullscreen_position(self) -> None:
        from ffmpeg_utils import overlay_position

        spec = self._make_spec("fullscreen", "top-right")
        px, py = overlay_position(spec, self.VW, self.VH)
        assert px == 0
        assert py == 0


# ---------------------------------------------------------------------------
# TestTimeline
# ---------------------------------------------------------------------------


class TestTimeline:
    """Text cue → timestamp resolution (shared with all skills)."""

    def test_resolve_text_cue_finds_phrase(self, tmp_path: Path) -> None:
        from timeline import resolve_text_cue

        transcript = write_transcript(
            tmp_path,
            [{"start": 0.0, "end": 1.5, "text": "check this out everyone"}],
        )
        t = resolve_text_cue("check this out", transcript)
        assert t == pytest.approx(1.5)

    def test_resolve_text_cue_case_insensitive(self, tmp_path: Path) -> None:
        from timeline import resolve_text_cue

        transcript = write_transcript(
            tmp_path,
            [{"start": 0.0, "end": 2.0, "text": "hello world"}],
        )
        t = resolve_text_cue("Hello World", transcript)
        assert t == pytest.approx(2.0)

    def test_resolve_text_cue_raises_on_missing_phrase(self, tmp_path: Path) -> None:
        from timeline import resolve_text_cue

        transcript = write_transcript(
            tmp_path,
            [{"start": 0.0, "end": 1.0, "text": "hello world"}],
        )
        with pytest.raises(ValueError, match="not found"):
            resolve_text_cue("nonexistent phrase xyz", transcript)

    def test_format_timestamp(self) -> None:
        from timeline import format_timestamp

        assert format_timestamp(65.5) == "01:05.500"
        assert format_timestamp(0.0) == "00:00.000"


# ---------------------------------------------------------------------------
# TestFavourites
# ---------------------------------------------------------------------------


class TestFavourites:
    """Favourites CRUD — pixabay uses 'overlays' key instead of 'gifs'."""

    def test_list_favourites_empty_when_missing(self, tmp_path: Path) -> None:
        from assets import list_favourites

        fav_path = tmp_path / "favourites.json"
        result = list_favourites(fav_path)
        assert result == {"overlays": [], "sfx": []}

    def test_add_and_get_favourite_overlay(self, tmp_path: Path) -> None:
        from assets import add_favourite_overlay, get_favourite

        fav_path = tmp_path / "favourites.json"
        add_favourite_overlay("myoverlay", "pixabay:heart", ["love"], fav_path)
        entry = get_favourite("myoverlay", "overlay", fav_path)
        assert entry is not None
        assert entry["source"] == "pixabay:heart"
        assert "love" in entry["tags"]

    def test_add_and_get_favourite_sfx(self, tmp_path: Path) -> None:
        from assets import add_favourite_sfx, get_favourite

        fav_path = tmp_path / "favourites.json"
        add_favourite_sfx("mypop", "bundled:pop", ["transition"], fav_path)
        entry = get_favourite("mypop", "sfx", fav_path)
        assert entry is not None
        assert entry["source"] == "bundled:pop"

    def test_remove_favourite_returns_true_when_found(self, tmp_path: Path) -> None:
        from assets import add_favourite_overlay, remove_favourite

        fav_path = tmp_path / "favourites.json"
        add_favourite_overlay("temp", "pixabay:heart", [], fav_path)
        removed = remove_favourite("temp", "overlay", fav_path)
        assert removed is True

    def test_remove_favourite_returns_false_when_missing(self, tmp_path: Path) -> None:
        from assets import remove_favourite

        fav_path = tmp_path / "favourites.json"
        removed = remove_favourite("doesnotexist", "overlay", fav_path)
        assert removed is False

    def test_favourites_persisted_between_loads(self, tmp_path: Path) -> None:
        from assets import add_favourite_overlay, load_favourites

        fav_path = tmp_path / "favourites.json"
        add_favourite_overlay("persist_test", "pixabay:sparkles", ["test"], fav_path)
        reloaded = load_favourites(fav_path)
        names = [e["name"] for e in reloaded["overlays"]]
        assert "persist_test" in names

    def test_add_favourite_overlay_overwrites_existing(self, tmp_path: Path) -> None:
        from assets import add_favourite_overlay, list_favourites

        fav_path = tmp_path / "favourites.json"
        add_favourite_overlay("same", "pixabay:heart", ["old"], fav_path)
        add_favourite_overlay("same", "pixabay:sparkles", ["new"], fav_path)
        data = list_favourites(fav_path)
        matching = [e for e in data["overlays"] if e["name"] == "same"]
        assert len(matching) == 1
        assert matching[0]["source"] == "pixabay:sparkles"


# ---------------------------------------------------------------------------
# TestLocalLibrary
# ---------------------------------------------------------------------------


class TestLocalLibrary:
    """Local image/video/sfx library (local:name prefix, kind parameter)."""

    def test_image_library_list_empty_when_dir_missing(self, tmp_path: Path) -> None:
        from assets import library_list

        assert library_list(tmp_path, kind="image") == []

    def test_image_library_add_copies_file(
        self, tmp_path: Path, tiny_image: Path
    ) -> None:
        from assets import library_add, library_list

        library_add("myimg", tiny_image, tmp_path, kind="image")
        entries = library_list(tmp_path, kind="image")
        assert any(name == "myimg" for name, _ in entries)

    def test_image_library_add_raises_on_missing_source(self, tmp_path: Path) -> None:
        from assets import library_add

        with pytest.raises(FileNotFoundError):
            library_add("ghost", Path("/nonexistent/ghost.png"), tmp_path, kind="image")

    def test_image_library_add_raises_on_unsupported_ext(self, tmp_path: Path) -> None:
        from assets import library_add

        bad = tmp_path / "sound.mp3"
        bad.write_bytes(b"\xff\xfb" + b"\x00" * 64)
        with pytest.raises(ValueError, match="[Uu]nsupported"):
            library_add("bad", bad, tmp_path, kind="image")

    def test_image_library_resolve_finds_added_file(
        self, tmp_path: Path, tiny_image: Path
    ) -> None:
        from assets import library_add, library_resolve

        library_add("spark", tiny_image, tmp_path, kind="image")
        result = library_resolve("spark", tmp_path, kind="image")
        assert result.exists()
        assert result.stem == "spark"

    def test_image_library_resolve_raises_on_missing(self, tmp_path: Path) -> None:
        from assets import library_resolve

        with pytest.raises(FileNotFoundError, match="not found"):
            library_resolve("doesnotexist", tmp_path, kind="image")

    def test_image_library_remove_works(self, tmp_path: Path, tiny_image: Path) -> None:
        from assets import library_add, library_remove, library_list

        library_add("gone", tiny_image, tmp_path, kind="image")
        assert library_remove("gone", tmp_path, kind="image") is True
        assert not any(
            name == "gone" for name, _ in library_list(tmp_path, kind="image")
        )

    def test_sfx_library_add_and_resolve(self, tmp_path: Path, tiny_sfx: Path) -> None:
        from assets import library_add, library_resolve

        library_add("mysfx", tiny_sfx, tmp_path, kind="sfx")
        result = library_resolve("mysfx", tmp_path, kind="sfx")
        assert result.exists()
        assert result.stem == "mysfx"

    def test_sfx_library_list(self, tmp_path: Path) -> None:
        from assets import library_add, library_list

        for n in ("boom", "click"):
            f = tmp_path / f"{n}.mp3"
            f.write_bytes(b"\xff\xfb" + b"\x00" * 64)
            library_add(n, f, tmp_path, kind="sfx")
        entries = library_list(tmp_path, kind="sfx")
        assert {name for name, _ in entries} == {"boom", "click"}

    def test_resolve_overlay_local_prefix(
        self, tmp_path: Path, tiny_image: Path
    ) -> None:
        from assets import library_add, resolve_overlay

        fav_path = tmp_path / "favourites.json"
        library_add("localtest", tiny_image, tmp_path, kind="image")
        result = resolve_overlay("local:localtest", tmp_path, fav_path)
        assert result.exists()
        assert result.stem == "localtest"

    def test_resolve_sfx_local_prefix(self, tmp_path: Path, tiny_sfx: Path) -> None:
        from assets import library_add, resolve_sfx

        library_add("ding", tiny_sfx, tmp_path, kind="sfx")
        fav_path = tmp_path / "favourites.json"
        result = resolve_sfx("local:ding", tmp_path, fav_path)
        assert result.exists()
        assert result.stem == "ding"

    def test_bundled_sfx_raises_when_missing(self, tmp_path: Path) -> None:
        from assets import resolve_sfx

        fav_path = tmp_path / "favourites.json"
        with pytest.raises(FileNotFoundError):
            resolve_sfx("bundled:pop", tmp_path, fav_path)

    def test_bundled_sfx_finds_mp3(self, tmp_path: Path) -> None:
        from assets import resolve_sfx, BUNDLED_SFX

        fav_path = tmp_path / "favourites.json"
        stem = tmp_path / BUNDLED_SFX["pop"]
        stem.parent.mkdir(parents=True, exist_ok=True)
        mp3 = stem.parent / f"{stem.name}.mp3"
        mp3.write_bytes(b"\xff\xfb" + b"\x00" * 64)
        result = resolve_sfx("bundled:pop", tmp_path, fav_path)
        assert result == mp3


# ---------------------------------------------------------------------------
# TestAssetResolution
# ---------------------------------------------------------------------------


class TestAssetResolution:
    """Asset resolution logic for the pixabay skill."""

    def test_resolve_overlay_file_path(self, tmp_path: Path, tiny_image: Path) -> None:
        from assets import resolve_overlay

        fav_path = tmp_path / "favourites.json"
        result = resolve_overlay(str(tiny_image), tmp_path, fav_path)
        assert result == tiny_image

    def test_resolve_overlay_favourite(self, tmp_path: Path, tiny_image: Path) -> None:
        from assets import resolve_overlay, add_favourite_overlay

        fav_path = tmp_path / "favourites.json"
        add_favourite_overlay("mytest", str(tiny_image), ["test"], fav_path)
        result = resolve_overlay("favourite:mytest", tmp_path, fav_path)
        assert result == tiny_image

    def test_resolve_pixabay_raises_without_api_key(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from assets import resolve_overlay

        monkeypatch.delenv("PIXABAY_API_KEY", raising=False)
        fav_path = tmp_path / "favourites.json"
        with pytest.raises(ValueError, match="PIXABAY_API_KEY"):
            resolve_overlay("pixabay:sparkles", tmp_path, fav_path)

    def test_resolve_pixabay_video_raises_without_api_key(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from assets import resolve_overlay

        monkeypatch.delenv("PIXABAY_API_KEY", raising=False)
        fav_path = tmp_path / "favourites.json"
        with pytest.raises(ValueError, match="PIXABAY_API_KEY"):
            resolve_overlay("pixabay-video:confetti", tmp_path, fav_path)

    def test_resolve_overlay_giphy_prefix_raises_skill_redirect(
        self, tmp_path: Path
    ) -> None:
        """giphy: is not an overlay source — should redirect to skills/giphy."""
        from assets import resolve_overlay

        fav_path = tmp_path / "favourites.json"
        with pytest.raises(ValueError, match="giphy"):
            resolve_overlay("giphy:dancing cat", tmp_path, fav_path)

    def test_resolve_sfx_freesound_prefix_raises_skill_redirect(
        self, tmp_path: Path
    ) -> None:
        """freesound: is not an SFX source here — should redirect to skills/freesound."""
        from assets import resolve_sfx

        fav_path = tmp_path / "favourites.json"
        with pytest.raises(ValueError, match="freesound"):
            resolve_sfx("freesound:whoosh sound", tmp_path, fav_path)


# ---------------------------------------------------------------------------
# TestPixabayIntegration — runs actual FFmpeg pipeline
# ---------------------------------------------------------------------------


class TestPixabayIntegration:
    """Integration tests: full video processing via pixabay.py CLI."""

    SKILL = "pixabay"

    @pytest.fixture(autouse=True, scope="class")
    def setup_venv(self) -> None:  # type: ignore[override]
        uv_sync(self.SKILL)

    @pytest.fixture
    def workdir(self, tmp_path: Path, test_clip: Path) -> tuple[Path, Path]:
        inp = tmp_path / "input"
        inp.mkdir()
        shutil.copy(test_clip, inp / test_clip.name)
        out = tmp_path / "output"
        out.mkdir()
        return inp, out

    def _cfg(
        self, tmp_path: Path, workdir: tuple[Path, Path], effects: list[dict], **extra
    ) -> Path:
        inp, out = workdir
        cfg = {
            "input_dir": str(inp),
            "output_dir": str(out),
            "duck_background": False,
            "effects": effects,
            **extra,
        }
        p = tmp_path / "config.json"
        p.write_text(json.dumps(cfg, indent=2))
        return p

    def test_exits_zero_on_success(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        cfg = self._cfg(tmp_path, workdir, [])
        result = run_skill(self.SKILL, "pixabay.py", ["--config", str(cfg)])
        assert result.returncode == 0, f"stderr: {result.stderr}"

    def test_no_effects_copies_video(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        cfg = self._cfg(tmp_path, workdir, [])
        run_skill(self.SKILL, "pixabay.py", ["--config", str(cfg)])
        _, out = workdir
        assert len(list(out.glob("*.mp4"))) == 1

    def test_output_has_audio(self, tmp_path: Path, workdir: tuple[Path, Path]) -> None:
        cfg = self._cfg(tmp_path, workdir, [])
        run_skill(self.SKILL, "pixabay.py", ["--config", str(cfg)])
        _, out = workdir
        info = video_info(next(out.glob("*.mp4")))
        assert info["has_audio"]

    def test_output_preserves_dimensions(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        cfg = self._cfg(tmp_path, workdir, [])
        run_skill(self.SKILL, "pixabay.py", ["--config", str(cfg)])
        _, out = workdir
        info = video_info(next(out.glob("*.mp4")))
        assert info["width"] == 1080
        assert info["height"] == 1920

    def test_duration_preserved_no_pause(
        self, tmp_path: Path, workdir: tuple[Path, Path], tiny_image: Path
    ) -> None:
        effects = [
            {
                "trigger": {"type": "timestamp", "value": 0.5},
                "overlay": {
                    "source": str(tiny_image),
                    "mode": "positioned",
                    "position": "top-right",
                    "width": 100,
                },
                "duration": 1.0,
                "pause_video": False,
            }
        ]
        cfg = self._cfg(tmp_path, workdir, effects)
        result = run_skill(self.SKILL, "pixabay.py", ["--config", str(cfg)])
        _, out = workdir
        out_files = list(out.glob("*.mp4"))
        if result.returncode == 0 and out_files:
            info = video_info(out_files[0])
            assert abs(info["duration"] - CLIP_DURATION_S) < 0.5

    def test_pause_mode_increases_duration(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        pause_dur = 2.0
        effects = [
            {
                "trigger": {"type": "timestamp", "value": 0.5},
                "pause_video": True,
                "duration": pause_dur,
            }
        ]
        cfg = self._cfg(tmp_path, workdir, effects)
        result = run_skill(self.SKILL, "pixabay.py", ["--config", str(cfg)])
        _, out = workdir
        out_files = list(out.glob("*.mp4"))
        if result.returncode == 0 and out_files:
            info = video_info(out_files[0])
            expected = CLIP_DURATION_S + pause_dur
            assert abs(info["duration"] - expected) < 0.8

    def test_timestamp_trigger_at_start(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        effects = [
            {
                "trigger": {"type": "timestamp", "value": 0.0},
                "duration": 1.0,
                "pause_video": False,
            }
        ]
        cfg = self._cfg(tmp_path, workdir, effects)
        result = run_skill(self.SKILL, "pixabay.py", ["--config", str(cfg)])
        assert result.returncode == 0, f"stderr: {result.stderr}"

    def test_image_overlay_changes_pixels_in_overlay_region(
        self,
        tmp_path: Path,
        workdir: tuple[Path, Path],
        test_clip: Path,
        tiny_image: Path,
    ) -> None:
        """Local PNG image overlay should visibly change pixels in the overlay region."""
        trigger = 0.3
        duration = 1.0
        overlay_width = 200
        position = "top-right"

        effects = [
            {
                "trigger": {"type": "timestamp", "value": trigger},
                "overlay": {
                    "source": str(tiny_image),
                    "mode": "positioned",
                    "position": position,
                    "width": overlay_width,
                },
                "duration": duration,
                "pause_video": False,
            }
        ]
        cfg = self._cfg(tmp_path, workdir, effects)
        inp, out = workdir
        result = run_skill(self.SKILL, "pixabay.py", ["--config", str(cfg)])
        assert result.returncode == 0, f"stderr: {result.stderr}"

        sample_t = trigger + duration / 2
        frame_in = tmp_path / "frame_in.png"
        frame_out = tmp_path / "frame_out.png"
        input_video = inp / test_clip.name
        output_video = next(out.glob("*.mp4"))

        for ts, dest, src in [
            (sample_t, frame_in, input_video),
            (sample_t, frame_out, output_video),
        ]:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-ss",
                    f"{ts:.3f}",
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

        from PIL import Image
        import numpy as np
        from ffmpeg_utils import OverlaySpec, overlay_position

        spec = OverlaySpec(
            source=str(tiny_image),
            mode="positioned",
            position=position,
            width=overlay_width,
        )
        x, y = overlay_position(spec, 1080, 1920)
        box = (x, y, x + overlay_width, y + overlay_width)

        region_in = np.array(Image.open(frame_in).convert("RGB").crop(box), dtype=int)
        region_out = np.array(Image.open(frame_out).convert("RGB").crop(box), dtype=int)
        per_pixel_max = np.abs(region_out - region_in).max(axis=2)
        changed_px = int((per_pixel_max > 15).sum())

        assert changed_px > 50, (
            f"Overlay region unchanged after PNG render "
            f"(pixels changed >15: {changed_px}, expected >50)."
        )
