"""ffmpeg_utils.py — FFmpeg command builders and audio mixing for the pixabay skill."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

MARGIN = 20


@dataclass
class GifSpec:
    source: str
    mode: str
    position: str = "top-right"
    x: Optional[int] = None
    y: Optional[int] = None
    width: int = 200


OverlaySpec = GifSpec


@dataclass
class SfxSpec:
    source: str
    at: float = 0.0
    volume: float = 1.0


@dataclass
class Effect:
    trigger_time: float
    overlay: Optional[OverlaySpec] = None
    sfx: Optional[SfxSpec] = None
    pause_video: bool = False
    duration: float = 3.0


def probe_video(path: Path) -> dict:
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
            rotation = abs(int(stream.get("tags", {}).get("rotate", 0)))
            for side_data in stream.get("side_data_list", []):
                if "rotation" in side_data:
                    rotation = abs(int(side_data["rotation"]))
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


def overlay_position(
    spec: OverlaySpec, video_width: int, video_height: int
) -> tuple[int, int]:
    if spec.mode == "fullscreen":
        return 0, 0
    if spec.position == "custom":
        return (spec.x or 0), (spec.y or 0)
    est_h = spec.width
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


def _overlay_input_flags(path: Path) -> list[str]:
    ext = path.suffix.lower()
    if ext in {".gif", ".webp", ".apng"}:
        return ["-ignore_loop", "0", "-i", str(path)]
    if ext in {".jpg", ".jpeg", ".png", ".bmp", ".tiff"}:
        return ["-loop", "1", "-i", str(path)]
    return ["-i", str(path)]


def build_overlay_filter(
    overlay_specs: list[OverlaySpec],
    video_width: int,
    video_height: int,
    trigger_times: list[float],
    durations: list[float],
    resolved_paths: list[Path],
) -> tuple[str, list[str]]:
    extra_inputs: list[str] = []
    filter_parts: list[str] = []
    prev_video = "[0:v]"

    for i, (spec, path, t_start, duration) in enumerate(
        zip(overlay_specs, resolved_paths, trigger_times, durations)
    ):
        input_idx = i + 1
        overlay_label = f"[g{i}]"
        out_label = f"[v{i}]"

        extra_inputs += _overlay_input_flags(path)

        if spec.mode == "fullscreen":
            scale = (
                f"[{input_idx}:v]scale={video_width}:{video_height},"
                f"format=rgba{overlay_label}"
            )
        else:
            scale = f"[{input_idx}:v]scale={spec.width}:-1,format=rgba{overlay_label}"

        x, y = overlay_position(spec, video_width, video_height)
        t_end = t_start + duration
        overlay = (
            f"{prev_video}{overlay_label}overlay={x}:{y}"
            f":shortest=1:enable='between(t,{t_start:.3f},{t_end:.3f})'{out_label}"
        )
        filter_parts.append(scale)
        filter_parts.append(overlay)
        prev_video = out_label

    if filter_parts:
        last_label = f"[v{len(overlay_specs) - 1}]"
        filter_parts[-1] = filter_parts[-1].replace(last_label, "[vout]", 1)

    return "; ".join(filter_parts), extra_inputs


def build_overlay_command(
    input_path: Path,
    output_path: Path,
    effects: list[Effect],
    resolved_overlays: dict[int, Path],
    mixed_audio_path: Optional[Path] = None,
    duck_background: bool = True,
    duck_db: float = -10.0,
) -> list[str]:
    del duck_background, duck_db
    info = probe_video(input_path)
    video_width = info["width"]
    video_height = info["height"]

    overlay_pairs = [
        (i, effect)
        for i, effect in enumerate(effects)
        if effect.overlay is not None
        and not effect.pause_video
        and i in resolved_overlays
    ]

    cmd: list[str] = ["ffmpeg", "-y", "-i", str(input_path)]
    filter_complex = ""

    if overlay_pairs:
        overlay_specs: list[OverlaySpec] = [
            effect.overlay for _, effect in overlay_pairs if effect.overlay is not None
        ]
        trigger_times = [effect.trigger_time for _, effect in overlay_pairs]
        durations = [effect.duration for _, effect in overlay_pairs]
        paths = [resolved_overlays[i] for i, _ in overlay_pairs]
        filter_complex, extra_inputs = build_overlay_filter(
            overlay_specs,
            video_width,
            video_height,
            trigger_times,
            durations,
            paths,
        )
        cmd += extra_inputs

    if mixed_audio_path is not None:
        cmd += ["-i", str(mixed_audio_path)]

    if overlay_pairs:
        cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]
    else:
        cmd += ["-map", "0:v"]

    if mixed_audio_path is not None:
        audio_idx = len(overlay_pairs) + 1
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


def build_pause_command(
    input_path: Path,
    output_path: Path,
    effect: Effect,
    resolved_overlay: Optional[Path],
    overlay_spec: Optional[OverlaySpec],
    resolved_sfx: Optional[Path],
    video_width: int,
    video_height: int,
    fps: float,
    tmp_dir: Path,
    has_audio: bool = True,
) -> list[list[str]]:
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

    if resolved_overlay is not None and overlay_spec is not None:
        x, y = overlay_position(overlay_spec, video_width, video_height)
        if overlay_spec.mode == "fullscreen":
            overlay_scale = f"[1:v]scale={video_width}:{video_height},format=rgba[g]"
        else:
            overlay_scale = f"[1:v]scale={overlay_spec.width}:-1,format=rgba[g]"
        fc = f"{overlay_scale}; [0:v][g]overlay={x}:{y}:shortest=1[vout]"
        overlay_input = _overlay_input_flags(resolved_overlay)
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
                *overlay_input,
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


def _probe_duration(path: Path) -> float:
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
