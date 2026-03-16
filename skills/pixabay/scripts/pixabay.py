"""pixabay.py — Main CLI for the pixabay skill."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

_SCRIPTS_DIR = Path(__file__).parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from assets import resolve_overlay, resolve_sfx  # type: ignore  # noqa: E402
from ffmpeg_utils import (  # type: ignore  # noqa: E402
    Effect,
    OverlaySpec,
    SfxSpec,
    build_overlay_command,
    build_pause_command,
    mix_sfx_into_audio,
    probe_video,
)
from timeline import resolve_text_cue  # type: ignore[import]  # noqa: E402

SKILL_DIR = Path(__file__).parent.parent
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm"}


def load_config(path: Path) -> dict:
    with path.open() as f:
        return json.load(f)


def validate_config(cfg: dict) -> dict:
    errors: list[str] = []
    effects = cfg.get("effects", [])
    if not isinstance(effects, list):
        errors.append("'effects' must be a list")
    else:
        for i, eff in enumerate(effects):
            if not isinstance(eff, dict):
                errors.append(f"effects[{i}] must be a dict")
                continue
            trigger = eff.get("trigger")
            if trigger is None:
                errors.append(f"effects[{i}] is missing 'trigger'")
            elif not isinstance(trigger, dict):
                errors.append(f"effects[{i}].trigger must be a dict")
            else:
                ttype = trigger.get("type")
                if ttype not in ("timestamp", "text_cue"):
                    errors.append(
                        f"effects[{i}].trigger.type must be 'timestamp' or 'text_cue', "
                        f"got: {ttype!r}"
                    )
                if ttype == "timestamp" and "value" not in trigger:
                    errors.append(
                        f"effects[{i}].trigger.value required for timestamp type"
                    )
                if ttype == "text_cue" and "phrase" not in trigger:
                    errors.append(
                        f"effects[{i}].trigger.phrase required for text_cue type"
                    )
            # overlay and sfx are both optional (e.g. pause-only effects)

    if errors:
        print("Config errors:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    return cfg


def load_presets(skill_dir: Path) -> dict:
    presets_path = skill_dir / "presets.json"
    if presets_path.exists():
        with presets_path.open() as f:
            return json.load(f)
    return {}


def apply_preset(effect_cfg: dict, presets: dict) -> dict:
    preset_name = effect_cfg.get("preset")
    if not preset_name or preset_name not in presets:
        return effect_cfg

    preset = presets[preset_name]
    merged: dict = {}

    for key, preset_val in preset.items():
        if key in effect_cfg:
            eff_val = effect_cfg[key]
            if isinstance(preset_val, dict) and isinstance(eff_val, dict):
                merged[key] = {**preset_val, **eff_val}
            else:
                merged[key] = eff_val
        else:
            merged[key] = preset_val

    for key, val in effect_cfg.items():
        if key not in merged:
            merged[key] = val

    return merged


def resolve_trigger(trigger_cfg: dict, skill_dir: Path) -> float:
    ttype = trigger_cfg.get("type")
    if ttype == "timestamp":
        return float(trigger_cfg["value"])
    if ttype == "text_cue":
        phrase = trigger_cfg["phrase"]
        transcript_str = trigger_cfg.get("transcript")
        if not transcript_str:
            print(
                "Error: text_cue trigger requires a 'transcript' path "
                "(output from the verbatim skill).",
                file=sys.stderr,
            )
            sys.exit(1)
        transcript_path = Path(transcript_str)
        if not transcript_path.is_absolute():
            transcript_path = skill_dir / transcript_path
        return resolve_text_cue(phrase, transcript_path)
    raise ValueError(f"Unknown trigger type: {ttype!r}")


def _parse_overlay_spec(overlay_cfg: dict) -> OverlaySpec:
    return OverlaySpec(
        source=overlay_cfg["source"],
        mode=overlay_cfg.get("mode", "positioned"),
        position=overlay_cfg.get("position", "top-right"),
        x=overlay_cfg.get("x"),
        y=overlay_cfg.get("y"),
        width=int(overlay_cfg.get("width", 200)),
    )


def _parse_sfx_spec(sfx_cfg: dict) -> SfxSpec:
    return SfxSpec(
        source=sfx_cfg["source"],
        at=float(sfx_cfg.get("at", 0.0)),
        volume=float(sfx_cfg.get("volume", 1.0)),
    )


def process_video(
    video_path: Path,
    config: dict,
    skill_dir: Path,
    presets: dict,
    favourites_path: Path,
    output_dir: Path,
    tmp_dir: Path,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / video_path.name
    duck = bool(config.get("duck_background", True))
    duck_db = float(config.get("duck_db", -10.0))

    effects: list[Effect] = []
    resolved_overlays: dict[int, Path] = {}
    resolved_sfx_map: dict[int, Path] = {}

    for i, eff_cfg in enumerate(config.get("effects", [])):
        eff_cfg = apply_preset(eff_cfg, presets)
        try:
            trigger_time = resolve_trigger(eff_cfg["trigger"], skill_dir)
        except ValueError as exc:
            print(
                f"  Warning: could not resolve trigger for effect {i}: {exc}",
                file=sys.stderr,
            )
            continue

        overlay_spec: Optional[OverlaySpec] = None
        sfx_spec: Optional[SfxSpec] = None

        if "overlay" in eff_cfg:
            parsed_overlay = _parse_overlay_spec(eff_cfg["overlay"])
            overlay_source = parsed_overlay.source
            try:
                resolved_overlays[i] = resolve_overlay(
                    overlay_source, skill_dir, favourites_path
                )
                overlay_spec = parsed_overlay
            except (FileNotFoundError, ValueError) as exc:
                print(
                    f"  Warning: cannot resolve overlay '{overlay_source}': {exc}",
                    file=sys.stderr,
                )
                overlay_spec = None

        if "sfx" in eff_cfg:
            parsed_sfx = _parse_sfx_spec(eff_cfg["sfx"])
            sfx_source = parsed_sfx.source
            try:
                resolved_sfx_map[i] = resolve_sfx(
                    sfx_source, skill_dir, favourites_path
                )
                sfx_spec = parsed_sfx
            except (FileNotFoundError, ValueError) as exc:
                print(
                    f"  Warning: cannot resolve sfx '{sfx_source}': {exc}",
                    file=sys.stderr,
                )
                sfx_spec = None

        effects.append(
            Effect(
                trigger_time=trigger_time,
                overlay=overlay_spec,
                sfx=sfx_spec,
                pause_video=bool(eff_cfg.get("pause_video", False)),
                duration=float(eff_cfg.get("duration", 3.0)),
            )
        )

    video_info = probe_video(video_path)
    current_input = video_path

    pause_effects = [(i, e) for i, e in enumerate(effects) if e.pause_video]
    for idx, (eff_i, effect) in enumerate(pause_effects):
        pause_tmp = tmp_dir / f"pause_{idx}"
        pause_tmp.mkdir(parents=True, exist_ok=True)
        pause_out = tmp_dir / f"after_pause_{idx}.mp4"
        cmds = build_pause_command(
            input_path=current_input,
            output_path=pause_out,
            effect=effect,
            resolved_overlay=resolved_overlays.get(eff_i),
            overlay_spec=effect.overlay,
            resolved_sfx=resolved_sfx_map.get(eff_i),
            video_width=video_info["width"],
            video_height=video_info["height"],
            fps=video_info["fps"],
            tmp_dir=pause_tmp,
            has_audio=video_info["has_audio"],
        )
        for cmd in cmds:
            subprocess.run(cmd, check=True)
        current_input = pause_out

    overlay_effects = [(i, e) for i, e in enumerate(effects) if not e.pause_video]

    if overlay_effects:
        mixed_audio: Optional[Path] = None
        sfx_pairs = [
            (i, e)
            for i, e in overlay_effects
            if e.sfx is not None and i in resolved_sfx_map
        ]
        if sfx_pairs and video_info["has_audio"]:
            audio_path = tmp_dir / "mixed_audio.wav"
            first_i, first_e = sfx_pairs[0]
            sfx_at = first_e.trigger_time + (first_e.sfx.at if first_e.sfx else 0.0)
            mix_sfx_into_audio(
                video_path=current_input,
                sfx_path=resolved_sfx_map[first_i],
                sfx_at_seconds=sfx_at,
                sfx_volume=first_e.sfx.volume if first_e.sfx else 1.0,
                output_audio_path=audio_path,
                duck_background=duck,
                duck_db=duck_db,
            )
            for extra_i, extra_e in sfx_pairs[1:]:
                merged_path = tmp_dir / f"mixed_audio_{extra_i}.wav"
                extra_at = extra_e.trigger_time + (
                    extra_e.sfx.at if extra_e.sfx else 0.0
                )
                mix_sfx_into_audio(
                    video_path=audio_path,
                    sfx_path=resolved_sfx_map[extra_i],
                    sfx_at_seconds=extra_at,
                    sfx_volume=extra_e.sfx.volume if extra_e.sfx else 1.0,
                    output_audio_path=merged_path,
                    duck_background=duck,
                    duck_db=duck_db,
                )
                audio_path = merged_path
            mixed_audio = audio_path

        overlay_resolved: dict[int, Path] = {}
        overlay_effect_list: list[Effect] = []
        for new_i, (orig_i, eff) in enumerate(overlay_effects):
            overlay_effect_list.append(eff)
            if orig_i in resolved_overlays:
                overlay_resolved[new_i] = resolved_overlays[orig_i]

        overlay_out = tmp_dir / "overlaid.mp4"
        cmd = build_overlay_command(
            input_path=current_input,
            output_path=overlay_out,
            effects=overlay_effect_list,
            resolved_overlays=overlay_resolved,
            mixed_audio_path=mixed_audio,
            duck_background=duck,
            duck_db=duck_db,
        )
        subprocess.run(cmd, check=True)
        current_input = overlay_out

    shutil.copy2(str(current_input), str(out_path))
    print(f"  -> {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="pixabay — Add Pixabay overlays and sound effects to videos"
    )
    parser.add_argument("--config", default="config.json", help="Path to config.json")
    parser.add_argument("--input", help="Override input_dir from config")
    parser.add_argument("--output", help="Override output_dir from config")
    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.is_absolute():
        config_path = SKILL_DIR / config_path
    if not config_path.exists():
        print(f"Error: config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    cfg = validate_config(load_config(config_path))
    if args.input:
        cfg["input_dir"] = args.input
    if args.output:
        cfg["output_dir"] = args.output

    input_dir = Path(cfg.get("input_dir", "./input"))
    if not input_dir.is_absolute():
        input_dir = SKILL_DIR / input_dir
    output_dir = Path(cfg.get("output_dir", "./output"))
    if not output_dir.is_absolute():
        output_dir = SKILL_DIR / output_dir

    if not input_dir.exists():
        print(f"Error: input directory not found: {input_dir}", file=sys.stderr)
        sys.exit(1)

    videos = sorted(
        p
        for p in input_dir.iterdir()
        if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS
    )
    if not videos:
        print(f"No video files found in {input_dir}")
        sys.exit(0)

    presets = load_presets(SKILL_DIR)
    favourites_path = SKILL_DIR / "favourites.json"
    succeeded = 0
    failed: list[str] = []

    with tempfile.TemporaryDirectory(prefix="pixabay_") as tmp_str:
        tmp = Path(tmp_str)
        for video_path in videos:
            print(f"Processing {video_path.name}...")
            video_tmp = tmp / video_path.stem
            video_tmp.mkdir(parents=True, exist_ok=True)
            try:
                process_video(
                    video_path=video_path,
                    config=cfg,
                    skill_dir=SKILL_DIR,
                    presets=presets,
                    favourites_path=favourites_path,
                    output_dir=output_dir,
                    tmp_dir=video_tmp,
                )
                succeeded += 1
            except Exception as exc:
                print(f"  x {video_path.name}: {exc}", file=sys.stderr)
                failed.append(video_path.name)

    total = len(videos)
    print(f"\nDone: {succeeded}/{total} succeeded")
    if failed:
        print("Failed:")
        for name in failed:
            print(f"  - {name}")
        sys.exit(1)


if __name__ == "__main__":
    main()
