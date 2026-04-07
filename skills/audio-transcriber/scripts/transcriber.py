#!/usr/bin/env python3
"""
Audio transcription skill using HuggingFace ASR models.
Extracts audio from video and transcribes using transformers library.
"""

import argparse
import importlib
import json
import os
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

_providers_module = importlib.import_module("skills._providers")
merge_remote_provider_overrides = _providers_module.merge_remote_provider_overrides
remote_provider_from_config = _providers_module.remote_provider_from_config

_hf_provider_module = importlib.import_module("skills._providers.huggingface")
HuggingFaceProvider = _hf_provider_module.HuggingFaceProvider

_replicate_provider_module = importlib.import_module("skills._providers.replicate")
ReplicateProvider = _replicate_provider_module.ReplicateProvider


def load_config(config_path: str) -> dict:
    """Load configuration from JSON file."""
    with open(config_path, "r") as f:
        return json.load(f)


def extract_audio(video_path: str, output_path: str, sample_rate: int = 16000) -> str:
    """Extract audio from video file using ffmpeg-python."""
    ffmpeg = importlib.import_module("ffmpeg")

    (
        ffmpeg.input(video_path)
        .output(
            output_path, acodec="pcm_s16le", ac=1, ar=str(sample_rate), **{"y": None}
        )
        .run(capture_stdout=True, capture_stderr=True, quiet=True)
    )
    return output_path


def get_cache_dir() -> str:
    """Get HuggingFace cache directory from environment or default."""
    return os.environ.get(
        "HF_HOME",
        os.environ.get(
            "HUGGINGFACE_HUB_CACHE", os.path.expanduser("~/.cache/huggingface")
        ),
    )


def transcribe_audio(
    audio_path: str, model_id: str, device: str, language: str
) -> dict | list:
    librosa = importlib.import_module("librosa")
    torch = importlib.import_module("torch")
    transformers = importlib.import_module("transformers")

    # Load audio
    audio, sr = librosa.load(audio_path, sr=16000)

    # Determine dtype
    dtype = torch.float16 if device == "cuda" else torch.float32

    pipe = transformers.pipeline(
        "automatic-speech-recognition",
        model=model_id,
        dtype=dtype,
        device=device,
    )

    # Transcribe with timestamps
    result = pipe(
        audio,
        chunk_length_s=30,
        return_timestamps=True,
        generate_kwargs={"language": language} if language else {},
    )

    return result


def transcribe_audio_remote(
    audio_path: str, remote, model_id: str, language: str
) -> dict:
    if remote.provider == "huggingface":
        provider = HuggingFaceProvider(remote)
        raw_result = provider.automatic_speech_recognition(
            Path(audio_path),
            model=remote.remote_model or model_id,
            language=language,
        )
    elif remote.provider == "replicate":
        provider = ReplicateProvider(remote)
        raw_result = provider.automatic_speech_recognition(
            Path(audio_path),
            model=remote.remote_model or model_id,
            language=language,
        )
    else:
        raise ValueError(f"unsupported remote provider: {remote.provider}")

    return normalize_remote_transcription_result(raw_result, language=language)


def normalize_remote_transcription_result(
    raw_result: object, *, language: str
) -> dict[str, object]:
    if isinstance(raw_result, str):
        return {
            "text": raw_result.strip(),
            "language": language,
            "duration": 0.0,
            "chunks": [],
        }

    if not isinstance(raw_result, dict):
        raise ValueError("unsupported remote transcription response shape")

    if isinstance(raw_result.get("output"), str):
        return {
            "text": str(raw_result["output"]).strip(),
            "language": str(raw_result.get("language") or language),
            "duration": float(raw_result.get("duration") or 0.0),
            "chunks": [],
        }

    result = dict(raw_result)

    if "segments" in result and "chunks" not in result:
        result["chunks"] = _segments_to_chunks(result.get("segments"))

    if "text" not in result and isinstance(result.get("output"), dict):
        nested_output = result["output"]
        if isinstance(nested_output, dict):
            if "text" in nested_output:
                result["text"] = str(nested_output["text"]).strip()
            if "segments" in nested_output and "chunks" not in result:
                result["chunks"] = _segments_to_chunks(nested_output.get("segments"))

    result.setdefault("language", language)
    result.setdefault("duration", _duration_from_chunks(result.get("chunks")))
    result.setdefault("chunks", [])
    return result


def _segments_to_chunks(segments: object) -> list[dict[str, object]]:
    if not isinstance(segments, list):
        return []

    chunks: list[dict[str, object]] = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        start = _coerce_float(segment.get("start") or segment.get("chunk_start") or 0.0)
        end = _coerce_float(segment.get("end") or segment.get("chunk_end") or start)
        text = str(segment.get("text") or "").strip()
        if not text:
            continue
        chunks.append({"chunk_start": start, "chunk_end": end, "text": text})
    return chunks


def _duration_from_chunks(chunks: object) -> float:
    if not isinstance(chunks, list):
        return 0.0
    max_end = 0.0
    for chunk in chunks:
        if not isinstance(chunk, dict):
            continue
        max_end = max(
            max_end, _coerce_float(chunk.get("chunk_end") or chunk.get("end") or 0.0)
        )
    return max_end


def _coerce_float(value: object) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return 0.0
    return 0.0


def _string_config_value(config: dict[str, object], key: str, default: str) -> str:
    value = config.get(key, default)
    return value if isinstance(value, str) else default


def format_output(result: dict, file_name: str, model_id: str) -> dict:
    """Format transcription result into standard JSON output."""
    duration: float = result.get("duration", 0)
    segments: list[dict] = []

    if "chunks" in result and isinstance(result["chunks"], list):
        for chunk in result["chunks"]:
            start: float = chunk.get("chunk_start", 0)
            end: float = chunk.get("chunk_end", start)
            text: str = chunk.get("text", "")
            if text.strip():
                segments.append(
                    {
                        "start": round(start, 2),
                        "end": round(end, 2),
                        "text": text.strip(),
                    }
                )
    elif "text" in result:
        # Fallback: single segment for whole file
        segments.append(
            {
                "start": 0.0,
                "end": round(duration, 2),
                "text": str(result["text"]).strip(),
            }
        )

    return {
        "file": file_name,
        "duration": round(duration, 2),
        "language": result.get("language", "en"),
        "model": model_id,
        "segments": segments,
    }


def process_file(
    file_path: str,
    output_dir: str,
    model_id: str,
    device: str,
    language: str,
    remote=None,
) -> dict:
    """Process a single input file and return transcription result."""
    file_name = os.path.basename(file_path)
    file_ext = os.path.splitext(file_name)[1].lower()

    # Audio extraction
    if file_ext in [".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm"]:
        audio_path = os.path.join(
            output_dir, f"{os.path.splitext(file_name)[0]}_audio.wav"
        )
        extract_audio(file_path, audio_path)
    else:
        audio_path = file_path

    if remote and remote.enabled:
        result = transcribe_audio_remote(audio_path, remote, model_id, language)
    else:
        result = transcribe_audio(audio_path, model_id, device, language)

    # Format output
    output = format_output(result, file_name, model_id)  # type: ignore

    # Write to file
    output_name = os.path.splitext(file_name)[0] + "_transcription.json"
    output_path = os.path.join(output_dir, output_name)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Output written to: {output_path}")
    return output


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe audio from video/audio files"
    )
    parser.add_argument("--config", type=str, help="Path to config JSON file")
    parser.add_argument(
        "--input_dir", type=str, default="./input", help="Input directory"
    )
    parser.add_argument(
        "--output_dir", type=str, default="./output", help="Output directory"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="ibm-granite/granite-4.0-1b-speech",
        help="HuggingFace model ID",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        choices=["auto", "cpu", "cuda"],
        help="Inference device",
    )
    parser.add_argument(
        "--language", type=str, default="en", help="Language code (ISO 639-1)"
    )
    parser.add_argument("--file", type=str, help="Single file to process")
    parser.add_argument(
        "--provider",
        choices=["local", "none", "huggingface", "replicate"],
        help="Optional remote provider; defaults to local inference",
    )
    parser.add_argument(
        "--remote-model",
        type=str,
        help="Optional remote provider model override",
    )
    parser.add_argument(
        "--hf-token-env",
        type=str,
        help="Environment variable name for HuggingFace auth token",
    )
    parser.add_argument(
        "--replicate-api-key-env",
        type=str,
        help="Environment variable name for Replicate auth token",
    )
    parser.add_argument(
        "--remote-timeout-seconds",
        type=int,
        help="Optional timeout for remote provider calls",
    )

    args = parser.parse_args()

    config: dict[str, object] = {}

    # Load config if provided
    if args.config:
        config = load_config(args.config)
        args.input_dir = _string_config_value(config, "input_dir", "./input")
        args.output_dir = _string_config_value(config, "output_dir", "./output")
        args.model = _string_config_value(
            config, "model", "ibm-granite/granite-4.0-1b-speech"
        )
        args.device = _string_config_value(config, "device", "auto")
        args.language = _string_config_value(config, "language", "en")

    remote_config = merge_remote_provider_overrides(
        {
            "provider": config.get("provider") if args.config else None,
            "remote_model": config.get("remote_model") if args.config else None,
            "hf_token_env": config.get("hf_token_env") if args.config else None,
            "replicate_api_key_env": config.get("replicate_api_key_env")
            if args.config
            else None,
            "remote_timeout_seconds": config.get("remote_timeout_seconds")
            if args.config
            else None,
        },
        provider=args.provider,
        remote_model=args.remote_model,
        hf_token_env=args.hf_token_env,
        replicate_api_key_env=args.replicate_api_key_env,
        remote_timeout_seconds=args.remote_timeout_seconds,
    )
    remote = remote_provider_from_config(
        remote_config,
        supported_providers={"huggingface", "replicate"},
    )

    # Convert to absolute paths (for test compatibility)
    args.input_dir = os.path.abspath(args.input_dir)
    args.output_dir = os.path.abspath(args.output_dir)

    # Create output directory if needed
    os.makedirs(args.output_dir, exist_ok=True)

    # Process file(s)
    if args.file:
        files = [args.file]
    else:
        # Find all audio/video files in input_dir
        extensions = [
            "*.mp4",
            "*.mov",
            "*.avi",
            "*.mkv",
            "*.m4v",
            "*.webm",
            "*.mp3",
            "*.wav",
            "*.aac",
            "*.flac",
        ]
        files = []
        for ext in extensions:
            files.extend(Path(args.input_dir).glob(ext))
        files = list(files)

    if not files:
        print(f"No input files found in {args.input_dir}")
        sys.exit(1)

    # Process each file
    for file_path in files:
        print(f"Processing: {file_path}")
        try:
            result = process_file(
                str(file_path),
                args.output_dir,
                args.model,
                args.device,
                args.language,
                remote,
            )
            print(
                f"  Duration: {result['duration']}s, Segments: {len(result['segments'])}"
            )
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            import traceback

            traceback.print_exc()
            sys.exit(1)

    print("Transcription complete.")


if __name__ == "__main__":
    main()
