#!/usr/bin/env python3
"""
describe.py — clawvlm: auto-describe images using a local vision-language model.

For each image in input_dir, writes a JSON sidecar to output_dir containing:
  - description: one-sentence image description
  - caption:     suggested Instagram caption with hashtags
  - tags:        list of detected themes / keywords

Supported models:
  smolvlm  — 256M params, fast, works on CPU (default)
  phi4     — 3.8B multimodal, higher quality, requires GPU

Usage:
  python scripts/describe.py [--config config.json]
  python scripts/describe.py --input ./input --output ./output
  python scripts/describe.py --input ./input --output ./output --device cpu
"""

import argparse
import importlib
import io
import json
import sys
import tempfile
from typing import Protocol
from pathlib import Path

_SKILL_DIR = Path(__file__).resolve().parent.parent
_PROVIDERS_ROOT = _SKILL_DIR.parent
if str(_PROVIDERS_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROVIDERS_ROOT))

_providers_module = importlib.import_module("_providers")
merge_remote_provider_overrides = _providers_module.merge_remote_provider_overrides
normalize_provider = _providers_module.normalize_provider
remote_provider_from_config = _providers_module.remote_provider_from_config

_hf_provider_module = importlib.import_module("_providers.huggingface")
HuggingFaceProvider = _hf_provider_module.HuggingFaceProvider

_replicate_provider_module = importlib.import_module("_providers.replicate")
ReplicateProvider = _replicate_provider_module.ReplicateProvider

INPUT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
VALID_MODELS = {"smolvlm", "phi4"}
VALID_DEVICES = {"auto", "cpu", "cuda"}

SMOLVLM_REPO = "HuggingFaceTB/SmolVLM-256M-Instruct"
PHI4_REPO = "microsoft/Phi-4-multimodal-instruct"
DEFAULT_REMOTE_HF_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct"


class SaveableImage(Protocol):
    def save(self, *args: object, **kwargs: object) -> object: ...


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
    model = cfg.get("model", "smolvlm")
    provider = normalize_provider(cfg.get("provider"))
    if provider is None and model not in VALID_MODELS:
        errors.append(f"'model' must be one of: {', '.join(VALID_MODELS)}")
    device = cfg.get("device", "auto")
    if device not in VALID_DEVICES:
        errors.append(f"'device' must be one of: {', '.join(VALID_DEVICES)}")
    if provider is None and model == "phi4" and device == "cpu":
        errors.append("phi4 requires GPU; use model=smolvlm for CPU inference")
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
# Model wrappers
# ---------------------------------------------------------------------------


class SmolVLM:
    def __init__(self, device: str):
        torch = importlib.import_module("torch")
        transformers = importlib.import_module("transformers")
        auto_processor = transformers.AutoProcessor
        model_class = transformers.SmolVLMForConditionalGeneration

        print(f"Loading SmolVLM-256M on {device}…")
        self._processor = auto_processor.from_pretrained(SMOLVLM_REPO)
        self._model = model_class.from_pretrained(
            SMOLVLM_REPO,
            torch_dtype=torch.bfloat16 if device == "cuda" else torch.float32,
        ).to(device)
        self._model.eval()
        self._device = device

    def ask(self, image: SaveableImage, question: str) -> str:
        torch = importlib.import_module("torch")

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image"},
                    {"type": "text", "text": question},
                ],
            }
        ]
        prompt = self._processor.apply_chat_template(
            messages, add_generation_prompt=True
        )
        inputs = self._processor(text=prompt, images=[image], return_tensors="pt").to(
            self._device
        )
        with torch.no_grad():
            output = self._model.generate(**inputs, max_new_tokens=256, do_sample=False)
        decoded = self._processor.decode(
            output[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True
        )
        return decoded.strip()


class Phi4Multimodal:
    def __init__(self, device: str):
        torch = importlib.import_module("torch")
        transformers = importlib.import_module("transformers")
        auto_model = transformers.AutoModelForCausalLM
        auto_processor = transformers.AutoProcessor

        print(f"Loading Phi-4-multimodal on {device}…")
        self._processor = auto_processor.from_pretrained(
            PHI4_REPO, trust_remote_code=True
        )
        self._model = auto_model.from_pretrained(
            PHI4_REPO,
            trust_remote_code=True,
            torch_dtype="auto",
        ).to(device)
        self._model.eval()
        self._device = device

    def ask(self, image: SaveableImage, question: str) -> str:
        torch = importlib.import_module("torch")

        messages = [{"role": "user", "content": f"<|image_1|>\n{question}"}]
        prompt = self._processor.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        inputs = self._processor(prompt, [image], return_tensors="pt").to(self._device)
        with torch.no_grad():
            output = self._model.generate(**inputs, max_new_tokens=256, do_sample=False)
        decoded = self._processor.decode(
            output[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True
        )
        return decoded.strip()


class RemoteVLM:
    def __init__(self, remote):
        self._remote = remote
        if remote.provider == "huggingface":
            self._provider = HuggingFaceProvider(remote)
            self._model = remote.remote_model or DEFAULT_REMOTE_HF_MODEL
        elif remote.provider == "replicate":
            if not remote.remote_model:
                raise ValueError(
                    "replicate image captioning requires 'remote_model' to be set"
                )
            self._provider = ReplicateProvider(remote)
            self._model = remote.remote_model
        else:
            raise ValueError(f"unsupported remote provider: {remote.provider}")

    def ask(self, image: SaveableImage, question: str) -> str:
        if self._remote.provider == "huggingface":
            image_bytes = _image_to_jpeg_bytes(image)
            return self._provider.chat_with_image(
                image_bytes,
                model=self._model,
                prompt=question,
            )

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            temp_path = Path(tmp.name)

        try:
            image.save(temp_path, format="JPEG")
            raw_result = self._provider.caption_image(
                temp_path,
                model=self._model,
                prompt=question,
            )
        finally:
            temp_path.unlink(missing_ok=True)

        return _normalize_remote_vlm_answer(raw_result)


def load_model(model_name: str, device: str, remote=None):
    if remote and remote.enabled:
        return RemoteVLM(remote)
    if model_name == "smolvlm":
        return SmolVLM(device)
    return Phi4Multimodal(device)


def _image_to_jpeg_bytes(image: SaveableImage) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def _pil_image_module():
    try:
        return importlib.import_module("PIL.Image")
    except ImportError as exc:
        raise ValueError(
            "Pillow is not installed; image-captioner requires pillow"
        ) from exc


def _normalize_remote_vlm_answer(raw_result: object) -> str:
    if isinstance(raw_result, str):
        return raw_result.strip()
    if not isinstance(raw_result, dict):
        raise ValueError("unsupported remote caption response shape")
    if isinstance(raw_result.get("caption"), str):
        return str(raw_result["caption"]).strip()
    if isinstance(raw_result.get("text"), str):
        return str(raw_result["text"]).strip()
    if isinstance(raw_result.get("output"), str):
        return str(raw_result["output"]).strip()
    raise ValueError("remote caption response did not contain text")


# ---------------------------------------------------------------------------
# Tag extraction (simple heuristic from description)
# ---------------------------------------------------------------------------

TAG_KEYWORDS = [
    "portrait",
    "landscape",
    "food",
    "coffee",
    "nature",
    "city",
    "architecture",
    "street",
    "people",
    "animal",
    "product",
    "fashion",
    "interior",
    "sunset",
    "beach",
    "forest",
    "night",
    "sport",
    "technology",
    "art",
]


def extract_tags(description: str, caption: str) -> list[str]:
    combined = (description + " " + caption).lower()
    return [kw for kw in TAG_KEYWORDS if kw in combined]


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def process(config_path: Path) -> None:
    cfg = validate_config(load_config(config_path))

    input_dir = Path(cfg.get("input_dir", "./input"))
    output_dir = Path(cfg.get("output_dir", "./output"))
    model_name = cfg.get("model", "smolvlm")
    prompt_desc = cfg.get("prompt_description", "Describe this image in one sentence.")
    prompt_cap = cfg.get(
        "prompt_caption",
        "Write an engaging Instagram caption for this image. Include 3-5 relevant hashtags.",
    )
    device = resolve_device(cfg)
    remote = remote_provider_from_config(
        cfg,
        supported_providers={"huggingface", "replicate"},
    )

    if not input_dir.exists():
        print(f"Error: input_dir does not exist: {input_dir}", file=sys.stderr)
        sys.exit(1)

    images = sorted(
        p
        for p in input_dir.iterdir()
        if p.is_file() and p.suffix.lower() in INPUT_EXTENSIONS
    )
    if not images:
        print(f"No images found in {input_dir}")
        return

    output_dir.mkdir(parents=True, exist_ok=True)
    vlm = load_model(model_name, device, remote)

    print(f"Processing {len(images)} image(s) with {model_name} on {device}…")
    print()

    succeeded, failed = 0, []

    for img_path in images:
        print(f"[{img_path.name}]")
        try:
            pil_image = _pil_image_module()
            image = pil_image.open(img_path).convert("RGB")
            description = vlm.ask(image, prompt_desc)
            caption = vlm.ask(image, prompt_cap)
            tags = extract_tags(description, caption)

            out = {
                "description": description,
                "caption": caption,
                "tags": tags,
            }

            out_path = output_dir / (img_path.stem + ".json")
            with out_path.open("w") as f:
                json.dump(out, f, indent=2, ensure_ascii=False)

            print(
                f"  description: {description[:80]}{'…' if len(description) > 80 else ''}"
            )
            print(f"  → {out_path}")
            succeeded += 1
        except Exception as exc:
            print(f"  ERROR: {exc}", file=sys.stderr)
            failed.append(img_path.name)

    print()
    print(f"Done: {succeeded}/{len(images)} succeeded", end="")
    if failed:
        print(f", {len(failed)} failed: {', '.join(failed)}")
        sys.exit(1)
    else:
        print()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="clawvlm — vision-language image captioner"
    )
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--input", help="Override input_dir")
    parser.add_argument("--output", help="Override output_dir")
    parser.add_argument("--model", choices=list(VALID_MODELS), help="Override model")
    parser.add_argument("--device", choices=list(VALID_DEVICES), help="Override device")
    parser.add_argument("--prompt-description", help="Override prompt_description")
    parser.add_argument("--prompt-caption", help="Override prompt_caption")
    parser.add_argument(
        "--provider",
        choices=["local", "none", "huggingface", "replicate"],
        help="Optional remote provider; defaults to local inference",
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

    if args.input:
        cfg["input_dir"] = args.input
    if args.output:
        cfg["output_dir"] = args.output
    if args.model:
        cfg["model"] = args.model
    if args.device:
        cfg["device"] = args.device
    if args.prompt_description:
        cfg["prompt_description"] = args.prompt_description
    if args.prompt_caption:
        cfg["prompt_caption"] = args.prompt_caption

    cfg = merge_remote_provider_overrides(
        cfg,
        provider=args.provider,
        remote_model=args.remote_model,
        hf_token_env=args.hf_token_env,
        replicate_api_key_env=args.replicate_api_key_env,
        remote_timeout_seconds=args.remote_timeout_seconds,
    )

    import tempfile, json as _json

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
        _json.dump(cfg, tmp)
        tmp_path = Path(tmp.name)

    try:
        process(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
