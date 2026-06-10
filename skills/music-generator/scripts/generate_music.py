#!/usr/bin/env python3
"""
generate_music.py — clawbeat: generate royalty-free background music via MusicGen.

Generates music from a text prompt and either:
  - saves it as a WAV file, or
  - mixes it under a video at a target loudness level (music_volume_lufs).

Models:
  small    — 300M, ~3GB VRAM, fast (default)
  medium   — 1.5B, ~8GB VRAM, higher quality
  melody   — 1.5B, text + reference melody conditioning

Device:
  "auto" / "cuda" → GPU
  "cpu"           → CPU (small model only; very slow, ~10× realtime)

Usage:
  python scripts/generate_music.py [--config config.json]
  python scripts/generate_music.py --prompt "upbeat jazz" --duration 30
  python scripts/generate_music.py --video ./input/clip.mp4 --prompt "lo-fi chill"
  python scripts/generate_music.py --device cpu --model small --duration 15
"""

import argparse
import importlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Protocol, cast

_SKILL_DIR = Path(__file__).resolve().parent.parent
_PROVIDERS_ROOT = _SKILL_DIR.parent
if str(_PROVIDERS_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROVIDERS_ROOT))

_providers_module = importlib.import_module("_providers")
merge_remote_provider_overrides = _providers_module.merge_remote_provider_overrides
remote_provider_from_config = _providers_module.remote_provider_from_config

_hf_provider_module = importlib.import_module("_providers.huggingface")
HuggingFaceProvider = _hf_provider_module.HuggingFaceProvider

_replicate_provider_module = importlib.import_module("_providers.replicate")
ReplicateProvider = _replicate_provider_module.ReplicateProvider

VALID_MODELS = {"small", "medium", "melody", "large"}
VALID_DEVICES = {"auto", "cpu", "cuda"}
DEFAULT_REMOTE_REPLICATE_MODEL = "stability-ai/stable-audio-2.5"


class NumpyConvertibleAudio(Protocol):
    def numpy(self) -> object: ...


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
    errors = []
    model = cfg.get("model", "small")
    if model not in VALID_MODELS:
        errors.append(f"'model' must be one of: {', '.join(sorted(VALID_MODELS))}")
    device = cfg.get("device", "auto")
    if device not in VALID_DEVICES:
        errors.append(f"'device' must be one of: {', '.join(VALID_DEVICES)}")
    if device == "cpu" and model != "small":
        errors.append("CPU mode is only practical with model='small'")
    duration = cfg.get("duration", 30)
    if not isinstance(duration, (int, float)) or duration <= 0 or duration > 300:
        errors.append("'duration' must be a number between 1 and 300 seconds")
    if not cfg.get("prompt"):
        errors.append("'prompt' is required")
    lufs = cfg.get("music_volume_lufs", -20)
    if not isinstance(lufs, (int, float)) or lufs > 0:
        errors.append("'music_volume_lufs' must be a negative number (e.g. -20)")
    if errors:
        print("Config errors:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)
    return cfg


def resolve_device(cfg: dict) -> str:
    device = cfg.get("device", "auto")
    if device != "auto":
        return device
    try:
        torch = importlib.import_module("torch")
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------


def generate_music(
    prompt: str,
    duration: float,
    model_name: str,
    device: str,
    melody_path: Path | None = None,
) -> tuple[object, int]:
    """Return (audio_tensor, sample_rate) via HuggingFace transformers MusicGen."""
    torch = importlib.import_module("torch")
    transformers = importlib.import_module("transformers")
    auto_processor = transformers.AutoProcessor
    musicgen_class = transformers.MusicgenForConditionalGeneration

    hf_model_id = f"facebook/musicgen-{model_name}"
    print(f"Loading MusicGen '{model_name}' on {device}…")
    if device == "cpu":
        print(
            "  Note: CPU mode is very slow (~10× realtime). This may take several minutes."
        )

    processor = auto_processor.from_pretrained(hf_model_id)
    model = musicgen_class.from_pretrained(hf_model_id)
    model.to(device)

    # Compute token budget from desired duration and model frame rate.
    # frame_rate moved from MusicgenConfig to audio_encoder in newer transformers.
    sampling_rate = model.config.audio_encoder.sampling_rate  # 32000 Hz
    frame_rate = getattr(model.config, "frame_rate", None) or getattr(
        model.config.audio_encoder, "frame_rate", 50
    )
    max_new_tokens = int(duration * frame_rate)

    inputs = processor(text=[prompt], padding=True, return_tensors="pt").to(device)
    with torch.no_grad():
        audio_values = model.generate(**inputs, max_new_tokens=max_new_tokens)

    # audio_values: (batch, channels, samples)
    audio = audio_values[0].cpu().float()
    return audio, sampling_rate


def generate_music_remote(prompt: str, duration: float, remote) -> tuple[bytes, int]:
    if remote.provider == "huggingface":
        provider = HuggingFaceProvider(remote)
        provider.generate_music()
        raise ValueError("unreachable")

    if remote.provider != "replicate":
        raise ValueError(f"unsupported remote provider: {remote.provider}")

    provider = ReplicateProvider(remote)
    result = provider.generate_music(
        prompt,
        model=remote.remote_model or DEFAULT_REMOTE_REPLICATE_MODEL,
        duration=duration,
    )
    if not isinstance(result, str):
        raise ValueError("replicate music generation did not return an audio URL")
    return provider.download_bytes(result), 32000


def save_wav(audio: object, path: Path, sample_rate: int = 32000) -> None:
    wav_io = importlib.import_module("scipy.io.wavfile")
    np = importlib.import_module("numpy")

    if not hasattr(audio, "numpy"):
        raise ValueError("audio tensor does not support numpy() conversion")
    audio_tensor = cast(NumpyConvertibleAudio, audio)
    data: Any = audio_tensor.numpy()
    if data.ndim == 2:
        data = data.T  # (samples, channels)
    data_int16 = (data * 32767).clip(-32768, 32767).astype(np.int16)
    wav_io.write(str(path), sample_rate, data_int16)


def save_audio_bytes(audio_bytes: bytes, path: Path) -> None:
    path.write_bytes(audio_bytes)


def mix_music_under_video(
    video_path: Path,
    music_path: Path,
    output_path: Path,
    music_volume_lufs: float,
) -> None:
    """
    Mix generated music under the video's existing audio at the target loudness.
    The voice track remains primary; music is ducked to music_volume_lufs.
    Uses ffmpeg loudnorm + amix.
    """
    # Get video duration to know if music needs to loop
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        text=True,
    )
    try:
        vid_duration = float(probe.stdout.strip())
    except ValueError:
        vid_duration = 0.0

    # Build ffmpeg filter: normalise music loudness, then mix
    filter_complex = (
        f"[1:a]loudnorm=I={music_volume_lufs}:LRA=7:TP=-1[music_norm];"
        "[0:a][music_norm]amix=inputs=2:duration=first:dropout_transition=2[aout]"
    )

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-stream_loop",
        "-1",
        "-i",
        str(music_path),  # loop music if shorter
        "-filter_complex",
        filter_complex,
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffmpeg mix failed")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm"}


def process(config_path: Path) -> None:
    cfg = validate_config(load_config(config_path))
    remote = remote_provider_from_config(
        cfg,
        supported_providers={"huggingface", "replicate"},
        unsupported_provider_reasons={
            "huggingface": "music generation is not supported for HuggingFace in wave 1"
        },
    )

    input_dir = Path(cfg.get("input_dir", "./input"))
    output_dir = Path(cfg.get("output_dir", "./output"))
    prompt = cfg["prompt"]
    duration = float(cfg.get("duration", 30))
    model_name = cfg.get("model", "small")
    device = resolve_device(cfg)
    music_volume_lufs = float(cfg.get("music_volume_lufs", -20))
    video = cfg.get("video")

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f'Generating {duration}s of music: "{prompt}"')
    audio = None
    audio_bytes: bytes | None = None
    if remote.enabled:
        audio_bytes, sample_rate = generate_music_remote(prompt, duration, remote)
    else:
        audio, sample_rate = generate_music(prompt, duration, model_name, device)

    if video:
        video_path = Path(video)
        if not video_path.exists():
            print(f"Error: video file not found: {video_path}", file=sys.stderr)
            sys.exit(1)
        with tempfile.TemporaryDirectory(prefix="clawbeat_") as tmp_str:
            tmp_music = Path(tmp_str) / "music.wav"
            if audio_bytes is not None:
                save_audio_bytes(audio_bytes, tmp_music)
            else:
                save_wav(audio, tmp_music, sample_rate)
            out_path = output_dir / video_path.name
            print(f"Mixing music under video at {music_volume_lufs} LUFS…")
            mix_music_under_video(video_path, tmp_music, out_path, music_volume_lufs)
        print(f"→ {out_path}")
        print()
        print("Done.")
    elif input_dir.exists():
        videos = sorted(
            p
            for p in input_dir.iterdir()
            if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS
        )
        if videos:
            print(f"Batch mode: mixing under {len(videos)} video(s) from {input_dir}…")
            print()
            succeeded, failed = 0, []
            with tempfile.TemporaryDirectory(prefix="clawbeat_") as tmp_str:
                tmp_music = Path(tmp_str) / "music.wav"
                if audio_bytes is not None:
                    save_audio_bytes(audio_bytes, tmp_music)
                else:
                    save_wav(audio, tmp_music, sample_rate)
                for video_path in videos:
                    print(f"[{video_path.name}]")
                    try:
                        out_path = output_dir / video_path.name
                        print(f"  Mixing at {music_volume_lufs} LUFS…")
                        mix_music_under_video(
                            video_path, tmp_music, out_path, music_volume_lufs
                        )
                        print(f"  → {out_path}")
                        succeeded += 1
                    except Exception as exc:
                        print(f"  ERROR: {exc}", file=sys.stderr)
                        failed.append(video_path.name)
            print()
            print(f"Done: {succeeded}/{len(videos)} succeeded", end="")
            if failed:
                print(f", {len(failed)} failed: {', '.join(failed)}")
                sys.exit(1)
            else:
                print()
        else:
            out_path = output_dir / "music.wav"
            if audio_bytes is not None:
                save_audio_bytes(audio_bytes, out_path)
            else:
                save_wav(audio, out_path, sample_rate)
            print(f"→ {out_path}")
            print()
            print("Done.")
    else:
        out_path = output_dir / "music.wav"
        if audio_bytes is not None:
            save_audio_bytes(audio_bytes, out_path)
        else:
            save_wav(audio, out_path, sample_rate)
        print(f"→ {out_path}")
        print()
        print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser(description="clawbeat — brand music generation")
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--prompt", help="Override prompt")
    parser.add_argument("--duration", type=float, help="Override duration (seconds)")
    parser.add_argument("--model", choices=list(VALID_MODELS), help="Override model")
    parser.add_argument("--device", choices=list(VALID_DEVICES), help="Override device")
    parser.add_argument("--video", help="Override video (mix music under this file)")
    parser.add_argument(
        "--music-volume-lufs",
        type=float,
        help="Override music_volume_lufs (negative number)",
    )
    parser.add_argument(
        "--input", help="Override input_dir (directory of videos to mix under)"
    )
    parser.add_argument("--output", help="Override output_dir")
    parser.add_argument(
        "--provider",
        choices=["local", "none", "huggingface", "replicate"],
        help="Optional remote provider; defaults to local generation",
    )
    parser.add_argument(
        "--remote-model",
        help="Optional remote provider model override",
    )
    parser.add_argument(
        "--hf-token-env",
        help="Environment variable name for HuggingFace auth token",
    )
    parser.add_argument(
        "--replicate-api-key-env",
        help="Environment variable name for Replicate auth token",
    )
    parser.add_argument(
        "--remote-timeout-seconds",
        type=int,
        help="Optional timeout for remote provider calls",
    )
    args = parser.parse_args()

    cfg = validate_config(load_config(Path(args.config)))

    if args.prompt:
        cfg["prompt"] = args.prompt
    if args.duration is not None:
        cfg["duration"] = args.duration
    if args.model:
        cfg["model"] = args.model
    if args.device:
        cfg["device"] = args.device
    if args.video:
        cfg["video"] = args.video
    if args.music_volume_lufs is not None:
        cfg["music_volume_lufs"] = args.music_volume_lufs
    if args.input:
        cfg["input_dir"] = args.input
    if args.output:
        cfg["output_dir"] = args.output

    cfg = merge_remote_provider_overrides(
        cfg,
        provider=args.provider,
        remote_model=args.remote_model,
        hf_token_env=args.hf_token_env,
        replicate_api_key_env=args.replicate_api_key_env,
        remote_timeout_seconds=args.remote_timeout_seconds,
    )

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
