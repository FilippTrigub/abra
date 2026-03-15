#!/usr/bin/env python3
"""
download_giphy_presets.py — Replace generated placeholder stickers with real GIPHY stickers.

Fetches one sticker per bundled preset name from the GIPHY Stickers API
(transparent background, fixed_width rendition) and saves them to assets/gifs/.
Existing files are skipped (idempotent — safe to re-run).

Prerequisites:
    export GIPHY_API_KEY=your_key   # https://developers.giphy.com/dashboard/
    cd skills/sticker && uv sync

Usage:
    cd skills/sticker
    uv run python scripts/download_giphy_presets.py

    # Force re-download even if files already exist:
    uv run python scripts/download_giphy_presets.py --force
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from assets import (  # type: ignore[import]
    BUNDLED_GIFS,
    GIPHY_PRESET_QUERIES,
    _giphy_api_key,
    _search_giphy_sticker,
    _download_file,
)

SKILL_DIR = Path(__file__).parent.parent


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download GIPHY stickers for bundled presets"
    )
    parser.add_argument(
        "--force", action="store_true", help="Re-download even if file exists"
    )
    args = parser.parse_args()

    try:
        _giphy_api_key()
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    succeeded = 0
    skipped = 0
    failed: list[str] = []

    for name, query in GIPHY_PRESET_QUERIES.items():
        dest = SKILL_DIR / BUNDLED_GIFS[name]
        if dest.exists() and not args.force:
            print(f"  (exists) {name}")
            skipped += 1
            continue
        print(f"  ↓ {name}  ({query!r})...", end=" ", flush=True)
        url = _search_giphy_sticker(query)
        if url is None:
            print(f"no results")
            failed.append(name)
            continue
        try:
            _download_file(url, dest)
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
