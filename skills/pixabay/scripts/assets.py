"""assets.py — Asset resolution and favourites management for the pixabay skill."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Optional

LIBRARY_OVERLAY_DIR = "assets/images/library"
LIBRARY_VIDEO_DIR = "assets/videos/library"
LIBRARY_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp", ".gif")
LIBRARY_VIDEO_EXTENSIONS = (".mp4", ".webm", ".mov", ".avi")

LIBRARY_SFX_DIR = "assets/sfx/library"
LIBRARY_AUDIO_EXTENSIONS = (".mp3", ".wav", ".ogg", ".flac", ".aac")

BUNDLED_SFX: dict[str, str] = {
    "pop": "assets/sfx/pop",
    "whoosh": "assets/sfx/whoosh",
    "chime": "assets/sfx/chime",
    "applause": "assets/sfx/applause",
    "bass_drop": "assets/sfx/bass_drop",
    "ding": "assets/sfx/ding",
    "swoosh": "assets/sfx/swoosh",
    "clap": "assets/sfx/clap",
}


def load_favourites(path: Path) -> dict:
    if not path.exists():
        return {"overlays": [], "sfx": []}
    try:
        with path.open() as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"overlays": [], "sfx": []}
        data.setdefault("overlays", [])
        data.setdefault("sfx", [])
        return data
    except (json.JSONDecodeError, OSError):
        return {"overlays": [], "sfx": []}


def save_favourites(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".json.tmp")
    with tmp_path.open("w") as f:
        json.dump(data, f, indent=2)
    tmp_path.replace(path)


def list_favourites(favourites_path: Path) -> dict:
    return load_favourites(favourites_path)


def get_favourite(name: str, kind: str, favourites_path: Path) -> Optional[dict]:
    data = load_favourites(favourites_path)
    key = "overlays" if kind == "overlay" else "sfx"
    for entry in data.get(key, []):
        if entry.get("name") == name:
            return entry
    return None


def add_favourite_overlay(
    name: str,
    source: str,
    tags: list[str],
    favourites_path: Path,
) -> None:
    data = load_favourites(favourites_path)
    entry = {"name": name, "source": source, "tags": tags}
    data["overlays"] = [e for e in data["overlays"] if e.get("name") != name]
    data["overlays"].append(entry)
    save_favourites(data, favourites_path)


def add_favourite_sfx(
    name: str,
    source: str,
    tags: list[str],
    favourites_path: Path,
) -> None:
    data = load_favourites(favourites_path)
    entry = {"name": name, "source": source, "tags": tags}
    data["sfx"] = [e for e in data["sfx"] if e.get("name") != name]
    data["sfx"].append(entry)
    save_favourites(data, favourites_path)


def remove_favourite(name: str, kind: str, favourites_path: Path) -> bool:
    data = load_favourites(favourites_path)
    key = "overlays" if kind == "overlay" else "sfx"
    before = len(data.get(key, []))
    data[key] = [e for e in data.get(key, []) if e.get("name") != name]
    removed = len(data[key]) < before
    if removed:
        save_favourites(data, favourites_path)
    return removed


def _download_file(url: str, dest: Path) -> Path:
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=30) as resp:
        resp.raise_for_status()
        with dest.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
    return dest


def _pixabay_api_key() -> str:
    key = os.environ.get("PIXABAY_API_KEY", "")
    if not key:
        raise ValueError(
            "PIXABAY_API_KEY is not set. "
            "Register at https://pixabay.com/api/docs/ "
            "then: export PIXABAY_API_KEY=your_key"
        )
    return key


def _search_and_cache_pixabay_image(query: str, skill_dir: Path) -> Path:
    import requests

    cache_dir = skill_dir / "assets" / "images" / "cache"
    cache_key = hashlib.md5(query.encode()).hexdigest()[:8]
    for ext in LIBRARY_IMAGE_EXTENSIONS:
        cached = cache_dir / f"pixabay_{cache_key}{ext}"
        if cached.exists():
            return cached

    resp = requests.get(
        "https://pixabay.com/api/",
        params={
            "key": _pixabay_api_key(),
            "q": query,
            "per_page": 3,
            "safesearch": "true",
            "order": "popular",
        },
        timeout=15,
    )
    resp.raise_for_status()
    hits = resp.json().get("hits", [])
    if not hits:
        raise ValueError(f"Pixabay returned no image results for: '{query}'")
    hit = hits[0]
    url = hit.get("webformatURL") or hit.get("largeImageURL")
    if not url:
        raise ValueError(f"Pixabay image {hit['id']} has no download URL")
    ext = Path(url.split("?")[0]).suffix or ".jpg"
    dest = cache_dir / f"pixabay_{cache_key}{ext}"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return _download_file(url, dest)


def _search_and_cache_pixabay_video(query: str, skill_dir: Path) -> Path:
    import requests

    cache_dir = skill_dir / "assets" / "videos" / "cache"
    cache_key = hashlib.md5(query.encode()).hexdigest()[:8]
    cached = cache_dir / f"pixabay_{cache_key}.mp4"
    if cached.exists():
        return cached

    resp = requests.get(
        "https://pixabay.com/api/videos/",
        params={
            "key": _pixabay_api_key(),
            "q": query,
            "per_page": 10,
            "safesearch": "true",
            "order": "popular",
        },
        timeout=15,
    )
    resp.raise_for_status()
    hits = resp.json().get("hits", [])
    short = [h for h in hits if h.get("duration", 999) <= 5]
    hit = (short or hits)[0] if (short or hits) else None
    if not hit:
        raise ValueError(f"Pixabay returned no video results for: '{query}'")
    vids = hit["videos"]
    rendition = vids.get("small") or vids.get("tiny") or vids.get("medium")
    if not rendition or not rendition.get("url"):
        raise ValueError(
            f"No downloadable video rendition for Pixabay video {hit['id']}"
        )
    url = rendition["url"] + "?download=1"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return _download_file(url, cached)


def _library_dir(skill_dir: Path, kind: str) -> Path:
    if kind == "image":
        return skill_dir / LIBRARY_OVERLAY_DIR
    if kind == "video":
        return skill_dir / LIBRARY_VIDEO_DIR
    return skill_dir / LIBRARY_SFX_DIR


def _library_extensions(kind: str) -> tuple[str, ...]:
    if kind == "image":
        return LIBRARY_IMAGE_EXTENSIONS
    if kind == "video":
        return LIBRARY_VIDEO_EXTENSIONS
    return LIBRARY_AUDIO_EXTENSIONS


def library_list(skill_dir: Path, kind: str) -> list[tuple[str, Path]]:
    base_dir = _library_dir(skill_dir, kind)
    if not base_dir.exists():
        return []
    exts = _library_extensions(kind)
    return sorted(
        (p.stem, p)
        for p in base_dir.iterdir()
        if p.is_file() and p.suffix.lower() in exts
    )


def library_resolve(name: str, skill_dir: Path, kind: str) -> Path:
    base_dir = _library_dir(skill_dir, kind)
    exts = _library_extensions(kind)
    for ext in exts:
        p = base_dir / f"{name}{ext}"
        if p.exists():
            return p
    available = ", ".join(n for n, _ in library_list(skill_dir, kind)) or "(empty)"
    raise FileNotFoundError(
        f"Local {kind} '{name}' not found in library. Available: {available}."
    )


def library_add(name: str, source_path: Path, skill_dir: Path, kind: str) -> Path:
    src = Path(source_path)
    if not src.exists():
        raise FileNotFoundError(f"Source file not found: {src}")
    exts = _library_extensions(kind)
    ext = src.suffix.lower()
    if ext not in exts:
        raise ValueError(
            f"Unsupported format '{src.suffix}'. Supported: {', '.join(exts)}"
        )
    dest_dir = _library_dir(skill_dir, kind)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{name}{ext}"
    shutil.copy2(str(src), str(dest))
    return dest


def library_remove(name: str, skill_dir: Path, kind: str) -> bool:
    base_dir = _library_dir(skill_dir, kind)
    for ext in _library_extensions(kind):
        p = base_dir / f"{name}{ext}"
        if p.exists():
            p.unlink()
            return True
    return False


def library_import_dir(source_dir: Path, skill_dir: Path, kind: str) -> list[str]:
    src = Path(source_dir)
    if not src.exists():
        raise FileNotFoundError(f"Source directory not found: {src}")
    imported: list[str] = []
    exts = _library_extensions(kind)
    for p in sorted(src.iterdir()):
        if p.is_file() and p.suffix.lower() in exts:
            library_add(p.stem, p, skill_dir, kind)
            imported.append(p.stem)
    return imported


def resolve_overlay(source: str, skill_dir: Path, favourites_path: Path) -> Path:
    if source.startswith("pixabay:"):
        query = source[len("pixabay:") :]
        return _search_and_cache_pixabay_image(query, skill_dir)

    if source.startswith("pixabay-video:"):
        query = source[len("pixabay-video:") :]
        return _search_and_cache_pixabay_video(query, skill_dir)

    if source.startswith("local:"):
        name = source[len("local:") :]
        try:
            return library_resolve(name, skill_dir, kind="image")
        except FileNotFoundError:
            return library_resolve(name, skill_dir, kind="video")

    if source.startswith("favourite:"):
        name = source[len("favourite:") :]
        entry = get_favourite(name, "overlay", favourites_path)
        if entry is None:
            raise ValueError(f"Favourite overlay '{name}' not found in favourites.json")
        return resolve_overlay(entry["source"], skill_dir, favourites_path)

    if ":" in source:
        prefix = source.split(":", 1)[0]
        if prefix in {"giphy", "bundled", "freesound"}:
            raise ValueError(
                f"{prefix}: is not supported in pixabay overlays. Use pixabay:, "
                "pixabay-video:, local:, favourite:, or a file path."
            )

    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"Overlay file not found: {path}")
    return path


def resolve_sfx(source: str, skill_dir: Path, favourites_path: Path) -> Path:
    if source.startswith("bundled:"):
        name = source[len("bundled:") :]
        if name not in BUNDLED_SFX:
            raise ValueError(
                f"Unknown bundled sfx '{name}'. Available: {', '.join(BUNDLED_SFX)}"
            )
        stem = skill_dir / BUNDLED_SFX[name]
        for ext in LIBRARY_AUDIO_EXTENSIONS:
            p = stem.parent / f"{stem.name}{ext}"
            if p.exists():
                return p
        raise FileNotFoundError(
            f"Bundled sfx '{name}' not found under {stem.parent}. Add a matching file."
        )

    if source.startswith("local:"):
        name = source[len("local:") :]
        return library_resolve(name, skill_dir, kind="sfx")

    if source.startswith("favourite:"):
        name = source[len("favourite:") :]
        entry = get_favourite(name, "sfx", favourites_path)
        if entry is None:
            raise ValueError(f"Favourite sfx '{name}' not found in favourites.json")
        return resolve_sfx(entry["source"], skill_dir, favourites_path)

    if source.startswith("freesound:"):
        raise ValueError(
            "freesound: requires the skills/freesound skill. Use local: or a file path."
        )

    if source.startswith("giphy:") or source.startswith("pixabay:"):
        raise ValueError(
            "SFX source must be bundled:, local:, favourite:, or a file path."
        )

    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"SFX file not found: {path}")
    return path


def _cli_list(favourites_path: Path) -> None:
    data = list_favourites(favourites_path)
    overlays = data.get("overlays", [])
    sfx = data.get("sfx", [])
    print(f"Overlays ({len(overlays)}):")
    for entry in overlays:
        tags = ", ".join(entry.get("tags", []))
        print(f"  {entry['name']:20s}  {entry['source']}  [{tags}]")
    print(f"\nSFX ({len(sfx)}):")
    for entry in sfx:
        tags = ", ".join(entry.get("tags", []))
        print(f"  {entry['name']:20s}  {entry['source']}  [{tags}]")


def _cli_library(args: argparse.Namespace, skill_dir: Path) -> None:
    kind = getattr(args, "kind", "image")

    if args.library_cmd == "list":
        all_kinds = ["image", "video", "sfx"] if kind == "all" else [kind]
        for entry_kind in all_kinds:
            entries = library_list(skill_dir, entry_kind)
            print(f"{entry_kind.upper()} — {len(entries)} in library:")
            if entries:
                for name, path in entries:
                    size_kb = path.stat().st_size // 1024
                    print(f"  local:{name:<22s}  {path.name}  ({size_kb} KB)")
            else:
                print(
                    f"  (empty — drop files into {_library_dir(skill_dir, entry_kind)})"
                )

    elif args.library_cmd == "add":
        dest = library_add(args.name, Path(args.file), skill_dir, kind)
        print(f"Added [{kind}]: local:{args.name}  ->  {dest}")

    elif args.library_cmd == "remove":
        if library_remove(args.name, skill_dir, kind):
            print(f"Removed [{kind}]: local:{args.name}")
        else:
            print(f"Not found [{kind}]: local:{args.name}")
            sys.exit(1)

    elif args.library_cmd == "import-dir":
        imported = library_import_dir(Path(args.dir), skill_dir, kind)
        if imported:
            print(f"Imported {len(imported)} [{kind}]: {', '.join(imported)}")
        else:
            print("No supported files found in directory.")

    else:
        print("Usage: assets.py library {list|add|remove|import-dir}")


def main() -> None:
    skill_dir = Path(__file__).parent.parent
    favourites_path = skill_dir / "favourites.json"

    parser = argparse.ArgumentParser(description="Manage pixabay skill assets")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("list", help="List all favourites")

    p_lib = sub.add_parser(
        "library", help="Manage local library (local:name) for images/videos/sfx"
    )
    lib_sub = p_lib.add_subparsers(dest="library_cmd")
    p_lib_list = lib_sub.add_parser("list", help="List library contents")
    p_lib_list.add_argument(
        "--kind", default="all", choices=["image", "video", "sfx", "all"]
    )
    p_lib_add = lib_sub.add_parser("add", help="Add a file to the library")
    p_lib_add.add_argument("--name", required=True)
    p_lib_add.add_argument("--file", required=True)
    p_lib_add.add_argument("--kind", default="image", choices=["image", "video", "sfx"])
    p_lib_rm = lib_sub.add_parser("remove", help="Remove a file from the library")
    p_lib_rm.add_argument("--name", required=True)
    p_lib_rm.add_argument("--kind", default="image", choices=["image", "video", "sfx"])
    p_lib_imp = lib_sub.add_parser(
        "import-dir", help="Bulk import files from directory"
    )
    p_lib_imp.add_argument("--dir", required=True)
    p_lib_imp.add_argument("--kind", default="image", choices=["image", "video", "sfx"])

    p_add_overlay = sub.add_parser("add-overlay", help="Add an overlay favourite")
    p_add_overlay.add_argument("--name", required=True)
    p_add_overlay.add_argument("--source", required=True)
    p_add_overlay.add_argument("--tags", default="")

    p_add_sfx = sub.add_parser("add-sfx", help="Add an sfx favourite")
    p_add_sfx.add_argument("--name", required=True)
    p_add_sfx.add_argument("--source", required=True)
    p_add_sfx.add_argument("--tags", default="")

    p_remove = sub.add_parser("remove", help="Remove a favourite")
    p_remove.add_argument("--name", required=True)
    p_remove.add_argument("--kind", required=True, choices=["overlay", "sfx"])

    args = parser.parse_args()

    if args.cmd == "list":
        _cli_list(favourites_path)
    elif args.cmd == "library":
        _cli_library(args, skill_dir)
    elif args.cmd == "add-overlay":
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        add_favourite_overlay(args.name, args.source, tags, favourites_path)
        print(f"Added overlay favourite: {args.name} -> {args.source}")
    elif args.cmd == "add-sfx":
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        add_favourite_sfx(args.name, args.source, tags, favourites_path)
        print(f"Added sfx favourite: {args.name} -> {args.source}")
    elif args.cmd == "remove":
        removed = remove_favourite(args.name, args.kind, favourites_path)
        if removed:
            print(f"Removed {args.kind} favourite: {args.name}")
        else:
            print(f"Not found: {args.kind} '{args.name}'")
            sys.exit(1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
