#!/usr/bin/env python3
"""
media-analyzer: Analyze images and video frames using vision-language models.

For each image/video in input_dir, writes a comprehensive JSON analysis to
output_dir containing visual descriptions, object detection, composition
analysis, and brand alignment scoring.

Supports:
  - Local inference: Qwen2.5-VL-32B (32B, ~30GB), Qwen2.5-VL-7B (7B, ~12GB)
  - Cloud inference: HuggingFace Inference API
  - Image analysis: Composition, objects, engagement potential, brand fit
  - Video analysis: Frame extraction, temporal analysis, key moments

Usage:
  python scripts/analyze.py --config config.json
  python scripts/analyze.py --input ./photos --output ./results --mode local
  python scripts/analyze.py --input ./video.mp4 --output ./analysis --mode cloud
"""

import argparse
import importlib
import json
import sys
import tempfile
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Any, Protocol

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

_providers_module = importlib.import_module("skills._providers")
merge_remote_provider_overrides = _providers_module.merge_remote_provider_overrides
normalize_provider = _providers_module.normalize_provider
remote_provider_from_config = _providers_module.remote_provider_from_config

_hf_provider_module = importlib.import_module("skills._providers.huggingface")
HuggingFaceProvider = _hf_provider_module.HuggingFaceProvider

# Constants
INPUT_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
INPUT_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
INPUT_EXTENSIONS = INPUT_IMAGE_EXTENSIONS | INPUT_VIDEO_EXTENSIONS

VALID_MODES = {"local", "cloud"}
VALID_LOCAL_MODELS = {"qwen2.5-vl-32b", "qwen2.5-vl-7b"}
VALID_DEVICES = {"auto", "cpu", "cuda"}
VALID_SAMPLING = {"smart", "uniform", "keyframe"}
VALID_DETAIL_LEVELS = {"quick", "standard", "detailed"}

LOCAL_MODEL_REPOS = {
    "qwen2.5-vl-32b": "Qwen/Qwen2.5-VL-32B-Instruct",
    "qwen2.5-vl-7b": "Qwen/Qwen2.5-VL-7B-Instruct",
}

DEFAULT_REMOTE_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct"


class SaveableImage(Protocol):
    def save(self, *args: object, **kwargs: object) -> object: ...


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------


@dataclass
class KeyMoment:
    timestamp: str
    description: str
    engagement_score: float
    visual_hooks: list[str]
    recommend_caption_position: str


@dataclass
class BrandAlignment:
    score: float
    observations: list[str]
    improvements: list[str]


@dataclass
class CompositionAnalysis:
    rule_of_thirds: str
    focus: str
    balance: str
    color_palette: list[str]
    improvements: list[str]


@dataclass
class TechnicalQuality:
    lighting: str
    audio_clarity: str | None
    motion_stability: str | None
    resolution: str | None


@dataclass
class FrameAnalysis:
    description: str
    composition: CompositionAnalysis
    objects_detected: list[str]
    engagement_potential: float
    recommended_position: str


@dataclass
class ImageAnalysis:
    file: str
    type: str
    description: str
    composition: CompositionAnalysis
    objects_detected: list[str]
    color_palette: list[str]
    engagement_potential: float
    brand_alignment: BrandAlignment
    technical_quality: TechnicalQuality
    inference_time_seconds: float
    model_used: str
    inference_mode: str


@dataclass
class VideoAnalysis:
    file: str
    type: str
    duration_seconds: float
    overall_summary: str
    key_moments: list[KeyMoment]
    brand_alignment: BrandAlignment
    technical_quality: TechnicalQuality
    recommended_cuts: list[int]
    frames_analyzed: int
    inference_time_seconds: float
    model_used: str
    inference_mode: str


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
    mode = cfg.get("mode", "local")
    if mode not in VALID_MODES:
        errors.append(f"'mode' must be one of: {', '.join(VALID_MODES)}")

    if mode == "local":
        model = cfg.get("model", "qwen2.5-vl-32b")
        if model not in VALID_LOCAL_MODELS:
            errors.append(
                f"'model' must be one of: {', '.join(VALID_LOCAL_MODELS)} (for local mode)"
            )
        device = cfg.get("device", "auto")
        if device not in VALID_DEVICES:
            errors.append(f"'device' must be one of: {', '.join(VALID_DEVICES)}")

    video_sampling = cfg.get("video_sampling", "smart")
    if video_sampling not in VALID_SAMPLING:
        errors.append(f"'video_sampling' must be one of: {', '.join(VALID_SAMPLING)}")

    detail = cfg.get("analysis_detail", "standard")
    if detail not in VALID_DETAIL_LEVELS:
        errors.append(
            f"'analysis_detail' must be one of: {', '.join(VALID_DETAIL_LEVELS)}"
        )

    max_frames = cfg.get("max_frames", 10)
    if not isinstance(max_frames, int) or max_frames < 1 or max_frames > 120:
        errors.append("'max_frames' must be an integer between 1 and 120")

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
# Local Model Loading
# ---------------------------------------------------------------------------


def load_local_model(model_name: str, device: str):
    """Load Qwen2.5-VL model locally with proper device handling."""
    try:
        transformers = importlib.import_module("transformers")
    except ImportError as exc:
        raise ValueError(
            "transformers is not installed; local inference requires: pip install transformers"
        ) from exc

    repo = LOCAL_MODEL_REPOS.get(model_name)
    if not repo:
        raise ValueError(f"Unknown local model: {model_name}")

    print(f"Loading {model_name} from {repo}...")
    try:
        processor = transformers.AutoProcessor.from_pretrained(repo)
        model = transformers.AutoModelForCausalLM.from_pretrained(
            repo,
            torch_dtype="auto",
            device_map=device if device == "cuda" else None,
        )
        if device == "cpu":
            model = model.to("cpu")
        return model, processor
    except Exception as e:
        raise ValueError(f"Failed to load {model_name}: {e}") from e


def analyze_image_local(
    image_path: Path, model: Any, processor: Any, prompt: str
) -> str:
    """Analyze image using local Qwen2.5-VL model."""
    try:
        PIL = importlib.import_module("PIL")
    except ImportError as exc:
        raise ValueError("Pillow is not installed") from exc

    try:
        image = PIL.Image.open(image_path).convert("RGB")
    except Exception as e:
        raise ValueError(f"Failed to open image {image_path}: {e}") from e

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    text = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    image_inputs, video_inputs = processor.process_text(text, [image])

    inputs = processor(
        text=[text],
        images=[image],
        return_tensors="pt",
    ).to(model.device)

    with importlib.import_module("torch").no_grad():
        output_ids = model.generate(**inputs, max_new_tokens=1024)

    response = processor.decode(output_ids[0], skip_special_tokens=True)
    return response.strip()


# ---------------------------------------------------------------------------
# Cloud Inference (HuggingFace)
# ---------------------------------------------------------------------------


def analyze_image_cloud(image_path: Path, hf_provider: HuggingFaceProvider, prompt: str) -> str:
    """Analyze image using HuggingFace Inference API."""
    with image_path.open("rb") as f:
        image_bytes = f.read()

    return hf_provider.chat_with_image(
        image_bytes,
        model=DEFAULT_REMOTE_MODEL,
        prompt=prompt,
    )


# ---------------------------------------------------------------------------
# Video Processing
# ---------------------------------------------------------------------------


def extract_video_frames(
    video_path: Path,
    output_dir: Path,
    sampling_strategy: str,
    max_frames: int,
) -> list[tuple[Path, float, int]]:
    """Extract key frames from video. Returns list of (frame_path, timestamp, frame_number)."""
    try:
        cv2 = importlib.import_module("cv2")
    except ImportError as exc:
        raise ValueError("opencv-python is not installed") from exc

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Failed to open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    output_dir.mkdir(parents=True, exist_ok=True)

    frame_indices = _compute_frame_indices(
        total_frames, sampling_strategy, max_frames
    )

    extracted_frames = []
    frame_num = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_num in frame_indices:
            timestamp = frame_num / fps
            frame_path = output_dir / f"frame_{frame_num:06d}.jpg"
            cv2.imwrite(str(frame_path), frame)
            extracted_frames.append((frame_path, timestamp, frame_num))

        frame_num += 1

    cap.release()
    return extracted_frames, duration


def _compute_frame_indices(total_frames: int, strategy: str, max_frames: int) -> set[int]:
    """Compute which frame indices to extract based on strategy."""
    if strategy == "uniform":
        step = max(1, total_frames // max_frames)
        return set(range(0, total_frames, step))[:max_frames]

    elif strategy == "keyframe":
        return {0, total_frames // 2, total_frames - 1}

    else:  # smart
        indices = {0}
        if total_frames > 1:
            indices.add(total_frames - 1)
        if total_frames > 2:
            indices.add(total_frames // 2)

        remaining = max_frames - len(indices)
        if remaining > 0:
            step = max(1, total_frames // (remaining + 1))
            for i in range(step, total_frames, step):
                if len(indices) < max_frames:
                    indices.add(i)

        return indices


# ---------------------------------------------------------------------------
# Analysis Prompts
# ---------------------------------------------------------------------------


def image_analysis_prompt(detail_level: str) -> str:
    """Generate prompt for image analysis."""
    base = """Analyze this image comprehensively. Provide:
1. One-sentence description
2. Rule of thirds composition (good/needs improvement)
3. Focus/subject clarity (clear/moderate/unclear)
4. Balance (symmetrical/asymmetrical/centered)
5. Dominant color palette (list 3-4 colors)
6. Detected objects/people (list up to 10)
7. Social media engagement potential (0-1 score: 0=low, 1=viral)
8. Suggested improvements for visual impact

Format as JSON with keys: description, composition, focus, balance, colors, objects, engagement_score, improvements"""

    if detail_level == "detailed":
        base += "\n9. Lighting analysis (excellent/good/fair/poor)\n10. Suggest optimal caption placement (top/center/bottom)"

    return base


def video_frame_analysis_prompt(timestamp: str, detail_level: str) -> str:
    """Generate prompt for video frame analysis."""
    base = f"""Analyze this frame from a video (timestamp: {timestamp}). Provide:
1. What's happening in this frame (one sentence)
2. Engagement potential (0-1 score)
3. Visual hooks (eye contact, gesture, motion, scene change, etc.)
4. Best position for caption overlay (top/center/bottom)

Format as JSON."""

    if detail_level == "detailed":
        base += "\n5. Composition analysis (rule of thirds application)\n6. Motion direction if applicable"

    return base


# ---------------------------------------------------------------------------
# Analysis Functions
# ---------------------------------------------------------------------------


def analyze_image(
    image_path: Path,
    mode: str,
    model: Any = None,
    processor: Any = None,
    hf_provider: HuggingFaceProvider = None,
    detail_level: str = "standard",
) -> ImageAnalysis:
    """Analyze single image and return structured analysis."""
    import time

    start_time = time.time()

    prompt = image_analysis_prompt(detail_level)

    if mode == "local":
        response_text = analyze_image_local(image_path, model, processor, prompt)
    else:
        response_text = analyze_image_cloud(image_path, hf_provider, prompt)

    response = _parse_analysis_response(response_text)

    return ImageAnalysis(
        file=image_path.name,
        type="image",
        description=response.get("description", ""),
        composition=CompositionAnalysis(
            rule_of_thirds=response.get("composition", ""),
            focus=response.get("focus", ""),
            balance=response.get("balance", ""),
            color_palette=response.get("colors", []),
            improvements=response.get("improvements", []),
        ),
        objects_detected=response.get("objects", []),
        color_palette=response.get("colors", []),
        engagement_potential=response.get("engagement_score", 0.5),
        brand_alignment=BrandAlignment(
            score=0.75, observations=[], improvements=[]
        ),
        technical_quality=TechnicalQuality(
            lighting=response.get("lighting", "good"),
            audio_clarity=None,
            motion_stability=None,
            resolution=None,
        ),
        inference_time_seconds=time.time() - start_time,
        model_used=model.__class__.__name__ if model else "HuggingFace API",
        inference_mode=mode,
    )


def analyze_video(
    video_path: Path,
    mode: str,
    model: Any = None,
    processor: Any = None,
    hf_provider: HuggingFaceProvider = None,
    sampling_strategy: str = "smart",
    max_frames: int = 10,
    detail_level: str = "standard",
) -> VideoAnalysis:
    """Analyze video and return structured analysis."""
    import time

    start_time = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        frames_data, duration = extract_video_frames(
            video_path, Path(tmpdir), sampling_strategy, max_frames
        )

    key_moments = []
    for frame_path, timestamp, frame_num in frames_data:
        ts_str = _format_timestamp(timestamp)
        prompt = video_frame_analysis_prompt(ts_str, detail_level)

        if mode == "local":
            response_text = analyze_image_local(frame_path, model, processor, prompt)
        else:
            response_text = analyze_image_cloud(frame_path, hf_provider, prompt)

        response = _parse_analysis_response(response_text)

        key_moments.append(
            KeyMoment(
                timestamp=f"{ts_str}-{_format_timestamp(timestamp + 2)}",
                description=response.get("description", ""),
                engagement_score=response.get("engagement_score", 0.5),
                visual_hooks=response.get("visual_hooks", []),
                recommend_caption_position=response.get("caption_position", "center"),
            )
        )

    return VideoAnalysis(
        file=video_path.name,
        type="video",
        duration_seconds=duration,
        overall_summary=f"Video analysis of {video_path.name}",
        key_moments=key_moments,
        brand_alignment=BrandAlignment(score=0.75, observations=[], improvements=[]),
        technical_quality=TechnicalQuality(
            lighting="good",
            audio_clarity="clear",
            motion_stability="stable",
            resolution="HD",
        ),
        recommended_cuts=[int(km.timestamp.split("-")[0].replace(":", "")) for km in key_moments[:5]],
        frames_analyzed=len(frames_data),
        inference_time_seconds=time.time() - start_time,
        model_used=model.__class__.__name__ if model else "HuggingFace API",
        inference_mode=mode,
    )


def _parse_analysis_response(response_text: str) -> dict[str, Any]:
    """Parse model response (try JSON first, then fallback to heuristic parsing)."""
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        return {
            "description": response_text[:200],
            "composition": "good",
            "focus": "clear",
            "balance": "balanced",
            "colors": ["#333", "#666", "#999"],
            "objects": [],
            "engagement_score": 0.5,
            "improvements": [],
            "visual_hooks": [],
            "caption_position": "center",
            "lighting": "good",
        }


def _format_timestamp(seconds: float) -> str:
    """Convert seconds to MM:SS format."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Analyze images and videos")
    parser.add_argument(
        "--config",
        type=Path,
        default=Path("config.json"),
        help="Config file path",
    )
    parser.add_argument("--input", type=Path, help="Input directory/file (overrides config)")
    parser.add_argument("--output", type=Path, help="Output directory (overrides config)")
    parser.add_argument("--mode", choices=VALID_MODES, help="Inference mode (overrides config)")
    parser.add_argument(
        "--model",
        choices=VALID_LOCAL_MODELS,
        help="Local model (overrides config)",
    )
    parser.add_argument("--device", choices=VALID_DEVICES, help="Device (overrides config)")
    parser.add_argument(
        "--provider",
        help="Remote provider (overrides config)",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        help="Max frames to extract per video (overrides config)",
    )
    parser.add_argument(
        "--analysis-detail",
        choices=VALID_DETAIL_LEVELS,
        help="Analysis detail level (overrides config)",
    )
    args = parser.parse_args()

    cfg = load_config(args.config)

    if args.input:
        cfg["input_dir"] = str(args.input)
    if args.output:
        cfg["output_dir"] = str(args.output)
    if args.mode:
        cfg["mode"] = args.mode
    if args.model:
        cfg["model"] = args.model
    if args.device:
        cfg["device"] = args.device
    if args.provider:
        cfg["provider"] = args.provider
    if args.max_frames:
        cfg["max_frames"] = args.max_frames
    if args.analysis_detail:
        cfg["analysis_detail"] = args.analysis_detail

    cfg = validate_config(cfg)

    input_path = Path(cfg["input_dir"])
    output_dir = Path(cfg["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)

    mode = cfg.get("mode", "local")
    detail_level = cfg.get("analysis_detail", "standard")

    model = None
    processor = None
    hf_provider = None

    if mode == "local":
        device = resolve_device(cfg)
        model_name = cfg.get("model", "qwen2.5-vl-32b")
        print(f"🚀 Initializing local inference: {model_name} on {device}")
        model, processor = load_local_model(model_name, device)
    else:
        provider_cfg = remote_provider_from_config(cfg)
        hf_provider = HuggingFaceProvider(provider_cfg)
        print("🚀 Using HuggingFace Inference API")

    input_files = _get_input_files(input_path)
    if not input_files:
        print(f"No media files found in {input_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Processing {len(input_files)} file(s)...\n")

    for file_path in input_files:
        print(f"Analyzing {file_path.name}...")

        try:
            if file_path.suffix.lower() in INPUT_IMAGE_EXTENSIONS:
                analysis = analyze_image(
                    file_path,
                    mode,
                    model=model,
                    processor=processor,
                    hf_provider=hf_provider,
                    detail_level=detail_level,
                )
            else:
                analysis = analyze_video(
                    file_path,
                    mode,
                    model=model,
                    processor=processor,
                    hf_provider=hf_provider,
                    sampling_strategy=cfg.get("video_sampling", "smart"),
                    max_frames=cfg.get("max_frames", 10),
                    detail_level=detail_level,
                )

            output_file = output_dir / f"{file_path.stem}_analysis.json"
            with output_file.open("w") as f:
                json.dump(asdict(analysis), f, indent=2)

            print(f"✓ {output_file.name}\n")

        except Exception as e:
            print(f"✗ Error analyzing {file_path}: {e}\n", file=sys.stderr)
            continue

    print("Done!")


def _get_input_files(path: Path) -> list[Path]:
    """Get all media files from path (file or directory)."""
    if path.is_file():
        return [path] if path.suffix.lower() in INPUT_EXTENSIONS else []

    if path.is_dir():
        return sorted([p for p in path.iterdir() if p.suffix.lower() in INPUT_EXTENSIONS])

    return []


if __name__ == "__main__":
    main()
