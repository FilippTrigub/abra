"""
enhance.py — Batch-process videos: sharpening + colour grading + audio normalisation.

Pipeline per video:
  1. Apply unsharp + eq filters (ffmpeg-python) → temp file
  2. Normalise audio to -14 LUFS (EBU R128) via ffmpeg-normalize → output

Usage:
    python enhance.py --input DIR --output DIR --preset natural|cinematic|vivid

Environment variables:
    INPUT_DIR    - Input directory  (default: ./input)
    OUTPUT_DIR   - Output directory (default: ./output)
    VIDEO_PRESET - Preset name      (required if --preset not given)
"""

import argparse
import logging
import os
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}

PRESETS: dict[str, dict] = {
    "natural": {
        "unsharp": (3, 3, 0.8),
        "eq": {"brightness": 0.02, "contrast": 1.05, "saturation": 1.1},
        "colorbalance": None,
    },
    "cinematic": {
        # Instagram-ready: sharp, vibrant, warm
        "unsharp": (5, 5, 2.0),
        "eq": {"brightness": 0.02, "contrast": 1.2, "saturation": 1.35},
        # Boost reds/suppress blues in shadows + midtones for warmth
        "colorbalance": {
            "rs": 0.15,
            "gs": 0.03,
            "bs": -0.18,
            "rm": 0.10,
            "gm": 0.02,
            "bm": -0.12,
        },
    },
    "vivid": {
        "unsharp": (5, 5, 1.5),
        "eq": {"brightness": 0.05, "contrast": 1.2, "saturation": 1.4},
        "colorbalance": None,
    },
}


def enhance_video(input_path: Path, output_path: Path, preset_name: str) -> bool:
    """
    Enhance a single video using a named preset.

    Steps:
      1. Apply unsharp + eq filters (ffmpeg-python) → temp file
      2. Normalise audio to -14 LUFS (ffmpeg-normalize) → output_path
      3. Clean up temp file

    Returns True on success, False on failure.
    """
    if preset_name not in PRESETS:
        raise ValueError(
            f"Unknown preset '{preset_name}'. Available: {', '.join(PRESETS)}"
        )

    preset = PRESETS[preset_name]
    unsharp = preset["unsharp"]
    eq = preset["eq"]
    colorbalance = preset.get("colorbalance")

    tmp_path = input_path.parent / (input_path.stem + f".{preset_name}_filtered.mp4")

    try:
        _apply_filters(input_path, tmp_path, unsharp, eq, colorbalance)
        _normalise_audio(tmp_path, output_path)
        return True
    except Exception as exc:
        log.error("Enhancement failed for %s: %s", input_path.name, exc, exc_info=True)
        return False
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def _apply_filters(
    input_path: Path,
    output_path: Path,
    unsharp: tuple,
    eq: dict,
    colorbalance: dict | None = None,
) -> None:
    """Apply unsharp mask, eq colour grading, and optional warmth via ffmpeg-python."""
    import ffmpeg  # type: ignore

    luma_x, luma_y, luma_amount = unsharp

    stream = (
        ffmpeg.input(str(input_path))
        .video.filter(
            "unsharp", luma_msize_x=luma_x, luma_msize_y=luma_y, luma_amount=luma_amount
        )
        .filter(
            "eq",
            brightness=eq["brightness"],
            contrast=eq["contrast"],
            saturation=eq["saturation"],
        )
    )

    if colorbalance is not None:
        stream = stream.filter("colorbalance", **colorbalance)

    audio = ffmpeg.input(str(input_path)).audio

    (
        ffmpeg.output(stream, audio, str(output_path), acodec="copy")
        .overwrite_output()
        .run(quiet=True)
    )
    log.info("Filters applied: %s → %s", input_path.name, output_path.name)


def _normalise_audio(input_path: Path, output_path: Path) -> None:
    """Normalise audio to -14 LUFS EBU R128, true peak -1 dBTP."""
    from ffmpeg_normalize import FFmpegNormalize  # type: ignore

    normalizer = FFmpegNormalize(
        normalization_type="ebu",
        target_level=-14.0,
        true_peak=-1.0,
        loudness_range_target=7.0,
        audio_codec="aac",
        video_disable=False,
        output_format="mp4",
    )
    normalizer.add_media_file(str(input_path), str(output_path))
    normalizer.run_normalization()
    log.info("Audio normalised: %s → %s", input_path.name, output_path.name)


def collect_unprocessed(input_dir: Path, output_dir: Path) -> list[Path]:
    """Return video files in input_dir that don't yet have a match in output_dir."""
    pending = []
    for p in sorted(input_dir.iterdir()):
        if p.suffix.lower() not in VIDEO_EXTENSIONS:
            continue
        if not (output_dir / p.name).exists():
            pending.append(p)
    return pending


def run_batch(
    input_dir: Path,
    output_dir: Path,
    preset_name: str,
) -> tuple[int, int]:
    """Enhance all pending videos. Returns (success_count, failure_count)."""
    pending = collect_unprocessed(input_dir, output_dir)
    if not pending:
        log.info("No new videos to process in %s", input_dir)
        return 0, 0

    log.info(
        "Found %d video(s) to process with preset '%s'.", len(pending), preset_name
    )
    success, failure = 0, 0
    for video in pending:
        output_path = output_dir / video.name
        if enhance_video(video, output_path, preset_name):
            success += 1
        else:
            failure += 1

    return success, failure


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch enhance videos (sharpening + colour grade + audio normalisation)"
    )
    parser.add_argument(
        "--input",
        default=os.environ.get("INPUT_DIR", "input"),
        help="Input directory containing source videos (default: ./input)",
    )
    parser.add_argument(
        "--output",
        default=os.environ.get("OUTPUT_DIR", "output"),
        help="Output directory for enhanced videos (default: ./output)",
    )
    parser.add_argument(
        "--preset",
        default=os.environ.get("VIDEO_PRESET"),
        choices=list(PRESETS),
        required=not os.environ.get("VIDEO_PRESET"),
        help="Enhancement preset: natural | cinematic | vivid",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    input_dir = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output).expanduser().resolve()

    if not input_dir.exists():
        log.error("Input directory does not exist: %s", input_dir)
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    log.info("Input:  %s", input_dir)
    log.info("Output: %s", output_dir)
    log.info("Preset: %s", args.preset)

    success, failure = run_batch(input_dir, output_dir, args.preset)
    log.info("Finished — success: %d, failed: %d", success, failure)
    if failure:
        sys.exit(1)


if __name__ == "__main__":
    main()
