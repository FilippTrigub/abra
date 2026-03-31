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

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"}
SCHEDULER_PARAM_ORDER = [
    "channel_id",
    "text",
    "mode",
    "due_at",
    "image_url",
    "video_url",
    "video_staging_provider",
    "ig_type",
    "ig_first_comment",
    "li_first_comment",
    "link_attachment",
]


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


def list_files_with_extensions(directory: Path, extensions: set[str]) -> list[Path]:
    return sorted(
        [
            path
            for path in directory.glob("*")
            if path.is_file() and path.suffix.lower() in extensions
        ]
    )


def find_json_files(directory: Path) -> list[Path]:
    return sorted(path for path in directory.glob("*.json") if path.is_file())


def load_json_file(path: Path) -> dict | list | None:
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        log.warning(f"Skipping unreadable JSON file {path}: {exc}")
        return None


def extract_caption_text(directory: Path) -> str | None:
    for json_file in find_json_files(directory):
        payload = load_json_file(json_file)
        if isinstance(payload, dict):
            caption = payload.get("caption")
            if isinstance(caption, str) and caption.strip():
                return caption.strip()
    return None


def concatenate_transcript_segments(directory: Path) -> str | None:
    for json_file in find_json_files(directory):
        payload = load_json_file(json_file)
        segments = None
        if isinstance(payload, dict):
            segments = payload.get("segments")
        elif isinstance(payload, list):
            segments = payload

        if not isinstance(segments, list):
            continue

        text_parts: list[str] = []
        for segment in segments:
            if not isinstance(segment, dict):
                continue
            text = segment.get("text")
            if isinstance(text, str) and text.strip():
                text_parts.append(text.strip())

        if text_parts:
            return " ".join(text_parts)

    return None


def directory_has_transcript(directory: Path) -> bool:
    return concatenate_transcript_segments(directory) is not None


def build_scheduler_overrides(args: argparse.Namespace) -> dict:
    overrides = {
        "channel_id": args.channel_id,
        "text": args.text,
        "mode": args.mode,
        "due_at": args.due_at,
        "video_url": args.video_url,
        "video_staging_provider": args.video_staging_provider,
        "ig_type": args.ig_type,
        "ig_first_comment": args.ig_first_comment,
        "li_first_comment": args.li_first_comment,
        "link_attachment": args.link_attachment,
    }
    if args.image_url:
        overrides["image_url"] = args.image_url
    return {key: value for key, value in overrides.items() if value is not None}


def merge_scheduler_params(defaults: dict | None, overrides: dict | None) -> dict:
    merged = dict(defaults or {})
    merged.update(overrides or {})
    return merged


def normalize_scheduler_value(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    return [str(value)]


def build_scheduler_command(script: Path, params: dict) -> list[str]:
    cmd = [sys.executable, str(script), "create"]
    for key in SCHEDULER_PARAM_ORDER:
        if key not in params:
            continue
        for value in normalize_scheduler_value(params[key]):
            cmd.extend([f"--{key.replace('_', '-')}", value])
    return cmd


def determine_scheduler_media(
    workflow: dict,
    scheduler_params: dict,
    latest_media_output: Path | None,
) -> dict:
    params = dict(scheduler_params)
    input_type = workflow.get("input_type")

    if input_type == "image" and "image_url" not in params:
        if latest_media_output is None:
            raise ValueError("No image output available for post scheduling.")
        image_files = list_files_with_extensions(latest_media_output, IMAGE_EXTENSIONS)
        if not image_files:
            raise ValueError("No image files found for post scheduling.")
        params["image_url"] = [str(path) for path in image_files]

    if input_type == "video" and "video_url" not in params:
        if latest_media_output is None:
            raise ValueError("No video output available for post scheduling.")
        video_files = list_files_with_extensions(latest_media_output, VIDEO_EXTENSIONS)
        if not video_files:
            raise ValueError("No video files found for post scheduling.")
        params["video_url"] = str(video_files[-1])

    return params


def derive_scheduler_text(
    workflow: dict,
    scheduler_params: dict,
    transcript_output: Path | None,
    caption_output: Path | None,
) -> str:
    explicit_text = scheduler_params.get("text")
    if isinstance(explicit_text, str) and explicit_text.strip():
        return explicit_text.strip()

    input_type = workflow.get("input_type")
    derived_text: str | None = None

    if input_type == "image" and caption_output is not None:
        derived_text = extract_caption_text(caption_output)
    elif input_type in {"audio", "video"} and transcript_output is not None:
        derived_text = concatenate_transcript_segments(transcript_output)

    if derived_text:
        return derived_text

    raise ValueError(
        f"Could not derive scheduler text for workflow '{workflow['name']}'. "
        "Pass --text explicitly or ensure earlier steps produce caption/transcript JSON."
    )


def run_post_scheduler(
    workflow: dict,
    latest_media_output: Path | None,
    transcript_output: Path | None,
    caption_output: Path | None,
    defaults: dict | None,
    overrides: dict | None,
) -> bool:
    script = get_skill_script("post-scheduler")
    if not script:
        log.error("Could not find script for skill: post-scheduler")
        return False

    scheduler_params = merge_scheduler_params(defaults, overrides)
    channel_id = scheduler_params.get("channel_id")
    normalized_channel_id = channel_id.strip() if isinstance(channel_id, str) else ""
    if (
        not normalized_channel_id
        or normalized_channel_id.lower()
        in {"instagram", "linkedin", "twitter", "facebook"}
        or " " in normalized_channel_id
    ):
        log.error(
            "Scheduling workflows require an actual --channel-id (or workflow config "
            "channel_id). CLAW_DEFAULT_CHANNEL names are not valid here."
        )
        return False
    scheduler_params["channel_id"] = normalized_channel_id

    try:
        scheduler_params = determine_scheduler_media(
            workflow, scheduler_params, latest_media_output
        )
        scheduler_params["text"] = derive_scheduler_text(
            workflow,
            scheduler_params,
            transcript_output,
            caption_output,
        )
    except ValueError as exc:
        log.error(str(exc))
        return False

    if workflow.get("input_type") == "audio":
        scheduler_params.pop("image_url", None)
        scheduler_params.pop("video_url", None)

    cmd = build_scheduler_command(script, scheduler_params)
    log.info(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, cwd=script.parent)
        return result.returncode == 0
    except Exception as e:
        log.error(f"Error running skill post-scheduler: {e}")
        return False


def prepare_input(input_path: Path) -> Path:
    input_path = Path(input_path)
    if not input_path.exists():
        log.error(f"Input not found: {input_path}")
        sys.exit(1)

    DEFAULT_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    staging = DEFAULT_INPUT_DIR / "staging"
    staging.mkdir(parents=True, exist_ok=True)
    for existing in staging.glob("*"):
        if existing.is_file():
            existing.unlink()
        elif existing.is_dir():
            shutil.rmtree(existing)

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
    scheduler_overrides: dict | None = None,
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
        latest_media_output: Path | None = (
            staging if workflow.get("input_type") in {"image", "video"} else None
        )
        transcript_output: Path | None = None
        caption_output: Path | None = None

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
            if step["skill"] == "post-scheduler":
                success = run_post_scheduler(
                    workflow,
                    latest_media_output,
                    transcript_output,
                    caption_output,
                    params,
                    scheduler_overrides,
                )
                step_outputs[step_name] = current_input
            else:
                success = run_skill(
                    step["skill"], current_input, step_output, params, device
                )

                if success:
                    step_outputs[step_name] = step_output
                    current_input = step_output

                    if list_files_with_extensions(
                        step_output, IMAGE_EXTENSIONS | VIDEO_EXTENSIONS
                    ):
                        latest_media_output = step_output

                    if directory_has_transcript(step_output):
                        transcript_output = step_output

                    if step["skill"] == "image-captioner":
                        caption_output = step_output

            if not success:
                log.error(f"Step failed: {step_name}")
                return False

        final_step = latest_media_output or list(step_outputs.values())[-1]
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
    parser.add_argument(
        "--channel-id",
        help="Scheduler override: target Buffer channel ID for workflows ending in post-scheduler",
    )
    parser.add_argument(
        "--text",
        help="Scheduler override: explicit post text (otherwise derived from workflow outputs)",
    )
    parser.add_argument(
        "--mode",
        help="Scheduler override: Buffer create mode such as shareNow, addToQueue, or customScheduled",
    )
    parser.add_argument(
        "--due-at",
        help="Scheduler override: ISO8601 schedule time for customScheduled posts",
    )
    parser.add_argument(
        "--image-url",
        action="append",
        help="Scheduler override: image path or public URL (repeatable)",
    )
    parser.add_argument(
        "--video-url",
        help="Scheduler override: video path or public URL",
    )
    parser.add_argument(
        "--video-staging-provider",
        help="Scheduler override: staging provider for local scheduled videos (for example backblaze-b2)",
    )
    parser.add_argument("--ig-type", help="Scheduler override: Instagram post type")
    parser.add_argument(
        "--ig-first-comment", help="Scheduler override: Instagram first comment"
    )
    parser.add_argument(
        "--li-first-comment", help="Scheduler override: LinkedIn first comment"
    )
    parser.add_argument(
        "--link-attachment", help="Scheduler override: LinkedIn link attachment"
    )

    args = parser.parse_args()
    scheduler_overrides = build_scheduler_overrides(args)

    success = run_workflow(
        args.workflow,
        args.input,
        args.output,
        args.skip_optional,
        args.device,
        not args.no_archive,
        scheduler_overrides,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
