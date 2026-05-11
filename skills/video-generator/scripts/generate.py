#!/usr/bin/env python3
"""
generate.py — video-generator: cloud video generation via Higgsfield.

Modes (auto-detected unless --mode overrides):
  text-to-video  — prompt only, no images needed
  image-to-video — one MP4 per image in input/ + prompt

Models (--model): kling (default), seedance, dop, dop-preview
  Full IDs listed in MODEL_IDS below. Add more from cloud.higgsfield.ai/explore.
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
import urllib.request
from pathlib import Path
from typing import Any

higgsfield_client: Any = importlib.import_module("higgsfield_client")

INPUT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

BASE_DEFAULTS: dict[str, object] = {
    "model": "kling",
    "duration": 5,
    "aspect_ratio": "16:9",
}

# Model ID strings as documented at docs.higgsfield.ai/guides/video.md
# Find additional model IDs at: https://cloud.higgsfield.ai/explore
MODEL_IDS: dict[str, str] = {
    "kling":       "kling-video/v2.1/pro/image-to-video",
    "seedance":    "bytedance/seedance/v1/pro/image-to-video",
    "dop":         "higgsfield-ai/dop/standard",
    "dop-preview": "higgsfield-ai/dop/preview",
}

VALID_MODELS = list(MODEL_IDS.keys())
VALID_MODES = ["auto", "text-to-video", "image-to-video"]
VALID_ASPECT_RATIOS = ["16:9", "9:16", "1:1"]

PRESETS: dict[str, dict[str, object]] = {
    "cinematic": {
        "model": "kling",
        "duration": 5,
        "aspect_ratio": "16:9",
        "prompt_prefix": "cinematic push-in, warm golden light, subtle depth of field",
        "extra_params": {},
    },
    "social-hook": {
        "model": "seedance",
        "duration": 6,
        "aspect_ratio": "9:16",
        "prompt_prefix": "scroll-stopping social hook, fast opener, bold motion, clear subject",
        "extra_params": {},
    },
    "motion-design-ad": {
        "model": "kling",
        "duration": 8,
        "aspect_ratio": "16:9",
        "prompt_prefix": "clean motion-design ad, polished transitions, product-forward framing",
        "extra_params": {},
    },
    "ecommerce-ad": {
        "model": "kling",
        "duration": 6,
        "aspect_ratio": "9:16",
        "prompt_prefix": "premium ecommerce ad, hero product shots, conversion-focused framing",
        "extra_params": {},
    },
    "brand-story": {
        "model": "kling",
        "duration": 10,
        "aspect_ratio": "16:9",
        "prompt_prefix": "brand story sequence, emotional arc, polished narrative progression",
        "extra_params": {},
    },
    "product-360": {
        "model": "kling",
        "duration": 6,
        "aspect_ratio": "1:1",
        "prompt_prefix": "360-degree product showcase, isolated hero object, controlled studio light",
        "extra_params": {},
    },
}

VALID_PRESETS = list(PRESETS.keys())


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config(path: Path) -> dict:
    if not path.exists():
        print(f"Error: config file not found: {path}", file=sys.stderr)
        sys.exit(1)
    with path.open() as f:
        return json.load(f)


def validate_config(cfg: dict) -> dict:
    errors: list[str] = []

    if not cfg.get("prompt"):
        errors.append("'prompt' is required")

    if cfg.get("preset", "cinematic") not in VALID_PRESETS:
        errors.append(f"'preset' must be one of {VALID_PRESETS}")

    if cfg.get("model", "kling") not in VALID_MODELS:
        errors.append(f"'model' must be one of {VALID_MODELS}")

    if cfg.get("mode", "auto") not in VALID_MODES:
        errors.append(f"'mode' must be one of {VALID_MODES}")

    if cfg.get("aspect_ratio", "16:9") not in VALID_ASPECT_RATIOS:
        errors.append(f"'aspect_ratio' must be one of {VALID_ASPECT_RATIOS}")

    duration = cfg.get("duration", 5)
    if not isinstance(duration, int) or not (3 <= duration <= 16):
        errors.append("'duration' must be an integer between 3 and 16")

    if errors:
        print("Config errors:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)

    return cfg


def normalize_config(cfg: dict) -> dict:
    preset_name = cfg.get("preset", "cinematic")
    preset = PRESETS[preset_name]

    resolved = dict(cfg)
    resolved["preset"] = preset_name

    extra_params = resolved.get("extra_params", {})
    if not isinstance(extra_params, dict):
        print("Error: 'extra_params' must be an object", file=sys.stderr)
        sys.exit(1)

    preset_extra_params = preset.get("extra_params", {})
    if not isinstance(preset_extra_params, dict):
        preset_extra_params = {}

    for key in ("model", "duration", "aspect_ratio"):
        default_value = BASE_DEFAULTS[key]
        if resolved.get(key, default_value) == default_value:
            resolved[key] = preset[key]

    resolved.setdefault("prompt_prefix", preset.get("prompt_prefix", ""))
    merged_extra_params = dict(preset_extra_params)
    merged_extra_params.update(extra_params)
    resolved["extra_params"] = merged_extra_params

    return resolved


# ---------------------------------------------------------------------------
# Auth check
# ---------------------------------------------------------------------------

def check_credentials() -> None:
    """Fail fast if neither HF_KEY nor HF_API_KEY+HF_API_SECRET are set."""
    has_combined = bool(os.environ.get("HF_KEY"))
    has_separate = bool(os.environ.get("HF_API_KEY")) and bool(os.environ.get("HF_API_SECRET"))
    if not (has_combined or has_separate):
        print(
            "Error: Higgsfield credentials not found.\n"
            "\n"
            "Option A — combined key:\n"
            '  export HF_KEY="your-api-key:your-api-secret"\n'
            "\n"
            "Option B — separate vars:\n"
            "  export HF_API_KEY=your-api-key\n"
            "  export HF_API_SECRET=your-api-secret\n"
            "\n"
            "Get credentials at: https://cloud.higgsfield.ai",
            file=sys.stderr,
        )
        sys.exit(1)


# ---------------------------------------------------------------------------
# Image upload
# ---------------------------------------------------------------------------

def upload_image(image_path: Path) -> str:
    """Upload a local image via the SDK and return a hosted URL."""
    print(f"  Uploading {image_path.name}...")
    url = higgsfield_client.upload_file(str(image_path))
    return url


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

def generate_video(
    *,
    model_id: str,
    prompt: str,
    duration: int,
    aspect_ratio: str,
    image_url: str | None = None,
    extra_params: dict | None = None,
) -> dict:
    """Submit a generation job and block until complete, returning the result."""
    arguments: dict = {
        "prompt": prompt,
        "duration": duration,
        "aspect_ratio": aspect_ratio,
    }
    if image_url:
        arguments["image_url"] = image_url
    if extra_params:
        arguments.update(extra_params)

    def on_queue_update(update: object) -> None:
        if isinstance(update, higgsfield_client.InProgress):
            for log in getattr(update, "logs", []):
                print(f"    {log.get('message', log)}")

    print(f"  Submitting to {model_id}...")
    result = higgsfield_client.subscribe(
        model_id,
        arguments=arguments,
        with_logs=True,
        on_queue_update=on_queue_update,
    )
    return result


# ---------------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------------

def _extract_video_url(result: dict) -> str:
    """Extract the video URL from whatever shape the model returns."""
    for key in ("video_url", "output_url", "url", "video", "output"):
        val = result.get(key)
        if isinstance(val, str) and val.startswith("http"):
            return val
        if isinstance(val, dict):
            url = val.get("url")
            if url:
                return url
        if isinstance(val, list) and val:
            first = val[0]
            if isinstance(first, str) and first.startswith("http"):
                return first
            if isinstance(first, dict) and first.get("url"):
                return first["url"]
    raise ValueError(f"No video URL in result. Keys present: {list(result.keys())}")


def download_video(url: str, output_path: Path) -> None:
    print(f"  Downloading...")
    urllib.request.urlretrieve(url, str(output_path))


def compose_prompt(prefix: str, prompt: str) -> str:
    clean_prefix = prefix.strip()
    clean_prompt = prompt.strip()
    if not clean_prefix:
        return clean_prompt
    if clean_prompt.lower().startswith(clean_prefix.lower()):
        return clean_prompt
    return f"{clean_prefix}. {clean_prompt}"


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def process(config_path: Path) -> None:
    cfg = validate_config(normalize_config(load_config(config_path)))
    check_credentials()

    input_dir = Path(cfg.get("input_dir", "./input"))
    output_dir = Path(cfg.get("output_dir", "./output"))
    mode: str = cfg.get("mode", "auto")
    model: str = cfg.get("model", "kling")
    model_id: str = MODEL_IDS[model]
    prompt: str = compose_prompt(str(cfg.get("prompt_prefix", "")), cfg["prompt"])
    duration: int = cfg.get("duration", 5)
    aspect_ratio: str = cfg.get("aspect_ratio", "16:9")
    extra_params: dict = cfg.get("extra_params", {})

    # Collect input images
    images: list[Path] = []
    if input_dir.exists():
        images = sorted(
            p for p in input_dir.iterdir()
            if p.is_file() and p.suffix.lower() in INPUT_EXTENSIONS
        )

    # Resolve mode
    if mode == "auto":
        mode = "image-to-video" if images else "text-to-video"

    if mode == "image-to-video" and not images:
        print(
            f"Error: image-to-video mode requires images in {input_dir}/\n"
            "  Supported: .jpg .jpeg .png .webp",
            file=sys.stderr,
        )
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Mode:     {mode}")
    print(f"Preset:   {cfg.get('preset', 'cinematic')}")
    print(f"Model:    {model}  ({model_id})")
    print(f"Settings: {duration}s · {aspect_ratio}")
    print(f"Prompt:   {prompt[:80]}{'...' if len(prompt) > 80 else ''}")
    print()

    jobs: list[tuple[str, Path | None]] = (
        [(img.stem, img) for img in images]
        if mode == "image-to-video"
        else [("output", None)]
    )

    succeeded, failed = 0, []

    for label, image_path in jobs:
        print(f"[{label}]")
        try:
            image_url: str | None = None
            if image_path is not None:
                image_url = upload_image(image_path)

            result = generate_video(
                model_id=model_id,
                prompt=prompt,
                duration=duration,
                aspect_ratio=aspect_ratio,
                image_url=image_url,
                extra_params=extra_params or None,
            )

            video_url = _extract_video_url(result)
            out_path = output_dir / f"{label}.mp4"
            download_video(video_url, out_path)

            file_size_mb = out_path.stat().st_size / (1024 * 1024)
            print(f"  ✓ Saved: {out_path}  ({file_size_mb:.1f} MB)")
            print(f"    URL:   {video_url}")
            print()
            succeeded += 1

        except Exception as exc:
            print(f"  ERROR: {exc}", file=sys.stderr)
            failed.append(label)

    print(f"Done: {succeeded}/{len(jobs)} succeeded", end="")
    if failed:
        print(f", {len(failed)} failed: {', '.join(failed)}")
        sys.exit(1)
    else:
        print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="video-generator — Higgsfield multi-model cloud video"
    )
    parser.add_argument("--config", default="config.json", help="Path to config JSON")
    parser.add_argument("--input", help="Override input_dir")
    parser.add_argument("--output", help="Override output_dir")
    parser.add_argument("--prompt", help="Override prompt")
    parser.add_argument("--model", choices=VALID_MODELS, help="Override model")
    parser.add_argument("--mode", choices=VALID_MODES, help="Override mode (default: auto)")
    parser.add_argument("--duration", type=int, help="Override duration in seconds (3–16)")
    parser.add_argument(
        "--aspect-ratio", dest="aspect_ratio",
        choices=VALID_ASPECT_RATIOS, help="Override aspect_ratio",
    )
    args = parser.parse_args()

    import tempfile

    cfg = load_config(Path(args.config))

    overrides = {
        "input_dir":    args.input,
        "output_dir":   args.output,
        "prompt":       args.prompt,
        "model":        args.model,
        "mode":         args.mode,
        "duration":     args.duration,
        "aspect_ratio": args.aspect_ratio,
    }
    for key, val in overrides.items():
        if val is not None:
            cfg[key] = val

    cfg = validate_config(normalize_config(cfg))

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
        json.dump(cfg, tmp)
        tmp_path = Path(tmp.name)
    try:
        process(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
