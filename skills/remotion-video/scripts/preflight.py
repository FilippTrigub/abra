#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

LINUX_DEPS_URL = "https://www.remotion.dev/docs/miscellaneous/linux-dependencies"
STUCK_RENDER_URL = "https://convert.remotion.dev/docs/troubleshooting/stuck-render"
SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
FIXTURES_DIR = SKILL_DIR / "fixtures"
SCHEMA_PATH = SKILL_DIR / "schemas" / "render-spec.v1.schema.json"
VALID_FIXTURE = FIXTURES_DIR / "render-spec.valid.json"
INVALID_FIXTURE = FIXTURES_DIR / "render-spec.invalid.missing-composition.json"
ASSET_GROUPS = ("images", "videos", "audio", "fonts")


@dataclass(frozen=True)
class CheckResult:
    name: str
    ok: bool
    detail: str


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Top-level JSON must be an object: {path}")
    return data


def _resolve_path(spec_path: Path, value: str) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate
    return (spec_path.parent / candidate).resolve()


def _is_positive_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0


def validate_render_spec(spec_path: Path) -> list[str]:
    if not spec_path.exists():
        return [f"Spec file not found: {spec_path}"]

    try:
        schema = _load_json(SCHEMA_PATH)
        spec = _load_json(spec_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return [str(exc)]

    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = [
        f"{'.'.join(str(part) for part in error.path) or '<root>'}: {error.message}"
        for error in sorted(validator.iter_errors(spec), key=lambda error: list(error.path))
    ]

    brand = spec.get("brand", {})
    logo_path = brand.get("logo_path") if isinstance(brand, dict) else None
    if isinstance(logo_path, str) and logo_path.strip():
        resolved_logo = _resolve_path(spec_path, logo_path)
        if not resolved_logo.exists():
            errors.append(f"brand.logo_path does not exist: {logo_path}")

    asset_ids: set[str] = set()
    assets = spec.get("assets", {})
    if isinstance(assets, dict):
        for group_name in ASSET_GROUPS:
            group = assets.get(group_name, [])
            if not isinstance(group, list):
                continue
            for index, asset in enumerate(group):
                prefix = f"assets.{group_name}[{index}]"
                if not isinstance(asset, dict):
                    errors.append(f"{prefix} must be an object")
                    continue
                asset_id = asset.get("id")
                if isinstance(asset_id, str) and asset_id.strip():
                    asset_ids.add(asset_id)
                asset_path = asset.get("path")
                if isinstance(asset_path, str) and asset_path.strip():
                    resolved_asset = _resolve_path(spec_path, asset_path)
                    if not resolved_asset.exists():
                        errors.append(f"{prefix}.path does not exist: {asset_path}")

    scenes = spec.get("scenes", [])
    if isinstance(scenes, list):
        for index, scene in enumerate(scenes):
            if not isinstance(scene, dict):
                continue
            duration = scene.get("duration_seconds")
            if duration is not None and not _is_positive_number(duration):
                errors.append(f"scenes[{index}].duration_seconds must be a positive number")
            asset_refs = scene.get("asset_refs")
            if isinstance(asset_refs, list):
                for asset_ref in asset_refs:
                    if asset_ref not in asset_ids:
                        errors.append(f"scenes[{index}].asset_refs references unknown asset: {asset_ref}")

    return errors


def _run_command(command: list[str], cwd: Path | None = None, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _check_binary(name: str) -> CheckResult:
    resolved = shutil.which(name)
    if resolved is None:
        return CheckResult(name=name, ok=False, detail=f"Missing required binary: {name}")
    return CheckResult(name=name, ok=True, detail=f"Found {name} at {resolved}")


def _check_package_scripts() -> list[CheckResult]:
    package_path = SKILL_DIR / "package.json"
    if not package_path.exists():
        return [
            CheckResult(
                name="package.json",
                ok=False,
                detail="Missing skills/remotion-video/package.json; task 2 runtime scaffold is not ready yet",
            )
        ]

    try:
        package = _load_json(package_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return [CheckResult(name="package.json", ok=False, detail=f"Invalid package.json: {exc}")]

    scripts = package.get("scripts")
    if not isinstance(scripts, dict):
        return [CheckResult(name="package.json", ok=False, detail="package.json must define a scripts object")]

    results: list[CheckResult] = []
    for script_name in ("browser:ensure", "render", "typecheck"):
        if script_name in scripts:
            results.append(
                CheckResult(
                    name=f"npm script:{script_name}",
                    ok=True,
                    detail=f"Found npm script '{script_name}'",
                )
            )
        else:
            results.append(
                CheckResult(
                    name=f"npm script:{script_name}",
                    ok=False,
                    detail=f"Missing npm script '{script_name}' in package.json",
                )
            )
    return results


def check_runtime(skip_browser_ensure: bool) -> int:
    results = [
        _check_binary("node"),
        _check_binary("npm"),
        _check_binary("ffmpeg"),
        _check_binary("ffprobe"),
    ]
    results.extend(_check_package_scripts())

    failures = [result for result in results if not result.ok]
    for result in results:
        prefix = "OK" if result.ok else "FAIL"
        print(f"[{prefix}] {result.name}: {result.detail}")

    if failures:
        print(
            "\nRuntime preflight failed before any render attempt. "
            "Fix the missing runtime/browser prerequisites above first.",
            file=sys.stderr,
        )
        print(f"Linux dependency reference: {LINUX_DEPS_URL}", file=sys.stderr)
        print(f"Stuck render reference: {STUCK_RENDER_URL}", file=sys.stderr)
        return 1

    if skip_browser_ensure:
        print("\nRuntime preflight passed in static mode; browser ensure was not executed.")
        return 0

    print("\nRunning browser readiness check: npm run browser:ensure")
    result = _run_command(["npm", "run", "browser:ensure"], cwd=SKILL_DIR, timeout=600)
    if result.returncode != 0:
        print(result.stdout.strip())
        print(result.stderr.strip(), file=sys.stderr)
        print(
            "Browser readiness failed. The managed Chrome Headless Shell is not ready, "
            "or Linux shared libraries are missing.",
            file=sys.stderr,
        )
        print(f"Linux dependency reference: {LINUX_DEPS_URL}", file=sys.stderr)
        print(f"Stuck render reference: {STUCK_RENDER_URL}", file=sys.stderr)
        return 1

    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip(), file=sys.stderr)
    print("Browser readiness check passed.")
    return 0


def _format_size(path: Path) -> str:
    size = path.stat().st_size
    if size < 1024:
        return f"{size} B"
    return f"{size / 1024:.1f} KiB"


def check_fixtures() -> int:
    required_files = (SCHEMA_PATH, VALID_FIXTURE, INVALID_FIXTURE)
    missing = [path for path in required_files if not path.exists()]
    if missing:
        for path in missing:
            print(f"Missing fixture file: {path}", file=sys.stderr)
        return 1

    print("Committed Remotion fixtures:")
    for path in required_files:
        print(f"- {path.relative_to(SKILL_DIR)} ({_format_size(path)})")

    valid_errors = validate_render_spec(VALID_FIXTURE)
    if valid_errors:
        print("\nValid fixture failed validation:", file=sys.stderr)
        for error in valid_errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    invalid_errors = validate_render_spec(INVALID_FIXTURE)
    if not invalid_errors:
        print("\nInvalid fixture unexpectedly passed validation.", file=sys.stderr)
        return 1

    if not any("composition" in error for error in invalid_errors):
        print(
            "\nInvalid fixture failed, but not for the expected missing composition field.",
            file=sys.stderr,
        )
        for error in invalid_errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("\nFixture validation passed:")
    print("- render-spec.valid.json is ready for real E2E render tests")
    print("- render-spec.invalid.missing-composition.json fails before render with missing-field errors")
    return 0


def validate_spec_command(spec: Path) -> int:
    errors = validate_render_spec(spec)
    if errors:
        print(f"Spec validation failed for {spec}:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Spec validation passed for {spec}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Preflight checks and committed fixture validation for the remotion-video skill"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser(
        "check-fixtures",
        help="Verify committed valid/invalid fixtures and ensure the invalid spec fails before render",
    )

    validate_parser = subparsers.add_parser(
        "validate-spec",
        help="Validate a single render spec JSON file",
    )
    validate_parser.add_argument("--spec", required=True, type=Path, help="Path to a render spec JSON file")

    runtime_parser = subparsers.add_parser(
        "check-runtime",
        help="Check Node/npm/ffmpeg/browser readiness before running a real render",
    )
    runtime_parser.add_argument(
        "--skip-browser-ensure",
        action="store_true",
        help="Only run static runtime checks and do not invoke 'npm run browser:ensure'",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.command == "check-fixtures":
        return check_fixtures()
    if args.command == "validate-spec":
        return validate_spec_command(args.spec)
    if args.command == "check-runtime":
        return check_runtime(skip_browser_ensure=args.skip_browser_ensure)

    raise AssertionError(f"Unhandled command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
