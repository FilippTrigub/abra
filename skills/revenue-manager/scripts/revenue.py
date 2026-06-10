#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

COMMANDS = ["revops", "crm"]


def load_config(skill_dir: Path) -> dict:
    config_path = skill_dir / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return {}


def main() -> None:
    skill_dir = _SCRIPTS_DIR.parent
    config = load_config(skill_dir)

    parser = argparse.ArgumentParser(description="revenue-manager — revenue operations and CRM")
    parser.add_argument("command", choices=COMMANDS, help="Command to run: revops or crm")
    parser.add_argument("--input", default=config.get("input_dir", "./input"), help="Input directory")
    parser.add_argument("--output", default=config.get("output_dir", "./output"), help="Output directory")
    args = parser.parse_args()

    import importlib
    module = importlib.import_module(f"tasks.{args.command}")
    module.run(input_dir=args.input, output_dir=args.output)


if __name__ == "__main__":
    main()
