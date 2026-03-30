from __future__ import annotations

import importlib
import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from presets import POSITIONS, PRESETS, SAFE_ZONES

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm"}
VALID_FORMATS = {"auto", "reels", "feed-portrait", "feed-square"}
VALID_POSITIONS = set(POSITIONS)
VALID_CTA_TYPES = {"text", "image", "video"}

SKILL_DIR = Path(__file__).parent.parent
REPO_ROOT = SKILL_DIR.parent.parent
DEFAULT_BRAND_ASSETS_DIR = REPO_ROOT / "skills" / "brand-manager" / "brand-assets"

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
        "No usable font found. Add a brand font to brand assets or set cta.font to a .ttf path."
    )


def resolve_cta(selection: str) -> dict[str, Any]:
    manifest = load_brand_manifest()
    manifest_path = brand_manifest_path()
    ctas = manifest.get("ctas", [])
    if not ctas:
        raise ValueError(
            "No CTAs found in brand assets. Add entries under 'ctas' in asset-manifest.json."
        )

    if selection == "auto":
        entry = next((item for item in ctas if item.get("default") is True), None)
        if entry is None:
            raise ValueError(
                "No default CTA configured in brand assets. Mark one CTA with 'default': true or pass --cta <name>."
            )
    else:
        entry = next((item for item in ctas if item.get("name") == selection), None)
        if entry is None:
            raise ValueError(f"CTA '{selection}' was not found in brand assets.")

    cta_type = entry.get("type")
    if cta_type not in VALID_CTA_TYPES:
        raise ValueError(
            f"CTA '{entry.get('name', '<unnamed>')}' has invalid type '{cta_type}'."
        )

    if cta_type == "text":
        text = entry.get("text", "")
        if not isinstance(text, str) or not text.strip():
            raise ValueError(
                f"CTA '{entry.get('name', '<unnamed>')}' text must be a non-empty string."
            )
        return {"type": "text", "name": entry["name"], "text": text}

    asset_path = entry.get("asset_path")
    if not isinstance(asset_path, str) or not asset_path.strip():
        raise ValueError(
            f"CTA '{entry.get('name', '<unnamed>')}' must define asset_path."
        )
    candidate = manifest_path.parent / asset_path
    if not candidate.exists():
        raise ValueError(f"CTA asset is missing: {candidate}")
    return {"type": cta_type, "name": entry["name"], "asset_path": candidate}


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


def wrap_text(text: str, max_words_per_line: int = 4, max_lines: int = 2) -> str:
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


def auto_font_size(width: int, layout_format: str) -> int:
    base = max(int(width * 0.085), 42)
    if layout_format == "feed-square":
        return max(base - 6, 40)
    if layout_format == "feed-portrait":
        return max(base - 2, 40)
    return base


def compute_anchor(
    width: int, height: int, layout_format: str, position: str
) -> tuple[int, int]:
    zone = SAFE_ZONES[layout_format]
    x_key, y_key = POSITIONS[position]
    if x_key == "center_x":
        x_value = (zone["left"] + zone["right"]) / 2
    else:
        x_value = zone[x_key]
    y_value = zone[y_key]
    base_height = {"reels": 1920, "feed-portrait": 1350, "feed-square": 1080}[
        layout_format
    ]
    return int(width * (x_value / 1080)), int(height * (y_value / base_height))


def fit_font_size(
    text: str, font_path: Path, target_width: int, start_size: int
) -> Any:
    image_module = importlib.import_module("PIL.Image")
    image_draw_module = importlib.import_module("PIL.ImageDraw")
    image_font_module = importlib.import_module("PIL.ImageFont")
    font_size = start_size
    while font_size >= 28:
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
    return image_font_module.truetype(str(font_path), size=28)


def hex_to_rgba(color: str) -> tuple[int, int, int, int]:
    value = color.lstrip("#")
    if len(value) == 6:
        return (
            int(value[0:2], 16),
            int(value[2:4], 16),
            int(value[4:6], 16),
            255,
        )
    if len(value) == 8:
        return (
            int(value[0:2], 16),
            int(value[2:4], 16),
            int(value[4:6], 16),
            int(value[6:8], 16),
        )
    raise ValueError(
        f"Invalid CTA background color '{color}'. Use #RRGGBB or #RRGGBBAA."
    )


def save_image(image: Any, output_path: Path) -> None:
    suffix = output_path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        image.convert("RGB").save(output_path, quality=95)
        return
    image.save(output_path)


def overlay_text_on_image(
    base_image: Any, cta: dict[str, Any], cfg: dict[str, Any], layout_format: str
) -> Path:
    image_draw_module = importlib.import_module("PIL.ImageDraw")
    font_path = resolve_font_file(cfg["cta"]["font"])
    text = wrap_text(cta["text"])
    preset = PRESETS[cfg["cta"]["preset"]]
    width, height = base_image.size
    font_size = cfg["cta"]["font_size"] or auto_font_size(width, layout_format)
    font = fit_font_size(text, font_path, int(width * 0.8), font_size)
    x, y = compute_anchor(width, height, layout_format, cfg["cta"]["position"])
    layer = importlib.import_module("PIL.Image").new(
        "RGBA", base_image.size, (0, 0, 0, 0)
    )
    draw = image_draw_module.Draw(layer)
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
        stroke_width=cfg["cta"]["stroke_width"] if preset["stroke"] else 0,
        stroke_fill=preset["stroke"],
    )
    result = importlib.import_module("PIL.Image").alpha_composite(base_image, layer)
    base_image.paste(result)
    return font_path


def compute_paste_position(
    base_size: tuple[int, int],
    overlay_size: tuple[int, int],
    layout_format: str,
    position: str,
) -> tuple[int, int]:
    width, height = base_size
    overlay_width, overlay_height = overlay_size
    anchor_x, anchor_y = compute_anchor(width, height, layout_format, position)
    horizontal = POSITIONS[position][0]
    vertical = POSITIONS[position][1]
    if horizontal == "left":
        x = anchor_x
    elif horizontal == "right":
        x = anchor_x - overlay_width
    else:
        x = anchor_x - overlay_width // 2
    if vertical == "top":
        y = anchor_y
    elif vertical == "bottom":
        y = anchor_y - overlay_height
    else:
        y = anchor_y - overlay_height // 2
    return x, y


def overlay_image_on_image(
    base_image: Any, cta_image_path: Path, cfg: dict[str, Any], layout_format: str
) -> None:
    image_module = importlib.import_module("PIL.Image")
    overlay = image_module.open(cta_image_path).convert("RGBA")
    width, height = base_image.size
    max_width = int(width * 0.42)
    max_height = int(height * 0.24)
    overlay.thumbnail((max_width, max_height))
    x, y = compute_paste_position(
        base_image.size, overlay.size, layout_format, cfg["cta"]["position"]
    )
    base_image.alpha_composite(overlay, (x, y))


def render_image_cta(
    input_path: Path, output_path: Path, cfg: dict[str, Any]
) -> Path | None:
    image_module = importlib.import_module("PIL.Image")
    cta = resolve_cta(cfg["cta"]["selection"])
    if cta["type"] == "video":
        raise ValueError(
            f"CTA '{cta['name']}' is a video and cannot be applied to image inputs."
        )
    image = image_module.open(input_path).convert("RGBA")
    layout_format = resolve_format(cfg["format"], *image.size)
    font_path: Path | None = None
    if cta["type"] == "text":
        font_path = overlay_text_on_image(image, cta, cfg, layout_format)
    else:
        overlay_image_on_image(image, cta["asset_path"], cfg, layout_format)
    save_image(image, output_path)
    return font_path


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


def create_text_card(
    card_path: Path,
    size: tuple[int, int],
    cta: dict[str, Any],
    cfg: dict[str, Any],
    layout_format: str,
) -> Path:
    image_module = importlib.import_module("PIL.Image")
    card = image_module.new("RGBA", size, hex_to_rgba(cfg["cta"]["background"]))
    font_path = overlay_text_on_image(
        card, cta, {**cfg, "cta": {**cfg["cta"], "position": "center"}}, layout_format
    )
    save_image(card, card_path)
    return font_path


def create_image_card(
    card_path: Path,
    size: tuple[int, int],
    cta_image_path: Path,
    cfg: dict[str, Any],
    layout_format: str,
) -> None:
    image_module = importlib.import_module("PIL.Image")
    card = image_module.new("RGBA", size, hex_to_rgba(cfg["cta"]["background"]))
    overlay_image_on_image(
        card,
        cta_image_path,
        {**cfg, "cta": {**cfg["cta"], "position": "center"}},
        layout_format,
    )
    save_image(card, card_path)


def make_video_from_still(
    image_path: Path, output_path: Path, duration: float, fps: int
) -> None:
    result = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(image_path),
            "-f",
            "lavfi",
            "-t",
            str(duration),
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-shortest",
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "Failed to render CTA card video")


def prepare_video_for_concat(
    source_path: Path, output_path: Path, target_size: tuple[int, int], fps: int
) -> None:
    width, height = target_size
    result = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            "-vf",
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,fps={fps},setsar=1",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip() or f"Failed to normalize video {source_path}"
        )


def concat_videos(first_path: Path, second_path: Path, output_path: Path) -> None:
    first_info = probe_video(first_path)
    second_info = probe_video(second_path)
    cmd = ["ffmpeg", "-y", "-i", str(first_path), "-i", str(second_path)]
    first_audio_label = "0:a"
    second_audio_label = "1:a"
    next_index = 2
    if not first_info["has_audio"]:
        cmd.extend(
            [
                "-f",
                "lavfi",
                "-t",
                str(max(first_info["duration"], 0.1)),
                "-i",
                "anullsrc=channel_layout=stereo:sample_rate=48000",
            ]
        )
        first_audio_label = f"{next_index}:a"
        next_index += 1
    if not second_info["has_audio"]:
        cmd.extend(
            [
                "-f",
                "lavfi",
                "-t",
                str(max(second_info["duration"], 0.1)),
                "-i",
                "anullsrc=channel_layout=stereo:sample_rate=48000",
            ]
        )
        second_audio_label = f"{next_index}:a"
        next_index += 1
    width = first_info["width"]
    height = first_info["height"]
    fps = first_info["fps"]
    scale_pad = f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,fps={fps},setsar=1"
    filter_complex = (
        f"[0:v]{scale_pad}[v0];"
        f"[1:v]{scale_pad}[v1];"
        f"[{first_audio_label}]aresample=48000[a0];"
        f"[{second_audio_label}]aresample=48000[a1];"
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
        raise RuntimeError(result.stderr.strip() or "Failed to concatenate videos")


def render_video_cta(
    input_path: Path, output_path: Path, cfg: dict[str, Any]
) -> Path | None:
    cta = resolve_cta(cfg["cta"]["selection"])
    main_info = probe_video(input_path)
    layout_format = resolve_format(
        cfg["format"], main_info["width"], main_info["height"]
    )
    font_path: Path | None = None
    with tempfile.TemporaryDirectory(prefix="end-cta-") as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        if cta["type"] == "text":
            card_image = temp_dir / "cta-card.png"
            card_video = temp_dir / "cta-card.mp4"
            font_path = create_text_card(
                card_image,
                (main_info["width"], main_info["height"]),
                cta,
                cfg,
                layout_format,
            )
            make_video_from_still(
                card_image, card_video, cfg["cta"]["duration"], main_info["fps"]
            )
            concat_videos(input_path, card_video, output_path)
        elif cta["type"] == "image":
            card_image = temp_dir / "cta-card.png"
            card_video = temp_dir / "cta-card.mp4"
            create_image_card(
                card_image,
                (main_info["width"], main_info["height"]),
                cta["asset_path"],
                cfg,
                layout_format,
            )
            make_video_from_still(
                card_image, card_video, cfg["cta"]["duration"], main_info["fps"]
            )
            concat_videos(input_path, card_video, output_path)
        else:
            prepared_cta_video = temp_dir / "cta-video.mp4"
            prepare_video_for_concat(
                cta["asset_path"],
                prepared_cta_video,
                (main_info["width"], main_info["height"]),
                main_info["fps"],
            )
            concat_videos(input_path, prepared_cta_video, output_path)
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
    cta = cfg.get("cta")
    if not isinstance(cta, dict):
        errors.append("'cta' must be an object")
    else:
        selection = cta.get("selection")
        if not isinstance(selection, str) or not selection.strip():
            errors.append("'cta.selection' must be a non-empty string")
        duration = cta.get("duration")
        if not isinstance(duration, (int, float)) or duration <= 0:
            errors.append("'cta.duration' must be a positive number")
        position = cta.get("position")
        if position not in VALID_POSITIONS:
            errors.append(
                f"'cta.position' must be one of: {', '.join(sorted(VALID_POSITIONS))}"
            )
        font = cta.get("font")
        if not isinstance(font, str) or not font.strip():
            errors.append("'cta.font' must be 'auto' or a font file path")
        font_size = cta.get("font_size")
        if font_size is not None and (not isinstance(font_size, int) or font_size < 24):
            errors.append("'cta.font_size' must be null or an integer >= 24")
        stroke_width = cta.get("stroke_width")
        if not isinstance(stroke_width, int) or stroke_width < 0:
            errors.append("'cta.stroke_width' must be an integer >= 0")
        preset = cta.get("preset")
        if preset not in PRESETS:
            errors.append(f"'cta.preset' must be one of: {', '.join(sorted(PRESETS))}")
        background = cta.get("background")
        if not isinstance(background, str) or not background.startswith("#"):
            errors.append("'cta.background' must be a hex color string")
    if errors:
        raise ValueError("Config errors:\n  - " + "\n  - ".join(errors))
    return cfg
