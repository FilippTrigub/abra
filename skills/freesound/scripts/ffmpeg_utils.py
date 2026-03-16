"""ffmpeg_utils.py — FFmpeg command builders and audio mixing for the freesound skill.

No AI/GPU required. Pure FFmpeg subprocess + pydub for audio mixing.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Data models (shared with freesound.py via import)
# ---------------------------------------------------------------------------

MARGIN = 20  # pixels from video edge for positioned overlays


@dataclass
class GifSpec:
    source: str
    mode: str  # "fullscreen" | "positioned"
    position: str = (
        "top-right"  # top-left|top-right|bottom-left|bottom-right|center|custom
    )
    x: Optional[int] = None
    y: Optional[int] = None
    width: int = 200  # pixels; ignored when mode="fullscreen"


@dataclass
class SfxSpec:
    source: str
    at: float = 0.0  # seconds offset from trigger time
    volume: float = 1.0  # 0.0–1.0


@dataclass
class Effect:
    trigger_time: float
    gif: Optional[GifSpec] = None
    sfx: Optional[SfxSpec] = None
    pause_video: bool = False
    duration: float = 3.0


# ---------------------------------------------------------------------------
# Video probing
# ---------------------------------------------------------------------------


def probe_video(path: Path) -> dict:
    """Run ffprobe, return dict with width, height, fps, duration, has_audio."""
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    info: dict = {
        "has_audio": False,
        "has_video": False,
        "width": 0,
        "height": 0,
        "fps": 30.0,
        "duration": 0.0,
    }
    for stream in data.get("streams", []):
        codec_type = stream.get("codec_type")
        if codec_type == "video":
            info["has_video"] = True
            w = stream.get("width", 0)
            h = stream.get("height", 0)
            # Detect display rotation from side_data (display matrix) or tags.
            # FFmpeg auto-rotates decoded frames, so swap w/h for 90°/270° videos.
            rotation = abs(int(stream.get("tags", {}).get("rotate", 0)))
            for sd in stream.get("side_data_list", []):
                if "rotation" in sd:
                    rotation = abs(int(sd["rotation"]))
                    break
            if rotation in (90, 270):
                w, h = h, w
            info["width"] = w
            info["height"] = h
            fps_str = stream.get("r_frame_rate", "30/1")
            num, den = fps_str.split("/")
            info["fps"] = float(int(num) / max(int(den), 1))
            info["duration"] = float(stream.get("duration", 0))
        elif codec_type == "audio":
            info["has_audio"] = True
    return info


# ---------------------------------------------------------------------------
# GIF position computation
# ---------------------------------------------------------------------------


def gif_position(spec: GifSpec, video_width: int, video_height: int) -> tuple[int, int]:
    """Compute (x, y) pixel coords for the GIF overlay from spec."""
    if spec.mode == "fullscreen":
        return 0, 0
    if spec.position == "custom":
        return (spec.x or 0), (spec.y or 0)
    est_h = spec.width  # assume roughly square GIF
    pos_map: dict[str, tuple[int, int]] = {
        "top-left": (MARGIN, MARGIN),
        "top-right": (video_width - spec.width - MARGIN, MARGIN),
        "bottom-left": (MARGIN, video_height - est_h - MARGIN),
        "bottom-right": (
            video_width - spec.width - MARGIN,
            video_height - est_h - MARGIN,
        ),
        "center": ((video_width - spec.width) // 2, (video_height - est_h) // 2),
    }
    return pos_map.get(spec.position, (MARGIN, MARGIN))


# ---------------------------------------------------------------------------
# FFmpeg filter_complex builder
# ---------------------------------------------------------------------------


def build_gif_filter(
    gif_specs: list[GifSpec],
    video_width: int,
    video_height: int,
    trigger_times: list[float],
    durations: list[float],
    resolved_paths: list[Path],
) -> tuple[str, list[str]]:
    """
    Build the filter_complex string and extra input flags for N animated GIF overlays.

    Returns:
        filter_complex: string for -filter_complex, maps [0:v]+gifs → [vout]
        extra_inputs:   ["-ignore_loop", "0", "-i", path, ...] per GIF
    """
    extra_inputs: list[str] = []
    filter_parts: list[str] = []
    prev_video = "[0:v]"

    for i, (spec, path, t_start, duration) in enumerate(
        zip(gif_specs, resolved_paths, trigger_times, durations)
    ):
        input_idx = i + 1
        gif_label = f"[g{i}]"
        out_label = f"[v{i}]"

        extra_inputs += ["-ignore_loop", "0", "-i", str(path)]

        if spec.mode == "fullscreen":
            scale = f"[{input_idx}:v]scale={video_width}:{video_height},format=rgba{gif_label}"
        else:
            scale = f"[{input_idx}:v]scale={spec.width}:-1,format=rgba{gif_label}"

        x, y = gif_position(spec, video_width, video_height)
        t_end = t_start + duration
        # shortest=1 stops overlay when the base video ends (prevents infinite GIF loop hang)
        overlay = (
            f"{prev_video}{gif_label}overlay={x}:{y}"
            f":shortest=1:enable='between(t,{t_start:.3f},{t_end:.3f})'{out_label}"
        )
        filter_parts.append(scale)
        filter_parts.append(overlay)
        prev_video = out_label

    # Rename last output label → [vout]
    if filter_parts:
        last_label = f"[v{len(gif_specs) - 1}]"
        filter_parts[-1] = filter_parts[-1].replace(last_label, "[vout]", 1)

    return "; ".join(filter_parts), extra_inputs


# ---------------------------------------------------------------------------
# Overlay command builder (no-pause mode)
# ---------------------------------------------------------------------------


def build_overlay_command(
    input_path: Path,
    output_path: Path,
    effects: list[Effect],
    resolved_gifs: dict[int, Path],
    mixed_audio_path: Optional[Path] = None,
    duck_background: bool = True,
    duck_db: float = -10.0,
) -> list[str]:
    """
    Build the ffmpeg command to overlay GIFs onto video (no pause).

    Audio strategy: if mixed_audio_path is provided it replaces the original
    audio track; otherwise the original audio is passed through unchanged.
    """
    info = probe_video(input_path)
    video_width = info["width"]
    video_height = info["height"]

    # Only non-pause effects with GIFs that resolved successfully
    gif_pairs = [
        (i, e)
        for i, e in enumerate(effects)
        if e.gif is not None and not e.pause_video and i in resolved_gifs
    ]

    cmd: list[str] = ["ffmpeg", "-y", "-i", str(input_path)]
    filter_complex = ""

    if gif_pairs:
        gif_specs: list[GifSpec] = [e.gif for _, e in gif_pairs if e.gif is not None]
        trigger_times = [e.trigger_time for _, e in gif_pairs]
        durations = [e.duration for _, e in gif_pairs]
        paths = [resolved_gifs[i] for i, _ in gif_pairs]
        filter_complex, extra_inputs = build_gif_filter(
            gif_specs, video_width, video_height, trigger_times, durations, paths
        )
        cmd += extra_inputs

    if mixed_audio_path is not None:
        cmd += ["-i", str(mixed_audio_path)]

    # Map video
    if gif_pairs:
        cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]
    else:
        cmd += ["-map", "0:v"]

    # Map audio
    if mixed_audio_path is not None:
        audio_idx = len(gif_pairs) + 1
        cmd += ["-map", f"{audio_idx}:a"]
    elif info["has_audio"]:
        cmd += ["-map", "0:a"]

    cmd += [
        "-c:v",
        "libx264",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-hide_banner",
        "-loglevel",
        "error",
        str(output_path),
    ]
    return cmd


# ---------------------------------------------------------------------------
# Pause command builder
# ---------------------------------------------------------------------------


def build_pause_command(
    input_path: Path,
    output_path: Path,
    effect: Effect,
    resolved_gif: Optional[Path],
    resolved_sfx: Optional[Path],
    video_width: int,
    video_height: int,
    fps: float,
    tmp_dir: Path,
    has_audio: bool = True,
) -> list[list[str]]:
    """
    Return an ordered list of ffmpeg commands that implement a pause effect:
      1. Trim video before trigger_time  → before.mp4
      2. Extract freeze frame             → freeze.png
      3. Create frozen video segment      → frozen_vid.mp4 (with optional GIF overlay)
      4a. Create audio for frozen window  → frozen_aud.aac (SFX or silence)
      4b. Mux frozen video + audio        → frozen.mp4
      5. Trim video after trigger_time    → after.mp4
      6. Concat before + frozen + after   → output_path
    """
    t = effect.trigger_time
    dur = effect.duration
    fps_int = max(1, int(round(fps)))

    before_path = tmp_dir / "before.mp4"
    freeze_path = tmp_dir / "freeze.png"
    frozen_vid_path = tmp_dir / "frozen_vid.mp4"
    frozen_aud_path = tmp_dir / "frozen_aud.aac"
    frozen_path = tmp_dir / "frozen.mp4"
    after_path = tmp_dir / "after.mp4"

    cmds: list[list[str]] = []

    # 1. Trim before
    cmds.append(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-t",
            f"{t:.3f}",
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-hide_banner",
            "-loglevel",
            "error",
            str(before_path),
        ]
    )

    # 2. Extract freeze frame
    cmds.append(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-ss",
            f"{t:.3f}",
            "-vframes",
            "1",
            "-hide_banner",
            "-loglevel",
            "error",
            str(freeze_path),
        ]
    )

    # 3. Create frozen video segment
    if resolved_gif is not None and effect.gif is not None:
        x, y = gif_position(effect.gif, video_width, video_height)
        if effect.gif.mode == "fullscreen":
            gif_scale = f"[1:v]scale={video_width}:{video_height},format=rgba[g]"
        else:
            gif_scale = f"[1:v]scale={effect.gif.width}:-1,format=rgba[g]"
        fc = f"{gif_scale}; [0:v][g]overlay={x}:{y}:shortest=1[vout]"
        cmds.append(
            [
                "ffmpeg",
                "-y",
                "-loop",
                "1",
                "-framerate",
                str(fps_int),
                "-i",
                str(freeze_path),
                "-ignore_loop",
                "0",
                "-i",
                str(resolved_gif),
                "-filter_complex",
                fc,
                "-map",
                "[vout]",
                "-t",
                f"{dur:.3f}",
                "-c:v",
                "libx264",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-hide_banner",
                "-loglevel",
                "error",
                str(frozen_vid_path),
            ]
        )
    else:
        cmds.append(
            [
                "ffmpeg",
                "-y",
                "-loop",
                "1",
                "-framerate",
                str(fps_int),
                "-i",
                str(freeze_path),
                "-t",
                f"{dur:.3f}",
                "-c:v",
                "libx264",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-hide_banner",
                "-loglevel",
                "error",
                str(frozen_vid_path),
            ]
        )

    if has_audio:
        # 4a. Audio for frozen segment
        if resolved_sfx is not None:
            cmds.append(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(resolved_sfx),
                    "-af",
                    f"apad=pad_dur={dur:.3f}",
                    "-t",
                    f"{dur:.3f}",
                    "-c:a",
                    "aac",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    str(frozen_aud_path),
                ]
            )
        else:
            cmds.append(
                [
                    "ffmpeg",
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    "anullsrc=r=44100:cl=stereo",
                    "-t",
                    f"{dur:.3f}",
                    "-c:a",
                    "aac",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    str(frozen_aud_path),
                ]
            )
        # 4b. Mux frozen video + audio
        cmds.append(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(frozen_vid_path),
                "-i",
                str(frozen_aud_path),
                "-c:v",
                "copy",
                "-c:a",
                "copy",
                "-hide_banner",
                "-loglevel",
                "error",
                str(frozen_path),
            ]
        )
    else:
        frozen_path = frozen_vid_path

    # 5. Trim after
    cmds.append(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_path),
            "-ss",
            f"{t:.3f}",
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-hide_banner",
            "-loglevel",
            "error",
            str(after_path),
        ]
    )

    # 6. Concat
    if has_audio:
        concat_filter = "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]"
        map_args = ["-map", "[v]", "-map", "[a]"]
    else:
        concat_filter = "[0:v][1:v][2:v]concat=n=3:v=1[v]"
        map_args = ["-map", "[v]"]

    cmds.append(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(before_path),
            "-i",
            str(frozen_path),
            "-i",
            str(after_path),
            "-filter_complex",
            concat_filter,
            *map_args,
            "-c:v",
            "libx264",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-hide_banner",
            "-loglevel",
            "error",
            str(output_path),
        ]
    )

    return cmds


# ---------------------------------------------------------------------------
# Audio mixing (pydub-based)
# ---------------------------------------------------------------------------


def _probe_duration(path: Path) -> float:
    """Return the duration of an audio/video file in seconds via ffprobe."""
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def mix_sfx_into_audio(
    video_path: Path,
    sfx_path: Path,
    sfx_at_seconds: float,
    sfx_volume: float,
    output_audio_path: Path,
    duck_background: bool,
    duck_db: float,
) -> None:
    delay_ms = max(0, int(sfx_at_seconds * 1000))
    vol_factor = max(0.0, sfx_volume)

    if duck_background:
        duck_linear = 10 ** (duck_db / 20.0)
        sfx_duration = _probe_duration(sfx_path)
        duck_end = sfx_at_seconds + sfx_duration
        filter_complex = (
            f"[0:a]volume=enable='between(t,{sfx_at_seconds:.3f},{duck_end:.3f})':"
            f"volume={duck_linear:.4f}[ducked];"
            f"[1:a]adelay={delay_ms}|{delay_ms},volume={vol_factor:.4f}[sfx];"
            f"[ducked][sfx]amix=inputs=2:duration=first:dropout_transition=0[out]"
        )
    else:
        filter_complex = (
            f"[1:a]adelay={delay_ms}|{delay_ms},volume={vol_factor:.4f}[sfx];"
            f"[0:a][sfx]amix=inputs=2:duration=first:dropout_transition=0[out]"
        )

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-i",
            str(sfx_path),
            "-filter_complex",
            filter_complex,
            "-map",
            "[out]",
            "-hide_banner",
            "-loglevel",
            "error",
            str(output_audio_path),
        ],
        check=True,
    )
