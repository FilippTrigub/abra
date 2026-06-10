#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

TASKS = ["cro", "signup", "onboarding", "form", "experiment", "retention"]


def load_config(skill_dir: Path) -> dict:
    config_path = skill_dir / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return {}


def main() -> None:
    skill_dir = _SCRIPTS_DIR.parent
    config = load_config(skill_dir)
    default_task = config.get("default_task", "cro")

    parser = argparse.ArgumentParser(description="funnel-optimizer — conversion funnel analysis")
    parser.add_argument(
        "task", nargs="?", default=default_task, choices=TASKS,
        help=f"Task to run (default: {default_task})",
    )
    parser.add_argument("--input", default=config.get("input_dir", "./input"), help="Input directory")
    parser.add_argument("--output", default=config.get("output_dir", "./output"), help="Output directory")
    args = parser.parse_args()

    import importlib
    module = importlib.import_module(f"tasks.{args.task}")
    module.run(input_dir=args.input, output_dir=args.output)


if __name__ == "__main__":
    main()
