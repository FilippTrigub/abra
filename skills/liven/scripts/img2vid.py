#!/usr/bin/env python3
"""
img2vid.py — liven: animate still images into short video clips via fal.ai LTX-2.3 Fast.

Uses fal.ai's cloud API to run LTX-2.3 image-to-video model. No local GPU required.
API key is embedded in the script (can be overridden by FAL_API_KEY env var).

Usage:
  python scripts/img2vid.py [--config config.json]
  python scripts/img2vid.py --input ./input --output ./output \
      --prompt "slow cinematic push-in, golden hour light"
"""

import argparse
import json
import os
import sys
from pathlib import Path

import fal_client
from PIL import Image

INPUT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".heif"}
MODEL_ID = "fal-ai/ltx-2.3/image-to-video/fast"

# Pricing per second by resolution
PRICING = {
    "1080p": 0.04,
    "1440p": 0.08,
    "2160p": 0.16,
}

# Valid enum values
VALID_DURATIONS = [6, 8, 10, 12, 14, 16, 18, 20]
VALID_RESOLUTIONS = ["1080p", "1440p", "2160p"]
VALID_ASPECT_RATIOS = ["auto", "16:9", "9:16"]
VALID_FPS = [24, 25, 48, 50]


# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

def load_config(path: Path) -> dict:
    if not path.exists():
        print(f"Error: config file not found: {path}", file=sys.stderr)
        sys.exit(1)
    with path.open() as f:
        return json.load(f)


def validate_config(cfg: dict) -> dict:
    errors = []

    if not cfg.get("prompt"):
        errors.append("'prompt' is required")

    # Validate duration
    duration = cfg.get("duration", 6)
    if duration not in VALID_DURATIONS:
        errors.append(f"'duration' must be one of {VALID_DURATIONS}")

    # Validate resolution
    resolution = cfg.get("resolution", "1080p")
    if resolution not in VALID_RESOLUTIONS:
        errors.append(f"'resolution' must be one of {VALID_RESOLUTIONS}")

    # Validate aspect_ratio
    aspect_ratio = cfg.get("aspect_ratio", "auto")
    if aspect_ratio not in VALID_ASPECT_RATIOS:
        errors.append(f"'aspect_ratio' must be one of {VALID_ASPECT_RATIOS}")

    # Validate fps
    fps = cfg.get("fps", 25)
    if fps not in VALID_FPS:
        errors.append(f"'fps' must be one of {VALID_FPS}")

    # Check constraints: durations > 10s only support 25 FPS and 1080p
    if duration > 10 and (fps != 25 or resolution != "1080p"):
        errors.append("durations > 10 seconds only support 25 FPS and 1080p resolution")

    if errors:
        print("Config errors:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    return cfg


# -----------------------------------------------------------------------------
# API Key Check
# -----------------------------------------------------------------------------

# Default API key (can be overridden by FAL_API_KEY env var)


def check_api_key() -> str:
    """Get API key from environment or use default."""
    api_key = os.environ.get("FAL_API_KEY")
    return api_key


# -----------------------------------------------------------------------------
# File Upload
# -----------------------------------------------------------------------------

def upload_image(image_path: Path) -> str:
    """Upload a local image to fal.media and return the URL."""
    print(f"  Uploading {image_path.name} to fal.media...")
    try:
        url = fal_client.upload_file(str(image_path))
        return url
    except Exception as e:
        print(f"  ERROR uploading file: {e}", file=sys.stderr)
        raise


# -----------------------------------------------------------------------------
# Video Generation
# -----------------------------------------------------------------------------

def generate_video(
    image_url: str,
    prompt: str,
    duration: int,
    resolution: str,
    aspect_ratio: str,
    fps: int,
    generate_audio: bool,
    end_image_url: str | None = None,
) -> dict:
    """Generate video using fal.ai API."""

    arguments = {
        "image_url": image_url,
        "prompt": prompt,
        "duration": duration,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "fps": fps,
        "generate_audio": generate_audio,
    }

    if end_image_url:
        arguments["end_image_url"] = end_image_url

    def on_queue_update(update):
        if isinstance(update, fal_client.InProgress):
            for log in update.logs:
                print(f"    {log['message']}")

    print(f"  Submitting to fal.ai (LTX-2.3 Fast)...")
    print(f"    Duration: {duration}s, Resolution: {resolution}, FPS: {fps}")
    if generate_audio:
        print(f"    Audio: enabled")

    result = fal_client.subscribe(
        MODEL_ID,
        arguments=arguments,
        with_logs=True,
        on_queue_update=on_queue_update,
    )

    return result


def download_video(video_url: str, output_path: Path) -> None:
    """Download video from URL to local path."""
    import urllib.request

    print(f"  Downloading video...")
    try:
        urllib.request.urlretrieve(video_url, str(output_path))
    except Exception as e:
        print(f"  ERROR downloading video: {e}", file=sys.stderr)
        raise


def calculate_cost(duration: int, resolution: str, num_videos: int = 1) -> float:
    """Calculate estimated cost for video generation."""
    price_per_sec = PRICING.get(resolution, 0.04)
    return duration * price_per_sec * num_videos


# -----------------------------------------------------------------------------
# Main pipeline
# -----------------------------------------------------------------------------

def process(config_path: Path) -> None:
    cfg = validate_config(load_config(config_path))
    check_api_key()

    input_dir = Path(cfg.get("input_dir", "./input"))
    output_dir = Path(cfg.get("output_dir", "./output"))
    prompt = cfg["prompt"]
    duration = cfg.get("duration", 6)
    resolution = cfg.get("resolution", "1080p")
    aspect_ratio = cfg.get("aspect_ratio", "auto")
    fps = cfg.get("fps", 25)
    generate_audio = cfg.get("generate_audio", True)
    end_image_url = cfg.get("end_image_url")

    if not input_dir.exists():
        print(f"Error: input_dir does not exist: {input_dir}", file=sys.stderr)
        sys.exit(1)

    images = sorted(
        p for p in input_dir.iterdir()
        if p.is_file() and p.suffix.lower() in INPUT_EXTENSIONS
    )

    if not images:
        print(f"No images found in {input_dir}")
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    # Calculate estimated cost
    estimated_cost = calculate_cost(duration, resolution, len(images))
    print(f"Processing {len(images)} image(s):")
    print(f"  Settings: {duration}s @ {resolution}, {fps}fps")
    print(f"  Estimated cost: ${estimated_cost:.2f}")
    print(f"  Prompt: {prompt[:80]}{'...' if len(prompt) > 80 else ''}")
    print()

    succeeded, failed = 0, []

    for img_path in images:
        print(f"[{img_path.name}]")
        try:
            # Upload image
            image_url = upload_image(img_path)

            # Upload end image if provided as a path
            end_url = None
            if end_image_url:
                end_path = Path(end_image_url)
                if end_path.exists():
                    end_url = upload_image(end_path)
                else:
                    # Assume it's already a URL
                    end_url = end_image_url

            # Generate video
            result = generate_video(
                image_url=image_url,
                prompt=prompt,
                duration=duration,
                resolution=resolution,
                aspect_ratio=aspect_ratio,
                fps=fps,
                generate_audio=generate_audio,
                end_image_url=end_url,
            )

            # Download video
            video_info = result.get("video", {})
            video_url = video_info.get("url")

            if not video_url:
                print(f"  ERROR: No video URL in response", file=sys.stderr)
                failed.append(img_path.name)
                continue

            out_path = output_dir / (img_path.stem + ".mp4")
            download_video(video_url, out_path)

            # Print results
            file_size_mb = out_path.stat().st_size / (1024 * 1024)
            width = video_info.get("width", "?")
            height = video_info.get("height", "?")
            actual_fps = video_info.get("fps", fps)
            actual_duration = video_info.get("duration", duration)

            print(f"  ✓ Saved to: {out_path}")
            print(f"    Size: {file_size_mb:.1f} MB, Resolution: {width}x{height}")
            print(f"    Duration: {actual_duration}s, FPS: {actual_fps}")
            print(f"    fal.media URL: {video_url}")
            print()

            succeeded += 1

        except Exception as exc:
            print(f"  ERROR: {exc}", file=sys.stderr)
            failed.append(img_path.name)

    # Summary
    print(f"Done: {succeeded}/{len(images)} succeeded", end="")
    if failed:
        print(f", {len(failed)} failed: {', '.join(failed)}")
        sys.exit(1)
    else:
        print()

    # Final cost
    actual_cost = calculate_cost(duration, resolution, succeeded)
    print(f"Total cost: ${actual_cost:.2f}")


def main() -> None:
    parser = argparse.ArgumentParser(description="fal-image2video — cloud image to video")
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--input", help="Override input_dir")
    parser.add_argument("--output", help="Override output_dir")
    parser.add_argument("--prompt", help="Override prompt")
    parser.add_argument("--duration", type=int, help="Override duration (6-20)")
    parser.add_argument("--resolution", help="Override resolution (1080p, 1440p, 2160p)")
    parser.add_argument("--aspect-ratio", help="Override aspect ratio (auto, 16:9, 9:16)")
    parser.add_argument("--fps", type=int, help="Override fps (24, 25, 48, 50)")
    parser.add_argument("--end-image", help="End image for transition (path or URL)")
    parser.add_argument("--no-audio", action="store_true", help="Disable audio generation")
    args = parser.parse_args()

    cfg = validate_config(load_config(Path(args.config)))

    if args.input:
        cfg["input_dir"] = args.input
    if args.output:
        cfg["output_dir"] = args.output
    if args.prompt:
        cfg["prompt"] = args.prompt
    if args.duration is not None:
        cfg["duration"] = args.duration
    if args.resolution:
        cfg["resolution"] = args.resolution
    if args.aspect_ratio:
        cfg["aspect_ratio"] = args.aspect_ratio
    if args.fps is not None:
        cfg["fps"] = args.fps
    if args.end_image:
        cfg["end_image_url"] = args.end_image
    if args.no_audio:
        cfg["generate_audio"] = False

    import tempfile as _tf, json as _json
    with _tf.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
        _json.dump(cfg, tmp)
        tmp_path = Path(tmp.name)
    try:
        process(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
