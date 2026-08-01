from __future__ import annotations

import os
from typing import Any

from .utils.remote_inference_mocks import (
    FakeCaptionImageModule,
    FakeHuggingFaceProvider,
    FakeImageModule,
    FakeReplicateProvider,
    FakeRunpodProvider,
    load_script_module,
)


def test_audio_transcriber_remote_normalization() -> None:
    mod: Any = load_script_module(
        "skills/audio-transcriber/scripts/transcriber.py", "audio_transcriber_test_mod"
    )
    mod.HuggingFaceProvider = FakeHuggingFaceProvider

    remote = mod.remote_provider_from_config({"provider": "huggingface"})
    result = mod.transcribe_audio_remote(
        "/tmp/fake.wav", remote, "openai/whisper-large-v3", "en"
    )

    assert result["text"] == "remote transcript"
    assert result["chunks"][0]["text"] == "remote transcript"


def test_image_captioner_remote_sidecar_shape() -> None:
    mod: Any = load_script_module(
        "skills/image-captioner/scripts/describe.py", "image_captioner_test_mod"
    )
    mod.HuggingFaceProvider = FakeHuggingFaceProvider
    mod._pil_image_module = lambda: FakeCaptionImageModule

    remote = mod.remote_provider_from_config(
        {"provider": "huggingface", "remote_model": "Qwen/Qwen2.5-VL-7B-Instruct"}
    )
    model = mod.load_model("smolvlm", "cpu", remote)
    image = mod._pil_image_module().open("unused")

    description = model.ask(image, "Describe this image in one sentence.")
    caption = model.ask(image, "Write an engaging Instagram caption.")
    tags = mod.extract_tags(description, caption)

    assert isinstance(description, str)
    assert isinstance(caption, str)
    assert isinstance(tags, list)


def test_image_generator_remote_artifact_path_contract() -> None:
    mod: Any = load_script_module(
        "skills/image-generator/scripts/txt2img.py", "txt2img_test_mod"
    )
    mod.ReplicateProvider = FakeReplicateProvider
    mod._pil_image_module = lambda: FakeImageModule

    remote = mod.remote_provider_from_config(
        {"provider": "replicate", "remote_model": "black-forest-labs/flux-2-flex"}
    )
    image = mod.generate_remote_image(
        remote,
        prompt="mountains",
        model_id="black-forest-labs/FLUX.1-dev",
        negative_prompt="bad",
        width=1024,
        height=1024,
        num_inference_steps=4,
        guidance_scale=1.0,
        seed=1,
    )

    assert hasattr(image, "save")


def test_music_generator_hf_rejection() -> None:
    mod: Any = load_script_module(
        "skills/music-generator/scripts/generate_music.py", "music_generator_test_mod"
    )
    try:
        mod.remote_provider_from_config(
            {"provider": "huggingface"},
            supported_providers={"huggingface", "replicate"},
            unsupported_provider_reasons={
                "huggingface": "music generation is not supported for HuggingFace in wave 1"
            },
        )
    except ValueError as exc:
        assert "not supported" in str(exc)
    else:
        raise AssertionError("Expected HF music rejection")


def test_runpod_provider_in_valid_providers() -> None:
    """runpod must be accepted as a valid provider string."""
    from skills._providers.config import normalize_provider

    assert normalize_provider("runpod") == "runpod"
    assert normalize_provider("local") is None
    assert normalize_provider(None) is None


def test_modal_and_global_remote_provider_resolution(monkeypatch) -> None:
    from skills._providers.config import normalize_provider

    assert normalize_provider("modal") == "modal"
    monkeypatch.setenv("ABRA_REMOTE_GPU_PROVIDER", "modal")
    assert normalize_provider("remote") == "modal"


def test_global_remote_provider_requires_a_supported_value(monkeypatch) -> None:
    from skills._providers.config import normalize_provider

    monkeypatch.delenv("ABRA_REMOTE_GPU_PROVIDER", raising=False)
    try:
        normalize_provider("remote")
    except ValueError as exc:
        assert "ABRA_REMOTE_GPU_PROVIDER" in str(exc)
    else:
        raise AssertionError("Expected a clear global-provider configuration error")


def test_runpod_config_fields_round_trip() -> None:
    """RunPod config fields survive a merge → parse round trip."""
    from skills._providers.config import (
        merge_remote_provider_overrides,
        remote_provider_from_config,
    )

    base = {"provider": "runpod", "runpod_endpoint_id_env": "MY_ENDPOINT_ENV"}
    merged = merge_remote_provider_overrides(
        base,
        runpod_api_key_env="MY_API_KEY_ENV",
        remote_timeout_seconds=900,
    )
    remote = remote_provider_from_config(merged, supported_providers={"runpod"})

    assert remote.provider == "runpod"
    assert remote.runpod_api_key_env == "MY_API_KEY_ENV"
    assert remote.runpod_endpoint_id_env == "MY_ENDPOINT_ENV"
    assert remote.remote_timeout_seconds == 900


def test_runpod_provider_rejects_missing_endpoint_env() -> None:
    """RunpodProvider raises when runpod_endpoint_id_env is absent."""
    import importlib

    _cfg_mod = importlib.import_module("skills._providers.config")
    _rp_mod = importlib.import_module("skills._providers.runpod")

    remote = _cfg_mod.remote_provider_from_config(
        {"provider": "runpod"},
        supported_providers={"runpod"},
    )
    # endpoint_id_env is None — must fail fast
    try:
        _rp_mod.RunpodProvider.__new__(_rp_mod.RunpodProvider)
        _rp_mod._resolve_endpoint_id(remote)
    except ValueError as exc:
        assert "runpod_endpoint_id_env" in str(exc)
    else:
        raise AssertionError("Expected ValueError for missing endpoint env")


def test_runpod_provider_rejects_missing_api_key(monkeypatch) -> None:
    """RunpodProvider raises when the API key env var is unset."""
    import importlib

    monkeypatch.delenv("RUNPOD_API_KEY", raising=False)

    _cfg_mod = importlib.import_module("skills._providers.config")
    _rp_mod = importlib.import_module("skills._providers.runpod")

    remote = _cfg_mod.remote_provider_from_config(
        {"provider": "runpod", "runpod_endpoint_id_env": "RUNPOD_ENDPOINT_ID_VIDEO_EDITOR"},
        supported_providers={"runpod"},
    )
    try:
        _cfg_mod.require_provider_api_key(remote)
    except ValueError as exc:
        assert "RUNPOD_API_KEY" in str(exc)
    else:
        raise AssertionError("Expected ValueError for missing API key")


def test_fake_runpod_provider_run_skill(tmp_path) -> None:
    """FakeRunpodProvider.run_skill writes a fake output and returns its path."""
    from skills._providers.config import remote_provider_from_config

    remote = remote_provider_from_config(
        {"provider": "runpod", "runpod_endpoint_id_env": "RUNPOD_ENDPOINT_ID_VIDEO_EDITOR"},
        supported_providers={"runpod"},
    )
    provider = FakeRunpodProvider(remote)

    input_dir = tmp_path / "input"
    input_dir.mkdir()
    (input_dir / "clip.mp4").write_bytes(b"fake-video")

    output_dir = tmp_path / "output"
    outputs = provider.run_skill(input_dir, output_dir, {"prompt": "test"})

    assert len(outputs) == 1
    assert outputs[0].exists()
    assert provider.last_params["prompt"] == "test"
