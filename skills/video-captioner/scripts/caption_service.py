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
import importlib
import json
import logging
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

_providers_module = importlib.import_module("skills._providers")
DEFAULT_HF_TOKEN_ENV = _providers_module.DEFAULT_HF_TOKEN_ENV
DEFAULT_REMOTE_TIMEOUT_SECONDS = _providers_module.DEFAULT_REMOTE_TIMEOUT_SECONDS
DEFAULT_REPLICATE_API_KEY_ENV = _providers_module.DEFAULT_REPLICATE_API_KEY_ENV
merge_remote_provider_overrides = _providers_module.merge_remote_provider_overrides
remote_provider_from_config = _providers_module.remote_provider_from_config

_hf_provider_module = importlib.import_module("skills._providers.huggingface")
HuggingFaceProvider = _hf_provider_module.HuggingFaceProvider

_replicate_provider_module = importlib.import_module("skills._providers.replicate")
ReplicateProvider = _replicate_provider_module.ReplicateProvider

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
DEFAULT_REMOTE_HF_MODEL = "openai/whisper-large-v3"


def load_config(path: Path) -> dict:
    if not path.exists():
        log.error("Config file does not exist: %s", path)
        sys.exit(1)
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def build_runtime_config(args: argparse.Namespace) -> dict[str, object]:
    config: dict[str, object] = {
        "input": os.environ.get("INPUT_DIR", "input"),
        "output": os.environ.get("OUTPUT_DIR", "output"),
        "template": os.environ.get("CAPS_TEMPLATE", "minimalist"),
        "css": os.environ.get("CAPS_CSS"),
        "watch": False,
        "interval": 10,
        "transcription_provider": None,
        "remote_model": None,
        "hf_token_env": DEFAULT_HF_TOKEN_ENV,
        "replicate_api_key_env": DEFAULT_REPLICATE_API_KEY_ENV,
        "remote_timeout_seconds": DEFAULT_REMOTE_TIMEOUT_SECONDS,
        "static_captions": None,
        "caption_bg_color": None,
        "caption_color": None,
        "caption_font_size": None,
        "caption_font": None,
        "caption_padding": None,
        "caption_margin": None,
    }

    if args.config:
        config.update(load_config(Path(args.config).expanduser().resolve()))

    # Load style config (default: config.default.json)
    style_config_file = args.style_config if hasattr(args, "style_config") and args.style_config else None
    if style_config_file:
        style_config_path = Path(style_config_file).expanduser().resolve()
    else:
        # Default to config.default.json in the skill directory
        style_config_path = Path(__file__).parent.parent / "config.default.json"

    if style_config_path.exists():
        style_config = load_style_config(style_config_path)
        # Apply style config values to the config
        for key in ["caption_bg_color", "caption_color", "caption_font_size", "caption_font", "caption_padding", "caption_margin"]:
            if key in style_config and style_config[key] is not None:
                config[key] = style_config[key]

    if args.input is not None:
        config["input"] = args.input
    if args.output is not None:
        config["output"] = args.output
    if args.template is not None:
        config["template"] = args.template
    if args.css is not None:
        config["css"] = args.css
    if args.watch:
        config["watch"] = True
    if args.interval is not None:
        config["interval"] = args.interval
    if args.transcription_provider is not None:
        config["transcription_provider"] = args.transcription_provider
    if args.remote_model is not None:
        config["remote_model"] = args.remote_model
    if args.hf_token_env is not None:
        config["hf_token_env"] = args.hf_token_env
    if args.replicate_api_key_env is not None:
        config["replicate_api_key_env"] = args.replicate_api_key_env
    if args.remote_timeout_seconds is not None:
        config["remote_timeout_seconds"] = args.remote_timeout_seconds
    if args.captions is not None:
        config["static_captions"] = args.captions

    # CLI flags override config file values
    if hasattr(args, "caption_bg_color") and args.caption_bg_color is not None:
        config["caption_bg_color"] = args.caption_bg_color
    if hasattr(args, "caption_color") and args.caption_color is not None:
        config["caption_color"] = args.caption_color
    if hasattr(args, "caption_font_size") and args.caption_font_size is not None:
        config["caption_font_size"] = args.caption_font_size
    if hasattr(args, "caption_font") and args.caption_font is not None:
        config["caption_font"] = args.caption_font
    if hasattr(args, "caption_padding") and args.caption_padding is not None:
        config["caption_padding"] = args.caption_padding
    if hasattr(args, "caption_margin") and args.caption_margin is not None:
        config["caption_margin"] = args.caption_margin

    return config


def _int_config_value(config: dict[str, object], key: str, default: int) -> int:
    value = config.get(key, default)
    return value if isinstance(value, int) and not isinstance(value, bool) else default


def _string_config_value(
    config: dict[str, object], key: str, default: str | None = None
) -> str | None:
    value = config.get(key, default)
    if value is None:
        return None
    return value if isinstance(value, str) and value.strip() else default


def extract_audio(video_path: Path, audio_path: Path) -> None:
    result = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ac",
            "1",
            "-ar",
            "16000",
            str(audio_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise ValueError(result.stderr.strip() or "ffmpeg audio extraction failed")


def transcribe_video_remote(video_path: Path, remote) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="caption_service_") as tmp_dir:
        audio_path = Path(tmp_dir) / f"{video_path.stem}.wav"
        extract_audio(video_path, audio_path)
        if remote.provider == "huggingface":
            provider = HuggingFaceProvider(remote)
            raw_result = provider.automatic_speech_recognition(
                audio_path,
                model=remote.remote_model or DEFAULT_REMOTE_HF_MODEL,
                return_timestamps=True,
            )
        elif remote.provider == "replicate":
            remote_model = remote.remote_model
            if not remote_model:
                raise ValueError(
                    "replicate remote transcription requires 'remote_model' to be set"
                )
            provider = ReplicateProvider(remote)
            raw_result = provider.automatic_speech_recognition(
                audio_path,
                model=remote_model,
            )
        else:
            raise ValueError(f"unsupported remote provider: {remote.provider}")

    return normalize_remote_transcript(raw_result)


def normalize_remote_transcript(raw_result: object) -> dict[str, object]:
    if isinstance(raw_result, str):
        return {"segments": [{"start": 0.0, "end": 0.0, "text": raw_result.strip()}]}
    if not isinstance(raw_result, dict):
        raise ValueError("unsupported remote transcript response shape")

    if isinstance(raw_result.get("segments"), list):
        return {"segments": _normalize_segments(raw_result.get("segments"))}
    if isinstance(raw_result.get("chunks"), list):
        return {"segments": _normalize_segments(raw_result.get("chunks"))}
    if isinstance(raw_result.get("output"), dict):
        output = raw_result["output"]
        if isinstance(output, dict):
            return normalize_remote_transcript(output)
    if isinstance(raw_result.get("output"), str):
        return {
            "segments": [
                {"start": 0.0, "end": 0.0, "text": str(raw_result["output"]).strip()}
            ]
        }
    if isinstance(raw_result.get("text"), str):
        return {
            "segments": [
                {"start": 0.0, "end": 0.0, "text": str(raw_result["text"]).strip()}
            ]
        }
    raise ValueError("remote transcript response did not contain text or segments")


def _normalize_segments(segments: object) -> list[dict[str, object]]:
    if not isinstance(segments, list):
        return []
    normalized: list[dict[str, object]] = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        text = str(segment.get("text") or "").strip()
        if not text:
            continue
        start = _coerce_float(segment.get("start") or segment.get("chunk_start") or 0.0)
        end = _coerce_float(segment.get("end") or segment.get("chunk_end") or start)
        normalized.append({"start": start, "end": end, "text": text})
    return normalized


def _coerce_float(value: object) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return 0.0
    return 0.0


def process_video(
    input_path: Path,
    output_path: Path,
    template: str,
    css: Path | None = None,
    remote_transcript: dict[str, object] | Path | None = None,
) -> bool:
    """Add animated captions to a single video. Returns True on success."""
    try:
        return _run_pycaps(input_path, output_path, template, css, remote_transcript)
    except Exception as exc:
        log.error("Failed to process %s: %s", input_path.name, exc, exc_info=True)
        return False


def _run_pycaps(
    input_path: Path,
    output_path: Path,
    template: str,
    css: Path | None,
    remote_transcript: dict[str, object] | Path | None = None,
) -> bool:
    """Add captions to a single video using pycaps. Returns True on success."""
    try:
        from pycaps import TemplateLoader  # type: ignore

        log.info("Captioning: %s → %s", input_path.name, output_path)

        builder = TemplateLoader(template).with_input_video(str(input_path)).load(False)

        if css is not None:
            log.info("Applying custom CSS: %s", css)
            builder = builder.add_css(str(css))

        if remote_transcript is not None:
            if isinstance(remote_transcript, Path):
                builder = builder.with_transcription_file(str(remote_transcript))
            else:
                builder = builder.with_transcription(remote_transcript)

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
    remote=None,
    static_transcript: dict[str, object] | None = None,
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
        # Use static captions if provided, otherwise try remote transcription
        transcript = static_transcript
        if transcript is None and remote and remote.enabled:
            transcript = transcribe_video_remote(video, remote)
        if process_video(video, output_path, template, css, transcript):
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
    remote=None,
    static_transcript: dict[str, object] | None = None,
) -> None:
    """Poll input_dir every `interval` seconds and process new videos."""
    log.info("Watching %s every %ds. Press Ctrl+C to stop.", input_dir, interval)
    try:
        while True:
            run_batch(input_dir, output_dir, template, css, remote, static_transcript)
            time.sleep(interval)
    except KeyboardInterrupt:
        log.info("Watch mode stopped.")


def parse_time_format(time_str: str) -> float:
    """Convert M:SS or MM:SS format to seconds."""
    parts = time_str.split(":")
    if len(parts) != 2:
        raise ValueError(f"Invalid time format: {time_str}. Use M:SS or MM:SS")
    try:
        minutes = int(parts[0])
        seconds = int(parts[1])
        return minutes * 60 + seconds
    except ValueError:
        raise ValueError(f"Invalid time format: {time_str}. Use M:SS or MM:SS")


def parse_caption_arg(caption_arg: str) -> dict[str, object]:
    """Parse a caption argument: 'START-END: TEXT' into a segment dict."""
    # Format: "0:01-0:05: Hello world"
    # Split on the last ": " to separate time range from text
    if ": " not in caption_arg:
        raise ValueError(
            f"Invalid caption format: {caption_arg}. Use 'START-END: TEXT' "
            "(e.g., '0:01-0:05: Hello world')"
        )

    time_part, text = caption_arg.rsplit(": ", 1)
    text = text.strip()
    if not text:
        raise ValueError(f"Caption text cannot be empty: {caption_arg}")

    if "-" not in time_part:
        raise ValueError(
            f"Invalid time range format: {time_part}. Use 'START-END' "
            "(e.g., '0:01-0:05')"
        )

    start_str, end_str = time_part.split("-", 1)
    start = parse_time_format(start_str.strip())
    end = parse_time_format(end_str.strip())

    if start > end:
        raise ValueError(
            f"Start time ({start_str}) must be <= end time ({end_str}): {caption_arg}"
        )

    return {"start": start, "end": end, "text": text}


def build_static_transcript(caption_args: list[str] | None) -> dict[str, object] | None:
    """Convert caption CLI args into a pycaps transcript dict."""
    if not caption_args:
        return None

    segments = []
    for caption_arg in caption_args:
        try:
            segment = parse_caption_arg(caption_arg)
            segments.append(segment)
        except ValueError as exc:
            log.error(str(exc))
            sys.exit(1)

    if not segments:
        return None

    segments.sort(key=lambda s: s["start"])
    return {"segments": segments}


def load_style_config(config_path: Path) -> dict[str, object]:
    """Load caption styling from a JSON config file."""
    if not config_path.exists():
        log.error("Style config file does not exist: %s", config_path)
        sys.exit(1)
    with config_path.open(encoding="utf-8") as f:
        return json.load(f)


def build_caption_css(
    bg_color: str | None = None,
    text_color: str | None = None,
    font_size: int | None = None,
    font: str | None = None,
    padding: str | None = None,
    margin: str | None = None,
) -> str:
    """Generate CSS for caption styling from provided values."""
    # These should be pre-loaded from config file, not defaulted here
    bg = bg_color or "#FFFFFF"
    color = text_color or "#0066FF"
    pad = padding or "10px 15px"
    marg = margin or "0"
    font_family = font or "Courier New"

    css_rules = [
        "span.word {",
        f"  background-color: {bg};",
        f"  color: {color};",
        f"  padding: {pad};",
        f"  margin: {marg};",
        f"  font-family: '{font_family}';",
    ]

    if font_size:
        css_rules.append(f"  font-size: {font_size}px;")

    css_rules.append("}")

    return "\n".join(css_rules)


def save_generated_css(css_content: str, skill_dir: Path) -> Path:
    """Save generated CSS to a temp file and return its path."""
    css_file = skill_dir / "generated_styles.css"
    with css_file.open("w", encoding="utf-8") as f:
        f.write(css_content)
    return css_file


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch caption videos with pycaps")
    parser.add_argument(
        "--config",
        help="Optional config JSON file for non-interactive or remote-transcription settings",
    )
    parser.add_argument(
        "--input",
        help="Input directory containing source videos (default: ./input or INPUT_DIR)",
    )
    parser.add_argument(
        "--output",
        help="Output directory for captioned videos (default: ./output or OUTPUT_DIR)",
    )
    parser.add_argument(
        "--template",
        help="pycaps template name (default: minimalist or CAPS_TEMPLATE)",
    )
    parser.add_argument(
        "--css",
        help="Path to an extra CSS file to overlay on the template",
    )
    parser.add_argument(
        "--caption",
        action="append",
        dest="captions",
        help="Static caption with timing: 'START-END: TEXT' (e.g., '0:01-0:05: Hello world'). "
        "Use multiple times for multiple captions.",
    )
    parser.add_argument(
        "--style-config",
        help="JSON config file for caption styling (default: config.default.json)",
    )
    parser.add_argument(
        "--caption-bg-color",
        help="Override config: caption background color (hex or CSS color)",
    )
    parser.add_argument(
        "--caption-color",
        help="Caption text color (hex or CSS color, default: #0066FF)",
    )
    parser.add_argument(
        "--caption-font-size",
        type=int,
        help="Caption font size in pixels (default: auto-scale)",
    )
    parser.add_argument(
        "--caption-font",
        help="Caption font family or path to .ttf file (e.g., 'DejaVu Sans Bold')",
    )
    parser.add_argument(
        "--caption-padding",
        help="Caption padding (CSS format, e.g., '10px 20px')",
    )
    parser.add_argument(
        "--caption-margin",
        help="Caption margin (CSS format, e.g., '10px 0')",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Keep running and watch for new videos",
    )
    parser.add_argument(
        "--interval",
        type=int,
        help="Polling interval in seconds when --watch is set (default: 10)",
    )
    parser.add_argument(
        "--transcription-provider",
        choices=["huggingface", "replicate"],
        help="Optional remote provider for transcription only; rendering remains local",
    )
    parser.add_argument(
        "--remote-model",
        help="Optional remote transcription model override for the selected provider",
    )
    parser.add_argument(
        "--hf-token-env",
        help=f"Environment variable name for HuggingFace auth (default: {DEFAULT_HF_TOKEN_ENV})",
    )
    parser.add_argument(
        "--replicate-api-key-env",
        help=f"Environment variable name for Replicate auth (default: {DEFAULT_REPLICATE_API_KEY_ENV})",
    )
    parser.add_argument(
        "--remote-timeout-seconds",
        type=int,
        help=f"Remote provider timeout in seconds (default: {DEFAULT_REMOTE_TIMEOUT_SECONDS})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = build_runtime_config(args)

    # Build static transcript from caption args if provided
    static_captions = config.get("static_captions")
    static_transcript: dict[str, object] | None = None
    if static_captions:
        static_transcript = build_static_transcript(static_captions)

    remote = remote_provider_from_config(
        merge_remote_provider_overrides(
            {
                "provider": config.get("transcription_provider"),
                "remote_model": config.get("remote_model"),
                "hf_token_env": config.get("hf_token_env"),
                "replicate_api_key_env": config.get("replicate_api_key_env"),
                "remote_timeout_seconds": config.get("remote_timeout_seconds"),
            },
            provider=_string_config_value(config, "transcription_provider"),
            remote_model=_string_config_value(config, "remote_model"),
            hf_token_env=_string_config_value(config, "hf_token_env"),
            replicate_api_key_env=_string_config_value(config, "replicate_api_key_env"),
            remote_timeout_seconds=(
                config.get("remote_timeout_seconds")
                if isinstance(config.get("remote_timeout_seconds"), int)
                else None
            ),
        ),
        supported_providers={"huggingface", "replicate"},
    )

    input_dir = Path(str(config["input"])).expanduser().resolve()
    output_dir = Path(str(config["output"])).expanduser().resolve()
    skill_dir = Path(__file__).parent.parent

    if not input_dir.exists():
        log.error("Input directory does not exist: %s", input_dir)
        sys.exit(1)

    css_path: Path | None = None
    css_value = config.get("css")
    if isinstance(css_value, str) and css_value.strip():
        css_path = Path(css_value).expanduser().resolve()
        if not css_path.exists():
            log.error("CSS file does not exist: %s", css_path)
            sys.exit(1)

    # Generate CSS for static captions (with defaults applied automatically)
    if static_transcript:
        generated_css = build_caption_css(
            bg_color=config.get("caption_bg_color"),
            text_color=config.get("caption_color"),
            font_size=config.get("caption_font_size"),
            font=config.get("caption_font"),
            padding=config.get("caption_padding"),
            margin=config.get("caption_margin"),
        )
        css_path = save_generated_css(generated_css, skill_dir)
        log.info("Applied default caption styling (white bg, blue text, Courier New)")

    output_dir.mkdir(parents=True, exist_ok=True)

    log.info("Input:    %s", input_dir)
    log.info("Output:   %s", output_dir)
    log.info("Template: %s", config["template"])
    if css_path:
        log.info("CSS:      %s", css_path)
    if static_transcript:
        num_captions = len(static_transcript.get("segments", []))
        log.info("Using %d static caption(s)", num_captions)
        log.info("Caption style: bg=%s, color=%s, font=%s, padding=%s",
                 config.get("caption_bg_color"),
                 config.get("caption_color"),
                 config.get("caption_font"),
                 config.get("caption_padding"))
    if config.get("transcription_provider"):
        log.info("Remote transcription provider: %s", config["transcription_provider"])
        if config.get("remote_model"):
            log.info("Remote transcription model: %s", config["remote_model"])

    if bool(config["watch"]):
        interval = _int_config_value(config, "interval", 10)
        watch_loop(
            input_dir,
            output_dir,
            str(config["template"]),
            css_path,
            interval,
            remote,
            static_transcript,
        )
    else:
        success, failure = run_batch(
            input_dir,
            output_dir,
            str(config["template"]),
            css_path,
            remote,
            static_transcript,
        )
        log.info("Finished — success: %d, failed: %d", success, failure)
        if failure:
            sys.exit(1)


if __name__ == "__main__":
    main()
