#!/usr/bin/env python3
"""
Caption Service: Batch-process videos, burn in animated captions, save to OUTPUT_DIR.

Usage:
    python caption_service.py [--input DIR] [--output DIR] [--template NAME] [--css FILE]
                               [--watch] [--interval N]

Environment variables:
    INPUT_DIR     - Directory to read videos from  (default: ./input)
    OUTPUT_DIR    - Directory to write videos to   (default: ./output)
    CAPS_TEMPLATE - pycaps template name           (default: minimalist)
    CAPS_CSS      - Path to extra CSS file         (default: none)
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


def process_video(
    input_path: Path,
    output_path: Path,
    template: str,
    css: Path | None = None,
) -> bool:
    """Add animated captions to a single video. Returns True on success."""
    try:
        return _run_pycaps(input_path, output_path, template, css)
    except Exception as exc:
        log.error("Failed to process %s: %s", input_path.name, exc, exc_info=True)
        return False


def _run_pycaps(
    input_path: Path, output_path: Path, template: str, css: Path | None
) -> bool:
    """Add captions to a single video using pycaps. Returns True on success."""
    try:
        from pycaps import TemplateLoader  # type: ignore

        log.info("Captioning: %s → %s", input_path.name, output_path)

        builder = TemplateLoader(template).with_input_video(str(input_path)).load(False)

        if css is not None:
            log.info("Applying custom CSS: %s", css)
            builder = builder.add_css(str(css))

        # Override the output path so the result lands in our output dir.
        if hasattr(builder, "with_output_video"):
            builder = builder.with_output_video(str(output_path))

        pipeline = builder.build()

        # Some pycaps versions accept output_path as run() kwarg.
        run_kwargs: dict = {}
        import inspect

        sig = inspect.signature(pipeline.run)
        if "output_path" in sig.parameters:
            run_kwargs["output_path"] = str(output_path)

        pipeline.run(**run_kwargs)

        # pycaps may write the result next to the input; move it if needed.
        if not output_path.exists():
            default_out = input_path.with_stem(input_path.stem + "_captioned")
            if default_out.exists():
                default_out.rename(output_path)
            else:
                same_dir_out = input_path.parent / output_path.name
                if same_dir_out.exists() and same_dir_out != output_path:
                    same_dir_out.rename(output_path)
                else:
                    log.warning("Output file not found at expected location.")
                    return False

        log.info("Done: %s", output_path)
        return True

    except ImportError:
        log.error(
            "pycaps is not installed. Run: pip install "
            "'git+https://github.com/francozanardi/pycaps.git#egg=pycaps[all]'"
        )
        return False
    except Exception as exc:
        log.error("Failed to caption %s: %s", input_path.name, exc, exc_info=True)
        return False


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
    template: str,
    css: Path | None = None,
) -> tuple[int, int]:
    """Caption all pending videos. Returns (success_count, failure_count)."""
    pending = collect_unprocessed(input_dir, output_dir)
    if not pending:
        log.info("No new videos to process in %s", input_dir)
        return 0, 0

    log.info("Found %d video(s) to process.", len(pending))
    success, failure = 0, 0
    for video in pending:
        output_path = output_dir / video.name
        if process_video(video, output_path, template, css):
            success += 1
        else:
            failure += 1

    return success, failure


def watch_loop(
    input_dir: Path,
    output_dir: Path,
    template: str,
    css: Path | None,
    interval: int = 10,
) -> None:
    """Poll input_dir every `interval` seconds and process new videos."""
    log.info("Watching %s every %ds. Press Ctrl+C to stop.", input_dir, interval)
    try:
        while True:
            run_batch(input_dir, output_dir, template, css)
            time.sleep(interval)
    except KeyboardInterrupt:
        log.info("Watch mode stopped.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch caption videos with pycaps")
    parser.add_argument(
        "--input",
        default=os.environ.get("INPUT_DIR", "input"),
        help="Input directory containing source videos (default: ./input)",
    )
    parser.add_argument(
        "--output",
        default=os.environ.get("OUTPUT_DIR", "output"),
        help="Output directory for captioned videos (default: ./output)",
    )
    parser.add_argument(
        "--template",
        default=os.environ.get("CAPS_TEMPLATE", "minimalist"),
        help="pycaps template name (default: minimalist)",
    )
    parser.add_argument(
        "--css",
        default=os.environ.get("CAPS_CSS"),
        help="Path to an extra CSS file to overlay on the template",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Keep running and watch for new videos",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=10,
        help="Polling interval in seconds when --watch is set (default: 10)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    input_dir = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output).expanduser().resolve()

    if not input_dir.exists():
        log.error("Input directory does not exist: %s", input_dir)
        sys.exit(1)

    css_path: Path | None = None
    if args.css:
        css_path = Path(args.css).expanduser().resolve()
        if not css_path.exists():
            log.error("CSS file does not exist: %s", css_path)
            sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    log.info("Input:    %s", input_dir)
    log.info("Output:   %s", output_dir)
    log.info("Template: %s", args.template)
    if css_path:
        log.info("CSS:      %s", css_path)

    if args.watch:
        watch_loop(input_dir, output_dir, args.template, css_path, args.interval)
    else:
        success, failure = run_batch(input_dir, output_dir, args.template, css_path)
        log.info("Finished — success: %d, failed: %d", success, failure)
        if failure:
            sys.exit(1)


if __name__ == "__main__":
    main()
