#!/usr/bin/env python3
"""
pixabay.py — Search and download images and short videos from Pixabay.

All content is royalty-free under the Pixabay Content License (no attribution required).

Requires:
    export PIXABAY_API_KEY=your_key   # https://pixabay.com/api/docs/

Usage:
    cd skills/sticker

    # List matching images
    uv run python scripts/pixabay.py images --query "sparkle transparent" --list

    # Download first matching image to assets/images/
    uv run python scripts/pixabay.py images --query "heart love" --name heart_bg

    # Transparent images only (great for overlays)
    uv run python scripts/pixabay.py images --query "confetti" --transparent --name confetti_img

    # Add image directly to local sticker library (usable as local:<name>)
    uv run python scripts/pixabay.py images --query "fire flames" --name fire_img --add-to-library

    # List short videos (≤5s)
    uv run python scripts/pixabay.py videos --query "confetti celebration" --max-duration 5 --list

    # Download first matching short video to assets/videos/
    uv run python scripts/pixabay.py videos --query "confetti" --max-duration 5 --name confetti_clip
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from assets import _download_file, library_add  # type: ignore[import]

SKILL_DIR = Path(__file__).parent.parent
IMAGES_DIR = SKILL_DIR / "assets" / "images"
VIDEOS_DIR = SKILL_DIR / "assets" / "videos"
BASE_URL = "https://pixabay.com/api"


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------


def _api_key() -> str:
    key = os.environ.get("PIXABAY_API_KEY", "")
    if not key:
        raise ValueError(
            "PIXABAY_API_KEY is not set. "
            "Register at https://pixabay.com/api/docs/ "
            "then: export PIXABAY_API_KEY=your_key"
        )
    return key


def _search_images(
    query: str,
    limit: int = 5,
    transparent: bool = False,
    image_type: str = "all",
) -> list[dict]:
    import requests

    params: dict = {
        "key": _api_key(),
        "q": query,
        "per_page": min(limit * 3, 50),
        "safesearch": "true",
        "order": "popular",
    }
    if image_type != "all":
        params["image_type"] = image_type
    if transparent:
        params["colors"] = "transparent"

    resp = requests.get(f"{BASE_URL}/", params=params, timeout=15)
    resp.raise_for_status()
    return resp.json().get("hits", [])[:limit]


def _search_videos(
    query: str,
    limit: int = 5,
    max_duration: int = 5,
    video_type: str = "all",
) -> list[dict]:
    import requests

    # Fetch extra results to allow for duration filtering
    params: dict = {
        "key": _api_key(),
        "q": query,
        "per_page": min(max(limit * 6, 30), 100),
        "safesearch": "true",
        "order": "popular",
    }
    if video_type != "all":
        params["video_type"] = video_type

    resp = requests.get(f"{BASE_URL}/videos/", params=params, timeout=15)
    resp.raise_for_status()
    hits = resp.json().get("hits", [])
    filtered = [h for h in hits if h.get("duration", 9999) <= max_duration]
    return filtered[:limit]


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------


def _print_images(hits: list[dict]) -> None:
    if not hits:
        print("No results.")
        return
    print(f"{'#':<3} {'ID':<10} {'W×H':<14} {'Tags'}")
    print("-" * 72)
    for i, h in enumerate(hits, 1):
        dims = f"{h['imageWidth']}×{h['imageHeight']}"
        tags = h.get("tags", "")[:45]
        print(f"{i:<3} {h['id']:<10} {dims:<14} {tags}")


def _print_videos(hits: list[dict]) -> None:
    if not hits:
        print("No results within duration limit.")
        return
    print(f"{'#':<3} {'ID':<10} {'Dur':>5}s  {'W×H':<14} {'Tags'}")
    print("-" * 72)
    for i, h in enumerate(hits, 1):
        med = h["videos"].get("small") or h["videos"].get("tiny", {})
        dims = f"{med.get('width', '?')}×{med.get('height', '?')}"
        tags = h.get("tags", "")[:40]
        print(f"{i:<3} {h['id']:<10} {h['duration']:>5}s  {dims:<14} {tags}")


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------


def _download_image(hit: dict, dest: Path) -> Path:
    url = hit.get("webformatURL") or hit.get("largeImageURL")
    if not url:
        raise ValueError(f"No download URL for image {hit['id']}")
    ext = Path(url.split("?")[0]).suffix or ".jpg"
    dest.parent.mkdir(parents=True, exist_ok=True)
    return _download_file(url, dest.with_suffix(ext))


def _download_video(hit: dict, dest: Path) -> Path:
    vids = hit["videos"]
    rendition = vids.get("small") or vids.get("tiny") or vids.get("medium")
    if not rendition or not rendition.get("url"):
        raise ValueError(f"No downloadable rendition for video {hit['id']}")
    url = rendition["url"] + "?download=1"
    dest.parent.mkdir(parents=True, exist_ok=True)
    return _download_file(url, dest.with_suffix(".mp4"))


# ---------------------------------------------------------------------------
# Subcommand handlers
# ---------------------------------------------------------------------------


def cmd_images(args: argparse.Namespace) -> None:
    try:
        hits = _search_images(
            query=args.query,
            limit=args.limit,
            transparent=args.transparent,
            image_type=args.image_type,
        )
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    if args.list or not args.name:
        _print_images(hits)
        if not args.name:
            return

    if not hits:
        print("No results — nothing downloaded.", file=sys.stderr)
        sys.exit(1)

    pick = hits[int(args.pick) - 1] if args.pick else hits[0]
    name = args.name or str(pick["id"])
    dest = IMAGES_DIR / name

    print(f"Downloading image {pick['id']}  ({pick.get('tags', '')[:40]})...")
    path = _download_image(pick, dest)
    print(f"  ✓  {path}")

    if args.add_to_library:
        lib_path = library_add(name, path, SKILL_DIR, kind="gif")
        print(f"  → library: local:{name}  ({lib_path})")


def cmd_videos(args: argparse.Namespace) -> None:
    try:
        hits = _search_videos(
            query=args.query,
            limit=args.limit,
            max_duration=args.max_duration,
            video_type=args.video_type,
        )
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    if args.list or not args.name:
        _print_videos(hits)
        if not args.name:
            return

    if not hits:
        print(
            f"No results ≤{args.max_duration}s — nothing downloaded.", file=sys.stderr
        )
        sys.exit(1)

    pick = hits[int(args.pick) - 1] if args.pick else hits[0]
    name = args.name or str(pick["id"])
    dest = VIDEOS_DIR / name

    dur = pick["duration"]
    print(f"Downloading video {pick['id']}  ({dur}s  {pick.get('tags', '')[:40]})...")
    path = _download_video(pick, dest)
    print(f"  ✓  {path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Search and download Pixabay images and videos"
    )
    sub = parser.add_subparsers(dest="cmd", metavar="{images,videos}")

    # -- images ---------------------------------------------------------------
    p_img = sub.add_parser("images", help="Search and download Pixabay images")
    p_img.add_argument("--query", "-q", required=True, help="Search term")
    p_img.add_argument(
        "--limit", "-n", type=int, default=5, help="Max results (default 5)"
    )
    p_img.add_argument("--name", help="Save as this name (stem, no extension)")
    p_img.add_argument("--pick", metavar="N", help="Download result #N instead of #1")
    p_img.add_argument(
        "--image-type",
        default="all",
        choices=["all", "photo", "illustration", "vector"],
    )
    p_img.add_argument(
        "--transparent",
        action="store_true",
        help="Only images with transparent background",
    )
    p_img.add_argument(
        "--list", action="store_true", help="List results without downloading"
    )
    p_img.add_argument(
        "--add-to-library",
        action="store_true",
        help="Also copy to assets/gifs/library/ so it can be used as local:<name>",
    )

    # -- videos ---------------------------------------------------------------
    p_vid = sub.add_parser("videos", help="Search and download short Pixabay videos")
    p_vid.add_argument("--query", "-q", required=True, help="Search term")
    p_vid.add_argument(
        "--limit", "-n", type=int, default=5, help="Max results (default 5)"
    )
    p_vid.add_argument("--name", help="Save as this name (stem, no extension)")
    p_vid.add_argument("--pick", metavar="N", help="Download result #N instead of #1")
    p_vid.add_argument(
        "--max-duration",
        type=int,
        default=5,
        metavar="SECS",
        help="Maximum video duration in seconds (default 5)",
    )
    p_vid.add_argument(
        "--video-type", default="all", choices=["all", "film", "animation"]
    )
    p_vid.add_argument(
        "--list", action="store_true", help="List results without downloading"
    )

    args = parser.parse_args()

    if args.cmd == "images":
        cmd_images(args)
    elif args.cmd == "videos":
        cmd_videos(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
