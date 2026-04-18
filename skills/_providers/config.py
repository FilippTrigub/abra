from __future__ import annotations

import os
from collections.abc import Collection, Mapping
from dataclasses import dataclass

VALID_REMOTE_PROVIDERS: frozenset[str] = frozenset({"huggingface", "replicate", "runpod"})

DEFAULT_HF_TOKEN_ENV = "HF_TOKEN"
DEFAULT_REPLICATE_API_KEY_ENV = "REPLICATE_API_TOKEN"
DEFAULT_RUNPOD_API_KEY_ENV = "RUNPOD_API_KEY"
DEFAULT_REMOTE_TIMEOUT_SECONDS = 300

REMOTE_PROVIDER_CONFIG_KEYS: tuple[str, ...] = (
    "provider",
    "remote_model",
    "hf_token_env",
    "replicate_api_key_env",
    "runpod_api_key_env",
    "runpod_endpoint_id_env",
    "remote_timeout_seconds",
)


@dataclass(frozen=True)
class RemoteProviderConfig:
    provider: str | None = None
    remote_model: str | None = None
    hf_token_env: str = DEFAULT_HF_TOKEN_ENV
    replicate_api_key_env: str = DEFAULT_REPLICATE_API_KEY_ENV
    runpod_api_key_env: str = DEFAULT_RUNPOD_API_KEY_ENV
    runpod_endpoint_id_env: str | None = None
    remote_timeout_seconds: int = DEFAULT_REMOTE_TIMEOUT_SECONDS

    @property
    def enabled(self) -> bool:
        return self.provider is not None


def normalize_provider(provider: object) -> str | None:
    if provider is None:
        return None
    if not isinstance(provider, str):
        raise ValueError("'provider' must be a string when set")

    normalized = provider.strip().lower()
    if normalized in {"", "local", "none"}:
        return None
    if normalized not in VALID_REMOTE_PROVIDERS:
        valid = ", ".join(sorted(VALID_REMOTE_PROVIDERS))
        raise ValueError(f"'provider' must be one of: {valid}, local, none")
    return normalized


def merge_remote_provider_overrides(
    cfg: Mapping[str, object],
    *,
    provider: str | None = None,
    remote_model: str | None = None,
    hf_token_env: str | None = None,
    replicate_api_key_env: str | None = None,
    runpod_api_key_env: str | None = None,
    runpod_endpoint_id_env: str | None = None,
    remote_timeout_seconds: int | None = None,
) -> dict[str, object]:
    merged = dict(cfg)

    if provider is not None:
        merged["provider"] = normalize_provider(provider)
    if remote_model is not None:
        merged["remote_model"] = remote_model
    if hf_token_env is not None:
        merged["hf_token_env"] = hf_token_env
    if replicate_api_key_env is not None:
        merged["replicate_api_key_env"] = replicate_api_key_env
    if runpod_api_key_env is not None:
        merged["runpod_api_key_env"] = runpod_api_key_env
    if runpod_endpoint_id_env is not None:
        merged["runpod_endpoint_id_env"] = runpod_endpoint_id_env
    if remote_timeout_seconds is not None:
        merged["remote_timeout_seconds"] = remote_timeout_seconds

    return merged


def remote_provider_from_config(
    cfg: Mapping[str, object],
    *,
    supported_providers: Collection[str] | None = None,
    unsupported_provider_reasons: Mapping[str, str] | None = None,
) -> RemoteProviderConfig:
    provider = normalize_provider(cfg.get("provider"))
    hf_token_env = _required_string_config_value(
        cfg, "hf_token_env", DEFAULT_HF_TOKEN_ENV
    )
    replicate_api_key_env = _required_string_config_value(
        cfg,
        "replicate_api_key_env",
        DEFAULT_REPLICATE_API_KEY_ENV,
    )
    runpod_api_key_env = _required_string_config_value(
        cfg,
        "runpod_api_key_env",
        DEFAULT_RUNPOD_API_KEY_ENV,
    )
    runpod_endpoint_id_env = _string_config_value(
        cfg, "runpod_endpoint_id_env", None, allow_empty=True
    )
    remote_model = _string_config_value(cfg, "remote_model", None, allow_empty=True)
    timeout = _positive_int_config_value(
        cfg, "remote_timeout_seconds", DEFAULT_REMOTE_TIMEOUT_SECONDS
    )

    if provider is None:
        return RemoteProviderConfig(
            provider=None,
            remote_model=remote_model,
            hf_token_env=hf_token_env,
            replicate_api_key_env=replicate_api_key_env,
            runpod_api_key_env=runpod_api_key_env,
            runpod_endpoint_id_env=runpod_endpoint_id_env,
            remote_timeout_seconds=timeout,
        )

    if supported_providers is not None and provider not in supported_providers:
        valid = ", ".join(sorted(supported_providers))
        raise ValueError(
            f"provider '{provider}' is not supported here; supported providers: {valid}"
        )

    if unsupported_provider_reasons and provider in unsupported_provider_reasons:
        reason = unsupported_provider_reasons[provider]
        raise ValueError(f"provider '{provider}' is not supported: {reason}")

    return RemoteProviderConfig(
        provider=provider,
        remote_model=remote_model,
        hf_token_env=hf_token_env,
        replicate_api_key_env=replicate_api_key_env,
        runpod_api_key_env=runpod_api_key_env,
        runpod_endpoint_id_env=runpod_endpoint_id_env,
        remote_timeout_seconds=timeout,
    )


def provider_api_key_env(remote: RemoteProviderConfig) -> str:
    if remote.provider == "huggingface":
        return remote.hf_token_env
    if remote.provider == "replicate":
        return remote.replicate_api_key_env
    if remote.provider == "runpod":
        return remote.runpod_api_key_env
    raise ValueError("remote provider is not enabled")


def require_provider_api_key(remote: RemoteProviderConfig) -> str:
    env_name = provider_api_key_env(remote)
    key = os.environ.get(env_name, "").strip()
    if key:
        return key

    provider = remote.provider or "remote provider"
    raise ValueError(f"missing required environment variable {env_name} for {provider}")


def _string_config_value(
    cfg: Mapping[str, object],
    key: str,
    default: str | None,
    *,
    allow_empty: bool,
) -> str | None:
    raw = cfg.get(key, default)
    if raw is None:
        return None
    if not isinstance(raw, str):
        raise ValueError(f"'{key}' must be a string")

    value = raw.strip()
    if not value and not allow_empty:
        raise ValueError(f"'{key}' must not be empty")
    if not value and allow_empty:
        return None
    return value


def _required_string_config_value(
    cfg: Mapping[str, object], key: str, default: str
) -> str:
    value = _string_config_value(cfg, key, default, allow_empty=False)
    assert value is not None
    return value


def _positive_int_config_value(
    cfg: Mapping[str, object], key: str, default: int
) -> int:
    raw = cfg.get(key, default)
    if isinstance(raw, bool) or not isinstance(raw, int):
        raise ValueError(f"'{key}' must be an integer")
    if raw <= 0:
        raise ValueError(f"'{key}' must be greater than 0")
    return raw
