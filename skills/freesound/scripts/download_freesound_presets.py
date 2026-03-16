#!/usr/bin/env python3
"""
download_freesound_presets.py — Download real SFX recordings from Freesound
for all bundled preset names and save them to assets/sfx/.

Searches the Freesound API for CC-licensed sounds matching each preset query,
downloads the high-quality MP3 preview, and saves it to assets/sfx/<name>.mp3.
Skips names that already have any supported audio file (idempotent).

Prerequisites:
    export FREESOUND_API_KEY=your_key   # https://freesound.org/apiv2/apply/
    cd skills/freesound && uv sync

Usage:
    cd skills/freesound
    uv run python scripts/download_freesound_presets.py

    # Force re-download even if files already exist:
    uv run python scripts/download_freesound_presets.py --force
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
import assets as _asset_helpers  # type: ignore[import]

asset_helpers: Any = _asset_helpers

SKILL_DIR = Path(__file__).parent.parent
SFX_DIR = SKILL_DIR / "assets" / "sfx"


def _freesound_api_key() -> str:
    key = os.environ.get("FREESOUND_API_KEY", "")
    if not key:
        raise ValueError(
            "FREESOUND_API_KEY is not set. "
            "Register at https://freesound.org/apiv2/apply/ "
            "then: export FREESOUND_API_KEY=your_key"
        )
    return key


def _search_freesound_url(query: str, api_key: str) -> str | None:
    import requests

    resp = requests.get(
        "https://freesound.org/apiv2/search/text/",
        params={
            "query": query,
            "token": api_key,
            "filter": 'duration:[0.05 TO 3] license:"Creative Commons 0"',
            "fields": "id,name,previews,duration",
            "page_size": 1,
            "sort": "score",
        },
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [])
    if not results:
        return None
    return results[0]["previews"]["preview-hq-mp3"]


def _already_exists(name: str) -> bool:
    stem = SFX_DIR / name
    return any(
        (stem.parent / f"{stem.name}{ext}").exists()
        for ext in asset_helpers.LIBRARY_AUDIO_EXTENSIONS
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download Freesound SFX for bundled presets"
    )
    parser.add_argument(
        "--force", action="store_true", help="Re-download even if file exists"
    )
    args = parser.parse_args()

    try:
        api_key = _freesound_api_key()
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    SFX_DIR.mkdir(parents=True, exist_ok=True)
    succeeded = 0
    skipped = 0
    failed: list[str] = []

    for name, query in asset_helpers.FREESOUND_PRESET_QUERIES.items():
        if _already_exists(name) and not args.force:
            print(f"  (exists) {name}")
            skipped += 1
            continue

        print(f"  ↓ {name}  ({query!r})...", end=" ", flush=True)
        url = _search_freesound_url(query, api_key)
        if url is None:
            print("no results")
            failed.append(name)
            continue

        dest = SFX_DIR / f"{name}.mp3"
        try:
            asset_helpers._download_file(url, dest)
            print(f"✓  →  {dest.name}")
            succeeded += 1
        except Exception as exc:
            print(f"✗  {exc}")
            failed.append(name)

    print(f"\nDone: {succeeded} downloaded, {skipped} skipped, {len(failed)} failed")
    if failed:
        print(f"Failed: {', '.join(failed)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
