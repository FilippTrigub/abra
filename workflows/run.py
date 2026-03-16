#!/usr/bin/env python3
"""
Workflow runner — executes a workflow from config.json.

Usage:
    python run.py --workflow video-to-reel --input ./input --output ./output
    python run.py --workflow image-to-post --input ./photos --output ./output

    # Skip optional steps
    python run.py --workflow video-to-reel --input ./input --output ./output --skip-optional

    # Force CPU
    python run.py --workflow video-to-reel --input ./input --output ./output --device cpu
"""

import argparse
import json
import logging
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

SCRIPT_DIR = Path(__file__).parent
SKILLS_DIR = SCRIPT_DIR.parent / "skills"
WORKFLOWS_DIR = SCRIPT_DIR
PROJECT_ROOT = SKILLS_DIR.parent

DEFAULT_INPUT_DIR = PROJECT_ROOT / "input"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "output"
DEFAULT_ARCHIVE_DIR = PROJECT_ROOT / "archive"


def find_workflows() -> dict:
    workflows = {}
    for subdir in ["creative", "brand"]:
        base = WORKFLOWS_DIR / subdir
        if base.exists():
            for wf_dir in base.iterdir():
                if wf_dir.is_dir() and (wf_dir / "config.json").exists():
                    workflows[wf_dir.name] = wf_dir / "config.json"
    return workflows


def load_workflow(name: str) -> dict:
    workflows = find_workflows()
    if name not in workflows:
        log.error(f"Workflow not found: {name}")
        log.info(f"Available: {', '.join(workflows.keys())}")
        sys.exit(1)
    with open(workflows[name]) as f:
        return json.load(f)


def get_skill_script(skill_name: str) -> Path | None:
    skill_dir = SKILLS_DIR / skill_name
    if not skill_dir.exists():
        log.error(f"Skill not found: {skill_name}")
        return None

    candidates = [
        "process.py",
        "enhance.py",
        "caption_service.py",
        "score.py",
        "transcriber.py",
        "separate.py",
        "generate_music.py",
        "cutter.py",
        "describe.py",
        "rembg_batch.py",
        "bokeh.py",
        "img2vid.py",
        "posts.py",
    ]

    scripts_dir = skill_dir / "scripts"
    for candidate in candidates:
        script = scripts_dir / candidate
        if script.exists():
            return script

    for script in scripts_dir.glob("*.py"):
        if not script.name.startswith("_"):
            return script

    return None


def run_skill(
    skill_name: str,
    input_dir: Path,
    output_dir: Path,
    params: dict | None = None,
    device: str = "auto",
) -> bool:
    script = get_skill_script(skill_name)
    if not script:
        log.error(f"Could not find script for skill: {skill_name}")
        return False

    cmd = [
        sys.executable,
        str(script),
        "--input",
        str(input_dir),
        "--output",
        str(output_dir),
    ]

    if params:
        for key, value in params.items():
            cmd.extend([f"--{key}", str(value)])

    if device != "auto":
        cmd.extend(["--device", device])

    log.info(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, cwd=script.parent)
        return result.returncode == 0
    except Exception as e:
        log.error(f"Error running skill {skill_name}: {e}")
        return False


def prepare_input(input_path: Path) -> Path:
    input_path = Path(input_path)
    if not input_path.exists():
        log.error(f"Input not found: {input_path}")
        sys.exit(1)

    DEFAULT_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    staging = DEFAULT_INPUT_DIR / "staging"
    staging.mkdir(parents=True, exist_ok=True)

    if input_path.is_file():
        dest = staging / input_path.name
        shutil.copy2(input_path, dest)
        log.info(f"Stored input: {dest}")
        return staging
    elif input_path.is_dir():
        for f in input_path.glob("*"):
            if f.is_file():
                shutil.copy2(f, staging / f.name)
        log.info(f"Stored {len(list(staging.glob('*')))} files to input staging")
        return staging

    return staging


def archive_input(input_path: Path, workflow_name: str) -> Path:
    archive_path = DEFAULT_ARCHIVE_DIR / workflow_name
    archive_path.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest_dir = archive_path / timestamp
    dest_dir.mkdir(parents=True, exist_ok=True)

    if input_path.is_dir():
        for f in input_path.glob("*"):
            if f.is_file():
                shutil.move(str(f), str(dest_dir / f.name))
    elif input_path.is_file():
        shutil.move(str(input_path), str(dest_dir / input_path.name))

    log.info(f"Archived to: {dest_dir}")
    return dest_dir


def run_workflow(
    workflow_name: str,
    input_path: Path,
    output_path: Path | None = None,
    skip_optional: bool = False,
    device: str = "auto",
    archive: bool = True,
) -> bool:
    workflow = load_workflow(workflow_name)
    log.info(f"Starting workflow: {workflow['name']} - {workflow['description']}")

    staging = prepare_input(input_path)

    if output_path is None:
        output_path = DEFAULT_OUTPUT_DIR / workflow_name
    output_path = Path(output_path)
    output_path.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        current_input = staging
        step_outputs = {}

        for i, step in enumerate(workflow["steps"]):
            step_name = step["name"]

            if skip_optional and step.get("optional", False):
                log.info(f"Skipping optional: {step_name}")
                continue

            log.info(f"\n{'=' * 50}")
            log.info(f"Step {i + 1}: {step_name}")
            log.info(f"  {step['description']}")
            log.info(f"{'=' * 50}")

            step_output = tmpdir / f"step_{i:02d}_{step_name}"
            step_output.mkdir(parents=True, exist_ok=True)

            if step["skill"] == "brand-manager":
                action = step.get("action", "refresh")
                if action in ("refresh", "analyze", "update", "store-assets"):
                    log.info(f"Brand manager: {action}")
                    step_outputs[step_name] = current_input
                    continue

            params = step.get("params", {})
            success = run_skill(
                step["skill"], current_input, step_output, params, device
            )

            if not success:
                log.error(f"Step failed: {step_name}")
                return False

            step_outputs[step_name] = step_output
            current_input = step_output

        final_step = list(step_outputs.values())[-1]
        for f in final_step.glob("*"):
            if f.is_file():
                shutil.copy2(f, output_path / f.name)

        is_scheduling = any(
            s.get("skill") == "post-scheduler" for s in workflow["steps"]
        )

        log.info(f"\n{'=' * 50}")
        log.info(f"Workflow complete! Output: {output_path}")
        log.info(f"{'=' * 50}")

        if archive and is_scheduling:
            archive_input(staging, workflow_name)

        return True


def main():
    workflows = find_workflows()
    choices = list(workflows.keys())

    parser = argparse.ArgumentParser(description="Run OpenClaw workflow")
    parser.add_argument(
        "--workflow", "-w", required=True, choices=choices, help="Workflow to run"
    )
    parser.add_argument("--input", "-i", required=True, help="Input file or directory")
    parser.add_argument(
        "--output", "-o", default=None, help="Output directory (default: output/)"
    )
    parser.add_argument(
        "--skip-optional", "-s", action="store_true", help="Skip optional steps"
    )
    parser.add_argument(
        "--device",
        "-d",
        default="auto",
        choices=["auto", "cpu", "cuda"],
        help="Device to use (auto/cpu/cuda)",
    )
    parser.add_argument(
        "--no-archive", action="store_true", help="Don't archive input after scheduling"
    )

    args = parser.parse_args()

    success = run_workflow(
        args.workflow,
        args.input,
        args.output,
        args.skip_optional,
        args.device,
        not args.no_archive,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
