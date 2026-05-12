#!/usr/bin/env python3

from __future__ import annotations

import argparse
import copy
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from preflight import check_runtime, validate_render_spec
from validate_contracts import load_json, validate_instance_files

ASSET_GROUPS = {
    "images": "image",
    "videos": "video",
    "audio": "audio",
    "fonts": "font",
}


@dataclass(frozen=True)
class ResolvedConfig:
    input_dir: Path
    output_dir: Path
    render_spec_path: Path
    render_spec_version: str
    render_spec_schema: Path
    render_manifest_schema: Path
    manifest_filename: str
    thumbnail_filename: str
    overwrite: bool


@dataclass(frozen=True)
class PreparedRender:
    spec_path: Path
    source_spec_path: Path
    output_dir: Path
    video_path: Path
    thumbnail_path: Path
    manifest_path: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="remotion-video — validate a render spec, stage assets, and delegate rendering to the skill-local Node runner"
    )
    parser.add_argument("--config", default="config.json", help="Path to config JSON")
    parser.add_argument("--input", help="Override input_dir")
    parser.add_argument("--output", help="Override output_dir")
    parser.add_argument(
        "--render-spec",
        dest="render_spec_path",
        help="Override render_spec_path with an explicit render spec JSON file",
    )
    overwrite_group = parser.add_mutually_exclusive_group()
    overwrite_group.add_argument(
        "--overwrite",
        dest="overwrite",
        action="store_true",
        help="Allow existing output files to be replaced",
    )
    overwrite_group.add_argument(
        "--no-overwrite",
        dest="overwrite",
        action="store_false",
        help="Fail if any expected output file already exists",
    )
    parser.set_defaults(overwrite=None)
    return parser.parse_args()


def _resolve_cli_path(value: str | Path, *, base_dir: Path) -> Path:
    candidate = Path(value).expanduser()
    if candidate.is_absolute():
        return candidate.resolve()
    return (base_dir / candidate).resolve()


def _require_object(value: Any, *, label: str, path: Path) -> dict[str, Any]:
    if not isinstance(value, dict):
        print(f"Error: {label} must be a JSON object in {path}", file=sys.stderr)
        sys.exit(1)
    return value


def _slugify(value: str) -> str:
    slug = "".join(ch if ch.isalnum() or ch in {"-", "_", "."} else "-" for ch in value.strip())
    return slug.strip("-._") or "asset"


def load_config_file(config_path: Path) -> dict[str, Any]:
    loaded = load_json(config_path)
    return _require_object(loaded, label="config", path=config_path)


def merge_cli_overrides(config: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    merged = copy.deepcopy(config)
    if args.input is not None:
        merged["input_dir"] = args.input
    if args.output is not None:
        merged["output_dir"] = args.output
    if args.render_spec_path is not None:
        merged["render_spec_path"] = args.render_spec_path
    if args.overwrite is not None:
        merged["overwrite"] = args.overwrite
    return merged


def resolve_config(config: dict[str, Any], *, config_path: Path) -> ResolvedConfig:
    base_dir = config_path.parent

    input_dir = _resolve_cli_path(config.get("input_dir", "./input"), base_dir=base_dir)
    output_dir = _resolve_cli_path(config.get("output_dir", "./output"), base_dir=base_dir)
    render_spec_path = _resolve_cli_path(
        config.get("render_spec_path", "./input/render-spec.json"),
        base_dir=base_dir,
    )
    render_spec_schema = _resolve_cli_path(
        config.get("render_spec_schema", "./schemas/render-spec.v1.schema.json"),
        base_dir=base_dir,
    )
    render_manifest_schema = _resolve_cli_path(
        config.get("render_manifest_schema", "./schemas/render-manifest.v1.schema.json"),
        base_dir=base_dir,
    )
    render_spec_version = config.get("render_spec_version", "1.0")
    manifest_filename = config.get("manifest_filename", "render-manifest.json")
    thumbnail_filename = config.get("thumbnail_filename", "thumbnail.png")
    overwrite = config.get("overwrite", True)

    if not isinstance(render_spec_version, str) or not render_spec_version.strip():
        print("Error: config.render_spec_version must be a non-empty string", file=sys.stderr)
        sys.exit(1)
    if not isinstance(manifest_filename, str) or not manifest_filename.strip():
        print("Error: config.manifest_filename must be a non-empty string", file=sys.stderr)
        sys.exit(1)
    if not isinstance(thumbnail_filename, str) or not thumbnail_filename.strip():
        print("Error: config.thumbnail_filename must be a non-empty string", file=sys.stderr)
        sys.exit(1)
    if not isinstance(overwrite, bool):
        print("Error: config.overwrite must be true or false", file=sys.stderr)
        sys.exit(1)

    if not render_spec_schema.exists():
        print(f"Error: render spec schema not found: {render_spec_schema}", file=sys.stderr)
        sys.exit(1)
    if not render_manifest_schema.exists():
        print(f"Error: render manifest schema not found: {render_manifest_schema}", file=sys.stderr)
        sys.exit(1)

    return ResolvedConfig(
        input_dir=input_dir,
        output_dir=output_dir,
        render_spec_path=render_spec_path,
        render_spec_version=render_spec_version,
        render_spec_schema=render_spec_schema,
        render_manifest_schema=render_manifest_schema,
        manifest_filename=manifest_filename,
        thumbnail_filename=thumbnail_filename,
        overwrite=overwrite,
    )


def validate_spec(config: ResolvedConfig) -> dict[str, Any]:
    schema_errors = validate_instance_files(config.render_spec_schema, config.render_spec_path)
    if schema_errors:
        print(
            f"Render spec schema validation failed for {config.render_spec_path}:",
            file=sys.stderr,
        )
        for error in schema_errors:
            print(f"- {error}", file=sys.stderr)
        sys.exit(1)

    render_errors = validate_render_spec(config.render_spec_path)
    if render_errors:
        print(f"Render spec validation failed for {config.render_spec_path}:", file=sys.stderr)
        for error in render_errors:
            print(f"- {error}", file=sys.stderr)
        sys.exit(1)

    spec = load_json(config.render_spec_path)
    spec_object = _require_object(spec, label="render spec", path=config.render_spec_path)

    actual_version = spec_object.get("render_spec_version")
    if actual_version != config.render_spec_version:
        print(
            "Error: render spec version mismatch: "
            f"config expects {config.render_spec_version!r}, spec declares {actual_version!r}",
            file=sys.stderr,
        )
        sys.exit(1)

    return spec_object


def _resolve_asset_source(reference: str, *, spec_path: Path, label: str) -> Path:
    source = _resolve_cli_path(reference, base_dir=spec_path.parent)
    if not source.exists():
        print(f"Error: {label} does not exist: {reference} (resolved to {source})", file=sys.stderr)
        sys.exit(1)
    if not source.is_file():
        print(f"Error: {label} must be a file: {source}", file=sys.stderr)
        sys.exit(1)
    return source


def _copy_asset(
    source: Path,
    *,
    stage_root: Path,
    relative_dir: str,
    label: str,
    cache: dict[Path, Path],
) -> str:
    if source in cache:
        return str(cache[source].relative_to(stage_root))

    destination_dir = stage_root / relative_dir
    destination_dir.mkdir(parents=True, exist_ok=True)

    safe_name = _slugify(label)
    suffix = source.suffix or ""
    destination = destination_dir / f"{safe_name}{suffix}"
    counter = 1
    while destination.exists():
        destination = destination_dir / f"{safe_name}-{counter}{suffix}"
        counter += 1

    shutil.copy2(source, destination)
    cache[source] = destination
    return str(destination.relative_to(stage_root))


def stage_render_spec(spec: dict[str, Any], *, config: ResolvedConfig, temp_dir: Path) -> PreparedRender:
    stage_root = temp_dir / "render-staging"
    stage_root.mkdir(parents=True, exist_ok=True)

    spec_copy = copy.deepcopy(spec)
    cache: dict[Path, Path] = {}

    brand = spec_copy.get("brand")
    if isinstance(brand, dict):
        logo_path = brand.get("logo_path")
        if isinstance(logo_path, str) and logo_path.strip():
            logo_source = _resolve_asset_source(
                logo_path,
                spec_path=config.render_spec_path,
                label="brand.logo_path",
            )
            brand["logo_path"] = _copy_asset(
                logo_source,
                stage_root=stage_root,
                relative_dir="brand",
                label=f"brand-logo-{logo_source.stem}",
                cache=cache,
            )

    assets = spec_copy.get("assets")
    if isinstance(assets, dict):
        for group_name, expected_kind in ASSET_GROUPS.items():
            group = assets.get(group_name, [])
            if not isinstance(group, list):
                continue
            for index, asset in enumerate(group):
                if not isinstance(asset, dict):
                    print(
                        f"Error: assets.{group_name}[{index}] must be an object before staging",
                        file=sys.stderr,
                    )
                    sys.exit(1)
                asset_kind = asset.get("kind")
                if asset_kind != expected_kind:
                    print(
                        f"Error: assets.{group_name}[{index}].kind must be {expected_kind!r}, got {asset_kind!r}",
                        file=sys.stderr,
                    )
                    sys.exit(1)
                asset_path = asset.get("path")
                asset_id = asset.get("id", f"{group_name}-{index}")
                if not isinstance(asset_path, str) or not asset_path.strip():
                    print(
                        f"Error: assets.{group_name}[{index}].path must be a non-empty string",
                        file=sys.stderr,
                    )
                    sys.exit(1)
                source = _resolve_asset_source(
                    asset_path,
                    spec_path=config.render_spec_path,
                    label=f"assets.{group_name}[{index}].path",
                )
                asset["path"] = _copy_asset(
                    source,
                    stage_root=stage_root,
                    relative_dir=f"assets/{group_name}",
                    label=f"{asset_id}-{source.stem}",
                    cache=cache,
                )

    staged_spec_path = stage_root / "render-spec.json"
    with staged_spec_path.open("w", encoding="utf-8") as handle:
        json.dump(spec_copy, handle, indent=2)
        handle.write("\n")

    output = _require_object(spec_copy.get("output"), label="render spec output", path=config.render_spec_path)
    video_filename = output.get("video_filename")
    spec_thumbnail_filename = output.get("thumbnail_filename")

    if not isinstance(video_filename, str) or not video_filename.strip():
        print("Error: render spec output.video_filename must be a non-empty string", file=sys.stderr)
        sys.exit(1)
    if not isinstance(spec_thumbnail_filename, str) or not spec_thumbnail_filename.strip():
        print("Error: render spec output.thumbnail_filename must be a non-empty string", file=sys.stderr)
        sys.exit(1)

    return PreparedRender(
        spec_path=staged_spec_path,
        source_spec_path=config.render_spec_path,
        output_dir=config.output_dir,
        video_path=config.output_dir / video_filename,
        thumbnail_path=config.output_dir / spec_thumbnail_filename,
        manifest_path=config.output_dir / config.manifest_filename,
    )


def ensure_output_targets(prepared: PreparedRender, *, overwrite: bool) -> None:
    prepared.output_dir.mkdir(parents=True, exist_ok=True)
    if overwrite:
        return

    existing = [
        path for path in (prepared.video_path, prepared.thumbnail_path, prepared.manifest_path) if path.exists()
    ]
    if existing:
        print("Error: output files already exist and overwrite is disabled:", file=sys.stderr)
        for path in existing:
            print(f"- {path}", file=sys.stderr)
        sys.exit(1)


def run_render(prepared: PreparedRender) -> int:
    command = [
        "npm",
        "run",
        "render",
        "--",
        "--spec",
        str(prepared.spec_path),
        "--source-spec-path",
        str(prepared.source_spec_path),
        "--output-dir",
        str(prepared.output_dir),
        "--video-path",
        str(prepared.video_path),
        "--thumbnail-path",
        str(prepared.thumbnail_path),
        "--manifest-path",
        str(prepared.manifest_path),
    ]

    result = subprocess.run(
        command,
        cwd=SKILL_DIR,
        capture_output=True,
        text=True,
    )

    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip(), file=sys.stderr)

    if result.returncode != 0:
        print(
            "Render command failed. Python orchestration completed validation and staging, "
            "but the Node-side renderer exited non-zero.",
            file=sys.stderr,
        )
        print(f"Command: {' '.join(command)}", file=sys.stderr)
        return result.returncode

    return 0


def process(config: ResolvedConfig) -> int:
    spec = validate_spec(config)

    print(f"Render spec: {config.render_spec_path}")
    print(f"Output dir:  {config.output_dir}")
    print()

    runtime_status = check_runtime(skip_browser_ensure=False)
    if runtime_status != 0:
        return runtime_status

    with tempfile.TemporaryDirectory(prefix="remotion-video-") as temp_dir_name:
        prepared = stage_render_spec(spec, config=config, temp_dir=Path(temp_dir_name))
        ensure_output_targets(prepared, overwrite=config.overwrite)
        return run_render(prepared)


def main() -> int:
    args = parse_args()
    config_path = _resolve_cli_path(args.config, base_dir=Path.cwd())
    config = load_config_file(config_path)
    merged_config = merge_cli_overrides(config, args)
    resolved = resolve_config(merged_config, config_path=config_path)
    return process(resolved)


if __name__ == "__main__":
    raise SystemExit(main())
