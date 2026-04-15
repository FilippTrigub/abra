from __future__ import annotations

import importlib.util
from io import BytesIO
from pathlib import Path
from types import ModuleType


REPO_ROOT = Path(__file__).resolve().parents[2]


class FakeImage:
    def __init__(self, content: str = "image"):
        self.content = content

    def save(self, path, *args, **kwargs):
        target = Path(path)
        target.write_text(self.content)

    def convert(self, _mode: str):
        return self


class FakeImageModule:
    @staticmethod
    def open(_stream):
        return FakeImage("remote-image")


class FakeCaptionImage:
    def convert(self, _mode: str):
        return self

    def save(self, *_args, **_kwargs):
        return None


class FakeCaptionImageModule:
    @staticmethod
    def open(_path):
        return FakeCaptionImage()


class FakeHuggingFaceProvider:
    def __init__(self, remote):
        self.remote = remote

    def automatic_speech_recognition(
        self, _audio_path, *, model, language=None, return_timestamps=True
    ):
        return {
            "text": "remote transcript",
            "language": language or "en",
            "chunks": [
                {"chunk_start": 0.0, "chunk_end": 1.0, "text": "remote transcript"}
            ],
        }

    def chat_with_image(self, _image_bytes, *, model, prompt, response_format=None):
        if "Describe" in prompt:
            return "Remote description"
        return "Remote caption #tag"

    def text_to_image(self, prompt, **kwargs):
        return FakeImage("hf-image")

    def generate_music(self, *_args, **_kwargs):
        raise ValueError(
            "provider 'huggingface' is not supported for music generation in wave 1"
        )


class FakeRunpodProvider:
    def __init__(self, remote):
        self.remote = remote
        self.last_params: dict = {}

    def run_skill(self, input_dir, output_dir, params):
        from pathlib import Path

        self.last_params = dict(params)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        out = output_dir / "fake_output.mp4"
        out.write_bytes(b"fake-runpod-output")
        return [out]


class FakeReplicateProvider:
    def __init__(self, remote):
        self.remote = remote

    def automatic_speech_recognition(self, _audio_path, *, model, language=None):
        return {
            "segments": [{"start": 0.0, "end": 1.0, "text": "replicate transcript"}]
        }

    def caption_image(self, _image_path, *, model, prompt):
        return {"caption": "Replicate caption"}

    def text_to_image(self, prompt, **kwargs):
        return "https://example.com/fake-image.png"

    def generate_music(self, prompt, *, model, duration):
        return "https://example.com/fake-audio.wav"

    def download_bytes(self, url):
        if url.endswith(".png"):
            return b"fake-image-bytes"
        return b"fake-audio-bytes"


def load_script_module(relative_path: str, module_name: str):
    module_path = REPO_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Could not load module spec for {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def fake_png_stream() -> BytesIO:
    return BytesIO(b"fake-image-bytes")
