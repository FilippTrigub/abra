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
    }

    if args.config:
        config.update(load_config(Path(args.config).expanduser().resolve()))

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
        transcript = (
            transcribe_video_remote(video, remote)
            if remote and remote.enabled
            else None
        )
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
) -> None:
    """Poll input_dir every `interval` seconds and process new videos."""
    log.info("Watching %s every %ds. Press Ctrl+C to stop.", input_dir, interval)
    try:
        while True:
            run_batch(input_dir, output_dir, template, css, remote)
            time.sleep(interval)
    except KeyboardInterrupt:
        log.info("Watch mode stopped.")


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

    output_dir.mkdir(parents=True, exist_ok=True)

    log.info("Input:    %s", input_dir)
    log.info("Output:   %s", output_dir)
    log.info("Template: %s", config["template"])
    if css_path:
        log.info("CSS:      %s", css_path)
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
        )
    else:
        success, failure = run_batch(
            input_dir,
            output_dir,
            str(config["template"]),
            css_path,
            remote,
        )
        log.info("Finished — success: %d, failed: %d", success, failure)
        if failure:
            sys.exit(1)


if __name__ == "__main__":
    main()
