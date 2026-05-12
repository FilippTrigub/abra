#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker


def load_json(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        print(f"Error: JSON file not found: {path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON in {path}: {exc}", file=sys.stderr)
        sys.exit(1)


def collect_validation_errors(schema: Any, instance: Any) -> list[str]:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    return [
        f"{'.'.join(str(part) for part in error.path) or '<root>'}: {error.message}"
        for error in sorted(validator.iter_errors(instance), key=lambda error: list(error.path))
    ]


def validate_instance_files(schema_path: Path, instance_path: Path) -> list[str]:
    schema = load_json(schema_path)
    instance = load_json(instance_path)
    return collect_validation_errors(schema, instance)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate a remotion-video contract fixture against a JSON schema"
    )
    parser.add_argument("--schema", required=True, help="Path to a JSON schema file")
    parser.add_argument("--instance", required=True, help="Path to a JSON instance file")
    args = parser.parse_args()

    schema_path = Path(args.schema)
    instance_path = Path(args.instance)

    errors = validate_instance_files(schema_path, instance_path)

    if errors:
        print(
            f"Validation failed: {instance_path} does not match {schema_path}",
            file=sys.stderr,
        )
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        sys.exit(1)

    print(f"Validation passed: {instance_path} matches {schema_path}")


if __name__ == "__main__":
    main()
