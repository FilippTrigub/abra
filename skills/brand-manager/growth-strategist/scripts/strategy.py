#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

TASKS = ["ideas", "freetools"]


def load_config(skill_dir: Path) -> dict:
    config_path = skill_dir / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return {}


def main() -> None:
    skill_dir = _SCRIPTS_DIR.parent
    config = load_config(skill_dir)
    default_task = config.get("task", "ideas")

    parser = argparse.ArgumentParser(description="growth-strategist — marketing ideas and free tool discovery")
    parser.add_argument("task", nargs="?", default=default_task, choices=TASKS,
                        help=f"Task to run (default: {default_task})")
    parser.add_argument("--input", default=config.get("input_dir", "./input"), help="Input directory")
    parser.add_argument("--output", default=config.get("output_dir", "./output"), help="Output directory")
    parser.add_argument("--marketing-goal",
                        default=config.get("marketing_goal", "brand_awareness"),
                        help="Marketing goal (ideas task)")
    parser.add_argument("--target-audience",
                        default=config.get("target_audience", "small_business"),
                        help="Target audience (ideas task)")
    parser.add_argument("--tone", default=config.get("tone", "professional"),
                        help="Tone (ideas task)")
    parser.add_argument("--max-ideas", type=int, default=config.get("max_ideas", 10),
                        help="Max ideas to generate (ideas task)")
    parser.add_argument("--tools-categories", nargs="+",
                        default=config.get("tools_categories", ["social_media", "analytics", "design", "automation"]),
                        help="Tool categories to include (freetools task)")
    args = parser.parse_args()

    task_config = {
        "input_dir": args.input,
        "output_dir": args.output,
        "marketing_goal": args.marketing_goal,
        "target_audience": args.target_audience,
        "tone": args.tone,
        "max_ideas": args.max_ideas,
        "include_examples": config.get("include_examples", True),
        "tools_categories": args.tools_categories,
        "output_format": config.get("output_format", "markdown"),
    }

    import importlib
    module = importlib.import_module(f"tasks.{args.task}")
    module.run(task_config)


if __name__ == "__main__":
    main()
