from __future__ import annotations

import importlib
import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from presets import POSITION_TO_KEY, PRESETS, SAFE_ZONES

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm"}
VALID_FORMATS = {"auto", "reels", "feed-portrait", "feed-square"}
VALID_POSITIONS = set(POSITION_TO_KEY)

SKILL_DIR = Path(__file__).parent.parent
DEFAULT_BRAND_ASSETS_DIR = SKILL_DIR.parent / "brand-manager" / "brand-assets"

SYSTEM_FONT_CANDIDATES = [
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    Path("/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
    Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"),
    Path("/usr/share/fonts/liberation/LiberationSans-Bold.ttf"),
]


def brand_assets_dir() -> Path:
    override = os.environ.get("CLAW_BRAND_ASSETS_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return DEFAULT_BRAND_ASSETS_DIR


def brand_manifest_path() -> Path:
    return brand_assets_dir() / "asset-manifest.json"


def load_brand_manifest() -> dict[str, Any]:
    manifest_path = brand_manifest_path()
    if not manifest_path.exists():
        return {}
    try:
        return json.loads(manifest_path.read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Brand asset manifest is invalid JSON: {manifest_path}"
        ) from exc


def detect_format(width: int, height: int) -> str:
    ratio = width / height
    targets = {
        "reels": 1080 / 1920,
        "feed-portrait": 1080 / 1350,
        "feed-square": 1.0,
    }
    return min(targets, key=lambda name: abs(ratio - targets[name]))


def resolve_format(requested_format: str, width: int, height: int) -> str:
    if requested_format != "auto":
        return requested_format
    return detect_format(width, height)


def wrap_hook_text(text: str, max_words_per_line: int = 4, max_lines: int = 2) -> str:
    words = text.strip().split()
    if not words:
        return ""

    lines: list[str] = []
    current: list[str] = []
    for word in words:
        if len(current) >= max_words_per_line and len(lines) < max_lines - 1:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)

    if current:
        if len(lines) < max_lines:
            lines.append(" ".join(current))
        else:
            lines[-1] = f"{lines[-1]} {' '.join(current)}".strip()

    return "\n".join(lines[:max_lines])


def resolve_brand_font() -> Path | None:
    manifest = load_brand_manifest()
    manifest_path = brand_manifest_path()

    for font in manifest.get("fonts", []):
        tags = set(font.get("tags", []))
        if {"heading", "bold"} & tags:
            candidate = manifest_path.parent / font["path"]
            if candidate.exists():
                return candidate

    for font in manifest.get("fonts", []):
        candidate = manifest_path.parent / font["path"]
        if candidate.exists():
            return candidate

    return None


def resolve_font_file(font_setting: str) -> Path:
    if font_setting != "auto":
        candidate = Path(font_setting).expanduser().resolve()
        if not candidate.exists():
            raise ValueError(f"Configured font does not exist: {candidate}")
        return candidate

    brand_font = resolve_brand_font()
    if brand_font is not None:
        return brand_font

    for candidate in SYSTEM_FONT_CANDIDATES:
        if candidate.exists():
            return candidate

    raise ValueError(
        "No usable font found. Add a brand font to brand assets or set hook.font to a .ttf path."
    )


def resolve_hook_video_path(selection: str) -> Path:
    manifest = load_brand_manifest()
    manifest_path = brand_manifest_path()
    videos = manifest.get("videos", [])
    if not videos:
        raise ValueError(
            "No visual hook videos found in brand assets. Add video entries under 'videos' in asset-manifest.json."
        )

    if selection == "auto":
        default_entry = next(
            (entry for entry in videos if entry.get("default") is True), None
        )
        if default_entry is None:
            raise ValueError(
                "No default visual hook video configured in brand assets. Mark one video entry with 'default': true or pass --hook-video <name|path>."
            )
        candidate = manifest_path.parent / default_entry["path"]
        if not candidate.exists():
            raise ValueError(f"Default visual hook video is missing: {candidate}")
        return candidate

    for entry in videos:
        if entry.get("name") == selection or entry.get("path") == selection:
            candidate = manifest_path.parent / entry["path"]
            if not candidate.exists():
                raise ValueError(f"Selected visual hook video is missing: {candidate}")
            return candidate

    raise ValueError(
        f"Visual hook video '{selection}' was not found in brand assets. Use a stored asset name or manifest path."
    )


def auto_font_size(width: int, layout_format: str) -> int:
    base = max(int(width * 0.093), 48)
    if layout_format == "feed-square":
        return max(base - 8, 44)
    if layout_format == "feed-portrait":
        return max(base - 4, 46)
    return base


def compute_anchor(
    width: int, height: int, layout_format: str, position: str
) -> tuple[int, int]:
    zone = SAFE_ZONES[layout_format]
    x_ratio = (zone["x_min"] + zone["x_max"]) / 2 / 1080
    y_ratio = (
        zone[POSITION_TO_KEY[position]]
        / {
            "reels": 1920,
            "feed-portrait": 1350,
            "feed-square": 1080,
        }[layout_format]
    )
    return int(width * x_ratio), int(height * y_ratio)


def fit_font_size(
    text: str, font_path: Path, target_width: int, start_size: int
) -> Any:
    image_module = importlib.import_module("PIL.Image")
    image_draw_module = importlib.import_module("PIL.ImageDraw")
    image_font_module = importlib.import_module("PIL.ImageFont")

    font_size = start_size
    while font_size >= 32:
        font = image_font_module.truetype(str(font_path), size=font_size)
        dummy = image_module.new("RGBA", (target_width, target_width), (0, 0, 0, 0))
        draw = image_draw_module.Draw(dummy)
        left, _, right, _ = draw.multiline_textbbox(
            (0, 0),
            text,
            font=font,
            align="center",
            spacing=max(8, int(font_size * 0.15)),
            stroke_width=0,
        )
        if right - left <= target_width:
            return font
        font_size -= 4

    return image_font_module.truetype(str(font_path), size=32)


def render_image_hook(input_path: Path, output_path: Path, cfg: dict[str, Any]) -> Path:
    image_module = importlib.import_module("PIL.Image")
    image_draw_module = importlib.import_module("PIL.ImageDraw")

    image = image_module.open(input_path).convert("RGBA")
    width, height = image.size
    layout_format = resolve_format(cfg["format"], width, height)
    font_path = resolve_font_file(cfg["hook"]["font"])
    text = wrap_hook_text(cfg["hook"]["text"])
    if not text:
        raise ValueError("hook.text must not be empty")

    preset = PRESETS[cfg["hook"]["preset"]]
    font_size = cfg["hook"]["font_size"] or auto_font_size(width, layout_format)
    font = fit_font_size(text, font_path, int(width * 0.86), font_size)
    x, y = compute_anchor(width, height, layout_format, cfg["hook"]["position"])

    text_layer = image_module.new("RGBA", image.size, (0, 0, 0, 0))
    draw = image_draw_module.Draw(text_layer)
    spacing = max(8, int(font.size * 0.15))

    if preset["box_fill"]:
        left, top, right, bottom = draw.multiline_textbbox(
            (x, y),
            text,
            font=font,
            align="center",
            anchor="mm",
            spacing=spacing,
            stroke_width=0,
        )
        padding_x = max(24, int(font.size * 0.3))
        padding_y = max(16, int(font.size * 0.2))
        draw.rounded_rectangle(
            (left - padding_x, top - padding_y, right + padding_x, bottom + padding_y),
            radius=max(18, int(font.size * 0.2)),
            fill=preset["box_fill"],
        )

    draw.multiline_text(
        (x, y),
        text,
        font=font,
        fill=preset["fill"],
        align="center",
        anchor="mm",
        spacing=spacing,
        stroke_width=cfg["hook"]["stroke_width"] if preset["stroke"] else 0,
        stroke_fill=preset["stroke"],
    )

    result = image_module.alpha_composite(image, text_layer)
    save_image(result, output_path)
    return font_path


def save_image(image: Any, output_path: Path) -> None:
    suffix = output_path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        image.convert("RGB").save(output_path, quality=95)
        return
    image.save(output_path)


def ffmpeg_escape(text: str) -> str:
    escaped = text.replace("\\", r"\\").replace(":", r"\:")
    escaped = escaped.replace("'", r"\'").replace("%", r"\%")
    return escaped.replace("\n", r"\n")


def probe_video(path: Path) -> dict[str, Any]:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    video_stream = next(
        stream for stream in data["streams"] if stream.get("codec_type") == "video"
    )
    audio_stream = next(
        (stream for stream in data["streams"] if stream.get("codec_type") == "audio"),
        None,
    )
    fps_parts = video_stream.get("r_frame_rate", "30/1").split("/")
    fps = round(int(fps_parts[0]) / int(fps_parts[1])) if int(fps_parts[1]) else 30
    duration = float(
        video_stream.get("duration") or audio_stream.get("duration")
        if audio_stream
        else 0.0
    )
    return {
        "width": int(video_stream["width"]),
        "height": int(video_stream["height"]),
        "fps": max(fps, 1),
        "duration": duration,
        "has_audio": audio_stream is not None,
    }


def overlay_text_on_video(
    source_path: Path, output_path: Path, cfg: dict[str, Any]
) -> Path:
    ffmpeg = importlib.import_module("ffmpeg")
    info = probe_video(source_path)
    width = info["width"]
    height = info["height"]
    layout_format = resolve_format(cfg["format"], width, height)
    font_path = resolve_font_file(cfg["hook"]["font"])
    text = wrap_hook_text(cfg["hook"]["text"])
    if not text:
        raise ValueError("hook.text must not be empty")

    preset = PRESETS[cfg["hook"]["preset"]]
    x, y = compute_anchor(width, height, layout_format, cfg["hook"]["position"])
    font_size = cfg["hook"]["font_size"] or auto_font_size(width, layout_format)

    video = ffmpeg.input(str(source_path))
    video_stream_node = video.video.filter(
        "drawtext",
        text=ffmpeg_escape(text),
        fontfile=str(font_path),
        fontsize=font_size,
        fontcolor=preset["fill"],
        x=f"{x}-text_w/2",
        y=f"{y}-text_h/2",
        line_spacing=max(8, int(font_size * 0.12)),
        borderw=cfg["hook"]["stroke_width"] if preset["stroke"] else 0,
        bordercolor=preset["stroke"] or "black",
        box=1 if preset["box_fill"] else 0,
        boxcolor=preset["box_fill"] or "black@0",
        boxborderw=max(12, int(font_size * 0.2)) if preset["box_fill"] else 0,
        enable=f"between(t,0,{cfg['hook']['duration']})",
    )

    output_kwargs: dict[str, Any] = {
        "vcodec": "libx264",
        "preset": "medium",
        "pix_fmt": "yuv420p",
        "movflags": "+faststart",
        "acodec": "aac",
    }
    stream_args = [video_stream_node]
    if info["has_audio"]:
        stream_args.append(video.audio)
    (
        ffmpeg.output(*stream_args, str(output_path), **output_kwargs)
        .overwrite_output()
        .run(quiet=True)
    )
    return font_path


def concat_videos(
    hook_video_path: Path, main_video_path: Path, output_path: Path
) -> None:
    main_info = probe_video(main_video_path)
    hook_info = probe_video(hook_video_path)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(hook_video_path),
        "-i",
        str(main_video_path),
    ]

    hook_audio_label = "0:a"
    main_audio_label = "1:a"

    if not hook_info["has_audio"]:
        cmd.extend(
            [
                "-f",
                "lavfi",
                "-t",
                str(max(hook_info["duration"], 0.1)),
                "-i",
                "anullsrc=channel_layout=stereo:sample_rate=48000",
            ]
        )
        hook_audio_label = "2:a"

    if not main_info["has_audio"]:
        cmd.extend(
            [
                "-f",
                "lavfi",
                "-t",
                str(max(main_info["duration"], 0.1)),
                "-i",
                "anullsrc=channel_layout=stereo:sample_rate=48000",
            ]
        )
        main_audio_label = f"{len(cmd) // 4 - 1}:a"

    width = main_info["width"]
    height = main_info["height"]
    fps = main_info["fps"]
    scale_pad = (
        f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,"
        f"fps={fps},setsar=1"
    )
    filter_complex = (
        f"[0:v]{scale_pad}[v0];"
        f"[1:v]{scale_pad}[v1];"
        f"[{hook_audio_label}]aresample=48000[a0];"
        f"[{main_audio_label}]aresample=48000[a1];"
        f"[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]"
    )

    cmd.extend(
        [
            "-filter_complex",
            filter_complex,
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip() or "Failed to prepend visual hook video"
        )


def render_video_hook(input_path: Path, output_path: Path, cfg: dict[str, Any]) -> Path:
    hook_video_source = resolve_hook_video_path(cfg["video_hook"]["selection"])
    with tempfile.TemporaryDirectory(prefix="visual-hook-") as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        prepared_hook_path = temp_dir / "hook-prepared.mp4"
        font_path = overlay_text_on_video(hook_video_source, prepared_hook_path, cfg)
        concat_videos(prepared_hook_path, input_path, output_path)
    return font_path


def collect_media(input_dir: Path) -> list[Path]:
    supported_extensions = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
    return [
        path
        for path in sorted(input_dir.iterdir())
        if path.is_file() and path.suffix.lower() in supported_extensions
    ]


def validate_environment() -> None:
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, check=False
        )
    except FileNotFoundError as exc:
        raise RuntimeError("ffmpeg is required but not available on PATH") from exc

    if result.returncode != 0:
        raise RuntimeError("ffmpeg is required but not available on PATH")


def validate_config(cfg: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []

    if cfg.get("format", "auto") not in VALID_FORMATS:
        errors.append(f"'format' must be one of: {', '.join(sorted(VALID_FORMATS))}")

    hook = cfg.get("hook")
    if not isinstance(hook, dict):
        errors.append("'hook' must be an object")
    else:
        if hook.get("preset") not in PRESETS:
            errors.append(f"'hook.preset' must be one of: {', '.join(sorted(PRESETS))}")
        if hook.get("position") not in VALID_POSITIONS:
            errors.append(
                f"'hook.position' must be one of: {', '.join(sorted(VALID_POSITIONS))}"
            )
        if not isinstance(hook.get("text"), str) or not hook.get("text", "").strip():
            errors.append("'hook.text' must be a non-empty string")
        font_size = hook.get("font_size")
        if font_size is not None and (not isinstance(font_size, int) or font_size < 24):
            errors.append("'hook.font_size' must be null or an integer >= 24")
        stroke_width = hook.get("stroke_width")
        if not isinstance(stroke_width, int) or stroke_width < 0:
            errors.append("'hook.stroke_width' must be an integer >= 0")
        duration = hook.get("duration")
        if not isinstance(duration, (int, float)) or duration <= 0:
            errors.append("'hook.duration' must be a positive number")
        font_setting = hook.get("font")
        if not isinstance(font_setting, str) or not font_setting.strip():
            errors.append("'hook.font' must be 'auto' or a font file path")

    video_hook = cfg.get("video_hook")
    if not isinstance(video_hook, dict):
        errors.append("'video_hook' must be an object")
    else:
        selection = video_hook.get("selection")
        if not isinstance(selection, str) or not selection.strip():
            errors.append("'video_hook.selection' must be a non-empty string")

    if errors:
        raise ValueError("Config errors:\n  - " + "\n  - ".join(errors))
    return cfg
