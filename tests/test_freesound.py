"""
test_freesound.py — Tests for the freesound skill (Freesound SFX + optional GIF overlays).

CPU-only skill (0 VRAM). All tests run without GPU.
Integration tests use tests/fixtures/clip_5s.mp4 (1080×1920, 30fps, ~2s).

Key differences from sticker:
  - FREESOUND_API_KEY is the only external API (primary).
  - SFX is the primary feature; GIFs are optional companions.
  - giphy: prefix in resolve_gif() raises a skill-routing error (not API error).
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

SKILL = "freesound"
SKILL_DIR = SKILLS_DIR / SKILL
SCRIPTS_DIR = SKILL_DIR / "scripts"

# ---------------------------------------------------------------------------
# Module isolation
# ---------------------------------------------------------------------------

_SKILL_MODULES = ("assets", "ffmpeg_utils", "timeline", SKILL)


@pytest.fixture(autouse=True)
def _isolate_modules(monkeypatch: pytest.MonkeyPatch) -> None:
    """Prepend this skill's scripts dir and evict stale cached modules before each test."""
    monkeypatch.syspath_prepend(str(SCRIPTS_DIR))
    for name in _SKILL_MODULES:
        monkeypatch.delitem(sys.modules, name, raising=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def write_config(tmp_path: Path, effects: list[dict], **extra) -> Path:
    (tmp_path / "input").mkdir(exist_ok=True)
    (tmp_path / "output").mkdir(exist_ok=True)
    cfg = {
        "input_dir": str(tmp_path / "input"),
        "output_dir": str(tmp_path / "output"),
        "duck_background": False,
        "effects": effects,
        **extra,
    }
    cfg_path = tmp_path / "config.json"
    cfg_path.write_text(json.dumps(cfg, indent=2))
    return cfg_path


def write_transcript(tmp_path: Path, segments: list[dict]) -> Path:
    p = tmp_path / "transcript.json"
    p.write_text(json.dumps(segments))
    return p


@pytest.fixture
def tiny_gif(tmp_path: Path) -> Path:
    """Create a minimal valid 2-frame animated GIF for testing."""
    from PIL import Image

    frames = [
        Image.new("RGBA", (32, 32), (255, 0, 0, 200)),
        Image.new("RGBA", (32, 32), (200, 0, 0, 200)),
    ]
    path = tmp_path / "test.gif"
    frames[0].save(path, save_all=True, append_images=frames[1:], loop=0, format="GIF")
    return path


# ---------------------------------------------------------------------------
# TestConfig
# ---------------------------------------------------------------------------


class TestConfig:
    """Config loading and validation."""

    def test_load_config_returns_dict(self) -> None:
        from freesound import load_config

        cfg_path = SKILL_DIR / "config.json"
        assert cfg_path.exists(), "config.json missing from skill dir"
        cfg = load_config(cfg_path)
        assert isinstance(cfg, dict)

    def test_validate_config_accepts_empty_effects(self) -> None:
        from freesound import validate_config

        cfg = {"effects": []}
        result = validate_config(cfg)
        assert result["effects"] == []

    def test_validate_config_requires_trigger(self, tmp_path: Path) -> None:
        from freesound import validate_config

        cfg = {"effects": [{"sfx": {"source": "bundled:pop"}}]}
        with pytest.raises(SystemExit):
            validate_config(cfg)

    def test_validate_config_accepts_timestamp_trigger(self) -> None:
        from freesound import validate_config

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
        from freesound import validate_config

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
        from freesound import apply_preset

        presets = {
            "viral": {
                "sfx": {"source": "bundled:whoosh"},
                "gif": {
                    "source": "bundled:sparkles",
                    "mode": "positioned",
                    "width": 180,
                },
                "duration": 3.0,
                "pause_video": False,
            }
        }
        # User overrides SFX volume — preset gif and duration come through
        effect_cfg = {
            "preset": "viral",
            "trigger": {"type": "timestamp", "value": 1.0},
            "sfx": {"source": "bundled:whoosh", "volume": 0.5},
        }
        merged = apply_preset(effect_cfg, presets)
        assert merged["sfx"]["volume"] == 0.5
        assert merged["gif"]["source"] == "bundled:sparkles"
        assert merged["duration"] == 3.0
        assert merged["trigger"]["value"] == 1.0


# ---------------------------------------------------------------------------
# TestGifPosition
# ---------------------------------------------------------------------------


class TestGifPosition:
    """gif_position() returns correct pixel coords."""

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
        from ffmpeg_utils import GifSpec

        return GifSpec(
            source="bundled:heart", mode=mode, position=position, width=width, x=x, y=y
        )

    def test_top_right_position(self) -> None:
        from ffmpeg_utils import gif_position

        spec = self._make_spec("positioned", "top-right", width=200)
        px, py = gif_position(spec, self.VW, self.VH)
        assert px == self.VW - 200 - 20
        assert py == 20

    def test_top_left_position(self) -> None:
        from ffmpeg_utils import gif_position

        spec = self._make_spec("positioned", "top-left", width=200)
        px, py = gif_position(spec, self.VW, self.VH)
        assert px == 20
        assert py == 20

    def test_bottom_right_position(self) -> None:
        from ffmpeg_utils import gif_position

        spec = self._make_spec("positioned", "bottom-right", width=200)
        px, py = gif_position(spec, self.VW, self.VH)
        assert px == self.VW - 200 - 20
        assert py == self.VH - 200 - 20

    def test_center_position(self) -> None:
        from ffmpeg_utils import gif_position

        spec = self._make_spec("positioned", "center", width=200)
        px, py = gif_position(spec, self.VW, self.VH)
        assert px == (self.VW - 200) // 2
        assert py == (self.VH - 200) // 2

    def test_custom_position(self) -> None:
        from ffmpeg_utils import gif_position

        spec = self._make_spec("positioned", "custom", x=50, y=100)
        px, py = gif_position(spec, self.VW, self.VH)
        assert px == 50
        assert py == 100

    def test_fullscreen_position(self) -> None:
        from ffmpeg_utils import gif_position

        spec = self._make_spec("fullscreen", "top-right")
        px, py = gif_position(spec, self.VW, self.VH)
        assert px == 0
        assert py == 0


# ---------------------------------------------------------------------------
# TestTimeline
# ---------------------------------------------------------------------------


class TestTimeline:
    """Text cue → timestamp resolution."""

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

    def test_resolve_text_cue_cross_segment(self, tmp_path: Path) -> None:
        from timeline import resolve_text_cue

        transcript = write_transcript(
            tmp_path,
            [
                {"start": 0.0, "end": 1.0, "text": "and this is"},
                {"start": 1.0, "end": 2.5, "text": "really amazing stuff"},
            ],
        )
        t = resolve_text_cue("is really", transcript)
        assert t == pytest.approx(2.5)

    def test_resolve_text_cue_raises_on_missing_phrase(self, tmp_path: Path) -> None:
        from timeline import resolve_text_cue

        transcript = write_transcript(
            tmp_path,
            [{"start": 0.0, "end": 1.0, "text": "hello world"}],
        )
        with pytest.raises(ValueError, match="not found"):
            resolve_text_cue("nonexistent phrase xyz", transcript)

    def test_load_transcript_parses_verbatim_format(self, tmp_path: Path) -> None:
        from timeline import load_transcript

        segments = [
            {"start": 0.0, "end": 1.2, "text": "hello world"},
            {"start": 1.2, "end": 2.8, "text": "foo bar baz"},
        ]
        path = write_transcript(tmp_path, segments)
        loaded = load_transcript(path)
        assert len(loaded) == 2
        assert loaded[0]["text"] == "hello world"
        assert loaded[1]["end"] == pytest.approx(2.8)

    def test_format_timestamp(self) -> None:
        from timeline import format_timestamp

        assert format_timestamp(65.5) == "01:05.500"
        assert format_timestamp(0.0) == "00:00.000"
        assert format_timestamp(3723.1) == "62:03.100"


# ---------------------------------------------------------------------------
# TestFavourites
# ---------------------------------------------------------------------------


class TestFavourites:
    """Favourites CRUD."""

    def test_list_favourites_empty_when_missing(self, tmp_path: Path) -> None:
        from assets import list_favourites

        fav_path = tmp_path / "favourites.json"
        result = list_favourites(fav_path)
        assert result == {"gifs": [], "sfx": []}

    def test_add_and_get_favourite_gif(self, tmp_path: Path) -> None:
        from assets import add_favourite_gif, get_favourite

        fav_path = tmp_path / "favourites.json"
        add_favourite_gif("myheart", "bundled:heart", ["love"], fav_path)
        entry = get_favourite("myheart", "gif", fav_path)
        assert entry is not None
        assert entry["source"] == "bundled:heart"

    def test_add_and_get_favourite_sfx(self, tmp_path: Path) -> None:
        from assets import add_favourite_sfx, get_favourite

        fav_path = tmp_path / "favourites.json"
        add_favourite_sfx("mypop", "bundled:pop", ["transition"], fav_path)
        entry = get_favourite("mypop", "sfx", fav_path)
        assert entry is not None
        assert entry["source"] == "bundled:pop"

    def test_remove_favourite_returns_true_when_found(self, tmp_path: Path) -> None:
        from assets import add_favourite_sfx, remove_favourite

        fav_path = tmp_path / "favourites.json"
        add_favourite_sfx("temp", "bundled:pop", [], fav_path)
        removed = remove_favourite("temp", "sfx", fav_path)
        assert removed is True

    def test_remove_favourite_returns_false_when_missing(self, tmp_path: Path) -> None:
        from assets import remove_favourite

        fav_path = tmp_path / "favourites.json"
        removed = remove_favourite("doesnotexist", "sfx", fav_path)
        assert removed is False

    def test_favourites_persisted_between_loads(self, tmp_path: Path) -> None:
        from assets import add_favourite_sfx, load_favourites

        fav_path = tmp_path / "favourites.json"
        add_favourite_sfx("persist_test", "bundled:pop", ["test"], fav_path)
        reloaded = load_favourites(fav_path)
        names = [e["name"] for e in reloaded["sfx"]]
        assert "persist_test" in names

    def test_add_favourite_overwrites_existing(self, tmp_path: Path) -> None:
        from assets import add_favourite_sfx, list_favourites

        fav_path = tmp_path / "favourites.json"
        add_favourite_sfx("same", "bundled:pop", ["old"], fav_path)
        add_favourite_sfx("same", "bundled:whoosh", ["new"], fav_path)
        data = list_favourites(fav_path)
        matching = [e for e in data["sfx"] if e["name"] == "same"]
        assert len(matching) == 1
        assert matching[0]["source"] == "bundled:whoosh"


# ---------------------------------------------------------------------------
# TestLocalLibrary
# ---------------------------------------------------------------------------


class TestLocalLibrary:
    """Local library (local:name prefix) for GIFs and sounds."""

    def test_library_list_empty_when_dir_missing(self, tmp_path: Path) -> None:
        from assets import library_list

        assert library_list(tmp_path) == []

    def test_library_add_copies_file(self, tmp_path: Path, tiny_gif: Path) -> None:
        from assets import library_add, library_list

        library_add("mystic", tiny_gif, tmp_path)
        entries = library_list(tmp_path)
        assert any(name == "mystic" for name, _ in entries)

    def test_library_add_raises_on_missing_source(self, tmp_path: Path) -> None:
        from assets import library_add

        with pytest.raises(FileNotFoundError):
            library_add("ghost", Path("/nonexistent/ghost.gif"), tmp_path)

    def test_library_add_raises_on_unsupported_ext(self, tmp_path: Path) -> None:
        from assets import library_add

        mp4 = tmp_path / "clip.mp4"
        mp4.write_bytes(b"fake")
        with pytest.raises(ValueError, match="Unsupported"):
            library_add("clip", mp4, tmp_path)

    def test_library_resolve_finds_added_file(
        self, tmp_path: Path, tiny_gif: Path
    ) -> None:
        from assets import library_add, library_resolve

        library_add("spark", tiny_gif, tmp_path)
        result = library_resolve("spark", tmp_path)
        assert result.exists()
        assert result.stem == "spark"

    def test_library_resolve_raises_on_missing(self, tmp_path: Path) -> None:
        from assets import library_resolve

        with pytest.raises(FileNotFoundError, match="not found in library"):
            library_resolve("doesnotexist", tmp_path)

    def test_library_sfx_add_and_resolve(self, tmp_path: Path) -> None:
        from assets import library_add, library_resolve

        sfx = tmp_path / "test_sound.mp3"
        sfx.write_bytes(b"\xff\xfb" + b"\x00" * 64)
        library_add("mysfx", sfx, tmp_path, kind="sfx")
        result = library_resolve("mysfx", tmp_path, kind="sfx")
        assert result.exists()
        assert result.stem == "mysfx"

    def test_library_sfx_list(self, tmp_path: Path) -> None:
        from assets import library_add, library_list

        for n in ("boom", "click"):
            f = tmp_path / f"{n}.mp3"
            f.write_bytes(b"\xff\xfb" + b"\x00" * 64)
            library_add(n, f, tmp_path, kind="sfx")
        entries = library_list(tmp_path, kind="sfx")
        assert {name for name, _ in entries} == {"boom", "click"}

    def test_resolve_sfx_local_prefix(self, tmp_path: Path) -> None:
        from assets import library_add, resolve_sfx

        sfx = tmp_path / "ding.mp3"
        sfx.write_bytes(b"\xff\xfb" + b"\x00" * 64)
        library_add("ding", sfx, tmp_path, kind="sfx")
        fav_path = tmp_path / "favourites.json"
        result = resolve_sfx("local:ding", tmp_path, fav_path)
        assert result.exists()
        assert result.stem == "ding"

    def test_resolve_gif_local_prefix(self, tmp_path: Path, tiny_gif: Path) -> None:
        from assets import library_add, resolve_gif

        fav_path = tmp_path / "favourites.json"
        library_add("localtest", tiny_gif, tmp_path)
        result = resolve_gif("local:localtest", tmp_path, fav_path)
        assert result.exists()
        assert result.stem == "localtest"

    def test_bundled_sfx_raises_when_missing(self, tmp_path: Path) -> None:
        from assets import resolve_sfx

        fav_path = tmp_path / "favourites.json"
        with pytest.raises(FileNotFoundError, match="download_freesound_presets"):
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
    """Asset resolution logic."""

    def test_resolve_bundled_gif_returns_path(self, tmp_path: Path) -> None:
        from assets import resolve_gif, BUNDLED_GIFS

        skill_dir = tmp_path / "freesound"
        gif_path = skill_dir / BUNDLED_GIFS["heart"]
        gif_path.parent.mkdir(parents=True, exist_ok=True)
        gif_path.write_bytes(b"GIF89a")
        fav_path = tmp_path / "favourites.json"
        result = resolve_gif("bundled:heart", skill_dir, fav_path)
        assert result == gif_path

    def test_resolve_local_path_gif(self, tmp_path: Path, tiny_gif: Path) -> None:
        from assets import resolve_gif

        fav_path = tmp_path / "favourites.json"
        result = resolve_gif(str(tiny_gif), tmp_path, fav_path)
        assert result == tiny_gif

    def test_resolve_favourite_sfx(self, tmp_path: Path) -> None:
        from assets import resolve_sfx, add_favourite_sfx

        sfx = tmp_path / "test.mp3"
        sfx.write_bytes(b"\xff\xfb" + b"\x00" * 64)
        fav_path = tmp_path / "favourites.json"
        add_favourite_sfx("mytest", str(sfx), ["test"], fav_path)
        result = resolve_sfx("favourite:mytest", tmp_path, fav_path)
        assert result == sfx

    def test_resolve_freesound_raises_without_api_key(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """freesound: is the primary API — raises ValueError when key missing."""
        from assets import resolve_sfx

        monkeypatch.delenv("FREESOUND_API_KEY", raising=False)
        fav_path = tmp_path / "favourites.json"
        with pytest.raises(ValueError, match="FREESOUND_API_KEY"):
            resolve_sfx("freesound:whoosh sound", tmp_path, fav_path)

    def test_resolve_giphy_prefix_raises_skill_redirect(self, tmp_path: Path) -> None:
        """giphy: is not supported in the freesound skill — should redirect to skills/giphy."""
        from assets import resolve_gif

        fav_path = tmp_path / "favourites.json"
        with pytest.raises(ValueError, match="giphy"):
            resolve_gif("giphy:dancing cat", tmp_path, fav_path)


# ---------------------------------------------------------------------------
# TestFreesoundIntegration — runs actual FFmpeg pipeline
# ---------------------------------------------------------------------------


class TestFreesoundIntegration:
    """Integration tests: full video processing via freesound.py CLI."""

    SKILL = "freesound"

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
        result = run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
        assert result.returncode == 0, f"stderr: {result.stderr}"

    def test_no_effects_copies_video(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        cfg = self._cfg(tmp_path, workdir, [])
        run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
        _, out = workdir
        assert len(list(out.glob("*.mp4"))) == 1

    def test_output_has_audio(self, tmp_path: Path, workdir: tuple[Path, Path]) -> None:
        cfg = self._cfg(tmp_path, workdir, [])
        run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
        _, out = workdir
        info = video_info(next(out.glob("*.mp4")))
        assert info["has_audio"]

    def test_output_preserves_dimensions(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        cfg = self._cfg(tmp_path, workdir, [])
        run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
        _, out = workdir
        info = video_info(next(out.glob("*.mp4")))
        assert info["width"] == 1080
        assert info["height"] == 1920

    def test_sfx_only_effect_no_gif(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        """SFX-only effect (no gif key) is the primary use case for freesound."""
        effects = [
            {
                "trigger": {"type": "timestamp", "value": 0.5},
                "sfx": {"source": "bundled:pop", "volume": 0.8},
                "duration": 1.0,
                "pause_video": False,
            }
        ]
        cfg = self._cfg(tmp_path, workdir, effects)
        result = run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
        # bundled SFX might not be downloaded, so we allow warn-and-skip behaviour
        assert result.returncode == 0, f"stderr: {result.stderr}"

    def test_duration_preserved_no_pause(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        effects = [
            {
                "trigger": {"type": "timestamp", "value": 0.5},
                "gif": {
                    "source": "bundled:heart",
                    "mode": "positioned",
                    "position": "top-right",
                },
                "duration": 1.0,
                "pause_video": False,
            }
        ]
        cfg = self._cfg(tmp_path, workdir, effects)
        result = run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
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
        result = run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
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
        result = run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
        assert result.returncode == 0, f"stderr: {result.stderr}"

    def test_preset_viral_runs_successfully(
        self, tmp_path: Path, workdir: tuple[Path, Path]
    ) -> None:
        effects = [
            {
                "preset": "viral",
                "trigger": {"type": "timestamp", "value": 0.5},
            }
        ]
        cfg = self._cfg(tmp_path, workdir, effects)
        result = run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
        assert result.returncode == 0, f"stderr: {result.stderr}"

    def test_gif_overlay_changes_pixels_in_overlay_region(
        self,
        tmp_path: Path,
        workdir: tuple[Path, Path],
        test_clip: Path,
        tiny_gif: Path,
    ) -> None:
        trigger = 0.3
        duration = 1.0
        gif_width = 200
        position = "top-right"

        effects = [
            {
                "trigger": {"type": "timestamp", "value": trigger},
                "gif": {
                    "source": str(tiny_gif),  # absolute path — no bundled asset needed
                    "mode": "positioned",
                    "position": position,
                    "width": gif_width,
                },
                "duration": duration,
                "pause_video": False,
            }
        ]
        cfg = self._cfg(tmp_path, workdir, effects)
        inp, out = workdir
        result = run_skill(self.SKILL, "freesound.py", ["--config", str(cfg)])
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
        from ffmpeg_utils import GifSpec, gif_position

        spec = GifSpec(
            source=str(tiny_gif),
            mode="positioned",
            position=position,
            width=gif_width,
        )
        x, y = gif_position(spec, 1080, 1920)
        box = (x, y, x + gif_width, y + gif_width)

        region_in = np.array(Image.open(frame_in).convert("RGB").crop(box), dtype=int)
        region_out = np.array(Image.open(frame_out).convert("RGB").crop(box), dtype=int)
        per_pixel_max = np.abs(region_out - region_in).max(axis=2)
        changed_px = int((per_pixel_max > 15).sum())

        assert changed_px > 50, (
            f"Overlay region looks unchanged after GIF render "
            f"(pixels changed >15: {changed_px}, expected >50)."
        )

        from PIL import Image
        import numpy as np
        from ffmpeg_utils import GifSpec, gif_position

        spec = GifSpec(
            source="bundled:heart",
            mode="positioned",
            position=position,
            width=gif_width,
        )
        x, y = gif_position(spec, 1080, 1920)
        box = (x, y, x + gif_width, y + gif_width)

        region_in = np.array(Image.open(frame_in).convert("RGB").crop(box), dtype=int)
        region_out = np.array(Image.open(frame_out).convert("RGB").crop(box), dtype=int)
        per_pixel_max = np.abs(region_out - region_in).max(axis=2)
        changed_px = int((per_pixel_max > 15).sum())

        assert changed_px > 50, (
            f"Overlay region looks unchanged after GIF render "
            f"(pixels changed >15: {changed_px}, expected >50)."
        )
