from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any

from .config import RemoteProviderConfig, require_provider_api_key


class HuggingFaceProvider:
    def __init__(self, remote: RemoteProviderConfig):
        if remote.provider != "huggingface":
            raise ValueError("huggingface provider config is required")

        self._remote = remote
        self._token = require_provider_api_key(remote)

    def automatic_speech_recognition(
        self,
        audio_path: Path,
        *,
        model: str,
        language: str | None = None,
        return_timestamps: bool = True,
    ) -> dict[str, Any]:
        client = self._client(model=model)
        method = getattr(client, "automatic_speech_recognition", None) or getattr(
            client, "audio_to_text", None
        )
        if method is None:
            raise ValueError(
                "huggingface_hub.InferenceClient does not expose an ASR method in this environment"
            )

        with audio_path.open("rb") as audio_file:
            kwargs: dict[str, Any] = {"model": model}
            if language:
                kwargs["generate_kwargs"] = {"language": language}
            if return_timestamps:
                kwargs["return_timestamps"] = True

            try:
                response = method(audio_file, **kwargs)
            except TypeError:
                kwargs.pop("return_timestamps", None)
                response = method(audio_file, **kwargs)

        return _response_to_mapping(response)

    def chat_with_image(
        self,
        image_bytes: bytes,
        *,
        model: str,
        prompt: str,
        response_format: dict[str, Any] | None = None,
    ) -> str:
        import base64

        client = self._client()
        image_data = base64.b64encode(image_bytes).decode("utf-8")
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_data}"},
                    },
                ],
            }
        ]

        kwargs: dict[str, Any] = {"model": model, "messages": messages}
        if response_format is not None:
            kwargs["response_format"] = response_format

        response = client.chat.completions.create(**kwargs)
        return response.choices[0].message.content.strip()

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
    ):
        client = self._client(model=model)
        kwargs: dict[str, Any] = {"model": model}
        if negative_prompt:
            kwargs["negative_prompt"] = negative_prompt
        if width is not None:
            kwargs["width"] = width
        if height is not None:
            kwargs["height"] = height
        if num_inference_steps is not None:
            kwargs["num_inference_steps"] = num_inference_steps
        if guidance_scale is not None:
            kwargs["guidance_scale"] = guidance_scale
        if seed is not None:
            kwargs["seed"] = seed
        return client.text_to_image(prompt, **kwargs)

    def generate_music(self, *_args: Any, **_kwargs: Any) -> Any:
        raise ValueError(
            "provider 'huggingface' is not supported for music generation in wave 1"
        )

    def _client(self, *, model: str | None = None):
        try:
            huggingface_hub = importlib.import_module("huggingface_hub")
        except ImportError as exc:
            raise ValueError(
                "huggingface-hub is not installed; remote HuggingFace inference requires huggingface-hub"
            ) from exc

        inference_client = getattr(huggingface_hub, "InferenceClient", None)
        if inference_client is None:
            raise ValueError(
                "huggingface_hub.InferenceClient is unavailable in this environment"
            )

        return inference_client(
            model=model,
            token=self._token,
            timeout=self._remote.remote_timeout_seconds,
        )


def _response_to_mapping(response: Any) -> dict[str, Any]:
    if isinstance(response, dict):
        return response

    if hasattr(response, "model_dump"):
        dumped = response.model_dump()
        if isinstance(dumped, dict):
            return dumped

    if hasattr(response, "dict"):
        dumped = response.dict()
        if isinstance(dumped, dict):
            return dumped

    raise ValueError("unsupported HuggingFace response type for normalization")
