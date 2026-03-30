#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from presets import PRESETS
from renderer import (
    IMAGE_EXTENSIONS,
    VIDEO_EXTENSIONS,
    collect_media,
    render_image_hook,
    render_video_hook,
    validate_config,
    validate_environment,
)

VALID_FORMATS = {"auto", "reels", "feed-portrait", "feed-square"}
VALID_POSITIONS = {"upper-middle", "center", "lower-middle"}


def load_config(path: Path) -> dict:
    if not path.exists():
        print(f"Error: config file not found: {path}", file=sys.stderr)
        sys.exit(1)
    with path.open() as file:
        return json.load(file)


def process(config_path: Path) -> None:
    try:
        cfg = validate_config(load_config(config_path))
        validate_environment()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    input_dir = Path(cfg.get("input_dir", "./input"))
    output_dir = Path(cfg.get("output_dir", "./output"))

    if not input_dir.exists():
        print(f"Error: input_dir does not exist: {input_dir}", file=sys.stderr)
        sys.exit(1)

    media_files = collect_media(input_dir)
    if not media_files:
        print(f"No supported media found in {input_dir}")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    print(
        f"Processing {len(media_files)} media file(s) with preset '{cfg['hook']['preset']}'…"
    )
    print()

    succeeded = 0
    failed: list[str] = []
    fonts_used: set[str] = set()

    for media_path in media_files:
        print(f"[{media_path.name}]")
        try:
            if media_path.suffix.lower() in IMAGE_EXTENSIONS:
                out_path = output_dir / media_path.name
                font_path = render_image_hook(media_path, out_path, cfg)
            elif media_path.suffix.lower() in VIDEO_EXTENSIONS:
                out_path = output_dir / f"{media_path.stem}.mp4"
                font_path = render_video_hook(media_path, out_path, cfg)
            else:
                raise ValueError(f"Unsupported media type: {media_path.suffix}")

            fonts_used.add(str(font_path))
            print(f"  → {out_path}")
            succeeded += 1
        except Exception as exc:
            print(f"  ERROR: {exc}", file=sys.stderr)
            failed.append(media_path.name)

    print()
    if fonts_used:
        print("Fonts used:")
        for font in sorted(fonts_used):
            print(f"  - {font}")
        print()

    print(f"Done: {succeeded}/{len(media_files)} succeeded", end="")
    if failed:
        print(f", {len(failed)} failed: {', '.join(failed)}")
        sys.exit(1)
    print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="visual-hook — add scroll-stopping hook overlays"
    )
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--input", help="Override input_dir")
    parser.add_argument("--output", help="Override output_dir")
    parser.add_argument(
        "--format", choices=sorted(VALID_FORMATS), help="Override output format profile"
    )
    parser.add_argument("--text", help="Override hook text")
    parser.add_argument(
        "--preset", choices=sorted(PRESETS), help="Override hook preset"
    )
    parser.add_argument(
        "--position", choices=sorted(VALID_POSITIONS), help="Override hook position"
    )
    parser.add_argument("--font-size", type=int, help="Override hook font size")
    parser.add_argument("--stroke-width", type=int, help="Override hook stroke width")
    parser.add_argument("--duration", type=float, help="Override video hook duration")
    parser.add_argument("--font", help="Override font file path or 'auto'")
    parser.add_argument(
        "--hook-video",
        help="Select a brand hook video by asset name or manifest path; defaults to the manifest default",
    )
    args = parser.parse_args()

    cfg = load_config(Path(args.config))
    cfg.setdefault("hook", {})
    cfg.setdefault("video_hook", {})

    if args.input:
        cfg["input_dir"] = args.input
    if args.output:
        cfg["output_dir"] = args.output
    if args.format:
        cfg["format"] = args.format
    if args.text:
        cfg["hook"]["text"] = args.text
    if args.preset:
        cfg["hook"]["preset"] = args.preset
    if args.position:
        cfg["hook"]["position"] = args.position
    if args.font_size is not None:
        cfg["hook"]["font_size"] = args.font_size
    if args.stroke_width is not None:
        cfg["hook"]["stroke_width"] = args.stroke_width
    if args.duration is not None:
        cfg["hook"]["duration"] = args.duration
    if args.font:
        cfg["hook"]["font"] = args.font
    if args.hook_video:
        cfg["video_hook"]["selection"] = args.hook_video

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
        json.dump(cfg, tmp)
        temp_config = Path(tmp.name)

    try:
        process(temp_config)
    finally:
        temp_config.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
