from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from .config import RemoteProviderConfig, require_provider_api_key


class ReplicateProvider:
    def __init__(self, remote: RemoteProviderConfig):
        if remote.provider != "replicate":
            raise ValueError("replicate provider config is required")

        self._remote = remote
        self._token = require_provider_api_key(remote)

    def run_model(self, model: str, *, input: dict[str, Any]) -> Any:
        client = self._client()
        output = client.run(model, input=input)
        return _normalize_output(output)

    def automatic_speech_recognition(
        self,
        audio_path: Path,
        *,
        model: str,
        language: str | None = None,
    ) -> Any:
        with audio_path.open("rb") as audio_file:
            input_payload: dict[str, Any] = {"audio": audio_file}
            if language:
                input_payload["language"] = language
            return self.run_model(model, input=input_payload)

    def caption_image(self, image_path: Path, *, model: str, prompt: str) -> Any:
        with image_path.open("rb") as image_file:
            return self.run_model(
                model,
                input={
                    "image": image_file,
                    "prompt": prompt,
                },
            )

    def text_to_image(
        self,
        prompt: str,
        *,
        model: str,
        negative_prompt: str | None = None,
        width: int | None = None,
        height: int | None = None,
        num_inference_steps: int | None = None,
        guidance_scale: float | None = None,
        seed: int | None = None,
    ) -> Any:
        input_payload: dict[str, Any] = {"prompt": prompt}
        if negative_prompt:
            input_payload["negative_prompt"] = negative_prompt
        if width is not None:
            input_payload["width"] = width
        if height is not None:
            input_payload["height"] = height
        if num_inference_steps is not None:
            input_payload["num_inference_steps"] = num_inference_steps
        if guidance_scale is not None:
            input_payload["guidance_scale"] = guidance_scale
        if seed is not None:
            input_payload["seed"] = seed
        return self.run_model(model, input=input_payload)

    def generate_music(
        self,
        prompt: str,
        *,
        model: str,
        duration: float,
    ) -> Any:
        return self.run_model(
            model,
            input={
                "prompt": prompt,
                "duration": duration,
            },
        )

    def download_bytes(self, url: str) -> bytes:
        with urlopen(url, timeout=self._remote.remote_timeout_seconds) as response:
            return response.read()

    def _client(self):
        try:
            replicate = importlib.import_module("replicate")
        except ImportError as exc:
            raise ValueError(
                "replicate is not installed; remote Replicate inference requires the replicate package"
            ) from exc

        client_class = getattr(replicate, "Client", None)
        if client_class is None:
            raise ValueError("replicate.Client is unavailable in this environment")

        return client_class(api_token=self._token)


def _normalize_output(output: Any) -> Any:
    if isinstance(output, list) and len(output) == 1:
        return output[0]
    return output
