"""assets.py — Asset resolution and favourites management for the freesound skill.

Handles bundled assets, Freesound API, and a persistent favourites store
(favourites.json).

CLI usage:
    python assets.py list
    python assets.py add-gif --name myname --source bundled:heart --tags love,reaction
    python assets.py add-sfx --name mysound --source bundled:pop --tags transition
    python assets.py remove --name myname --kind gif
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Bundled asset registries
# ---------------------------------------------------------------------------

BUNDLED_GIFS: dict[str, str] = {
    "heart": "assets/gifs/heart.gif",
    "sparkles": "assets/gifs/sparkles.gif",
    "confetti": "assets/gifs/confetti.gif",
    "fire": "assets/gifs/fire.gif",
    "stars": "assets/gifs/stars.gif",
    "thumbsup": "assets/gifs/thumbsup.gif",
    "crown": "assets/gifs/crown.gif",
    "explosion": "assets/gifs/explosion.gif",
}

LIBRARY_DIR = "assets/gifs/library"
LIBRARY_EXTENSIONS = (".gif", ".webp", ".png", ".apng")

LIBRARY_SFX_DIR = "assets/sfx/library"
LIBRARY_AUDIO_EXTENSIONS = (".mp3", ".wav", ".ogg", ".flac", ".aac")

# SFX stem paths without extension — resolved by trying each audio extension in order.
# Files are populated by download_freesound_presets.py (real recordings).
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

# Freesound search queries for each bundled SFX name.
# Used by download_freesound_presets.py to populate assets/sfx/ with real recordings.
FREESOUND_PRESET_QUERIES: dict[str, str] = {
    "pop": "pop snap interface",
    "whoosh": "whoosh swoosh transition",
    "chime": "bell ring short",
    "applause": "applause clapping crowd",
    "bass_drop": "bass drop impact boom",
    "ding": "ding bell notification",
    "swoosh": "swoosh fast movement",
    "clap": "single clap hands",
}

# ---------------------------------------------------------------------------
# Favourites persistence
# ---------------------------------------------------------------------------

_EMPTY_FAVOURITES: dict = {"gifs": [], "sfx": []}


def load_favourites(path: Path) -> dict:
    """Load favourites.json. Returns {'gifs': [], 'sfx': []} if missing or malformed."""
    if not path.exists():
        return {"gifs": [], "sfx": []}
    try:
        with path.open() as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"gifs": [], "sfx": []}
        data.setdefault("gifs", [])
        data.setdefault("sfx", [])
        return data
    except (json.JSONDecodeError, OSError):
        return {"gifs": [], "sfx": []}


def save_favourites(data: dict, path: Path) -> None:
    """Atomically write favourites.json (write to .tmp then rename)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".json.tmp")
    with tmp_path.open("w") as f:
        json.dump(data, f, indent=2)
    tmp_path.replace(path)


def list_favourites(favourites_path: Path) -> dict:
    """Return {'gifs': [...], 'sfx': [...]} from favourites.json."""
    return load_favourites(favourites_path)


def get_favourite(name: str, kind: str, favourites_path: Path) -> Optional[dict]:
    """Return the favourite entry dict or None if not found. kind: 'gif' | 'sfx'."""
    data = load_favourites(favourites_path)
    key = "gifs" if kind == "gif" else "sfx"
    for entry in data.get(key, []):
        if entry.get("name") == name:
            return entry
    return None


def add_favourite_gif(
    name: str, source: str, tags: list[str], favourites_path: Path
) -> None:
    """Add or update a gif entry in favourites.json."""
    data = load_favourites(favourites_path)
    entry = {"name": name, "source": source, "tags": tags}
    # Replace existing entry with same name
    data["gifs"] = [e for e in data["gifs"] if e.get("name") != name]
    data["gifs"].append(entry)
    save_favourites(data, favourites_path)


def add_favourite_sfx(
    name: str, source: str, tags: list[str], favourites_path: Path
) -> None:
    """Add or update a sfx entry in favourites.json."""
    data = load_favourites(favourites_path)
    entry = {"name": name, "source": source, "tags": tags}
    data["sfx"] = [e for e in data["sfx"] if e.get("name") != name]
    data["sfx"].append(entry)
    save_favourites(data, favourites_path)


def remove_favourite(name: str, kind: str, favourites_path: Path) -> bool:
    """Remove favourite by name and kind. Returns True if found and removed."""
    data = load_favourites(favourites_path)
    key = "gifs" if kind == "gif" else "sfx"
    before = len(data.get(key, []))
    data[key] = [e for e in data.get(key, []) if e.get("name") != name]
    removed = len(data[key]) < before
    if removed:
        save_favourites(data, favourites_path)
    return removed


# ---------------------------------------------------------------------------
# API helpers (Freesound)
# ---------------------------------------------------------------------------


def _cache_key(query: str) -> str:
    return hashlib.md5(query.encode()).hexdigest()[:8]


def _download_file(url: str, dest: Path) -> Path:
    """Stream-download url to dest. Returns dest."""
    import requests

    dest.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=30) as resp:
        resp.raise_for_status()
        with dest.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
    return dest


def _search_freesound(query: str) -> Optional[str]:
    """Search Freesound for a CC0 sound, return preview MP3 URL or None."""
    import requests

    api_key = os.environ.get("FREESOUND_API_KEY", "")
    if not api_key:
        raise ValueError(
            "FREESOUND_API_KEY environment variable is not set. "
            "Register at https://freesound.org/apiv2/apply/"
        )
    resp = requests.get(
        "https://freesound.org/apiv2/search/text/",
        params={
            "query": query,
            "token": api_key,
            "filter": 'license:"Creative Commons 0"',
            "fields": "id,name,previews",
            "page_size": 1,
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get("results"):
        return None
    return data["results"][0]["previews"]["preview-hq-mp3"]


# ---------------------------------------------------------------------------
# Local library
# ---------------------------------------------------------------------------


def library_dir(skill_dir: Path, kind: str = "gif") -> Path:
    return skill_dir / (LIBRARY_DIR if kind == "gif" else LIBRARY_SFX_DIR)


def _library_extensions(kind: str) -> tuple[str, ...]:
    return LIBRARY_EXTENSIONS if kind == "gif" else LIBRARY_AUDIO_EXTENSIONS


def library_list(skill_dir: Path, kind: str = "gif") -> list[tuple[str, Path]]:
    d = library_dir(skill_dir, kind)
    if not d.exists():
        return []
    return sorted(
        (p.stem, p)
        for p in d.iterdir()
        if p.is_file() and p.suffix.lower() in _library_extensions(kind)
    )


def library_resolve(name: str, skill_dir: Path, kind: str = "gif") -> Path:
    d = library_dir(skill_dir, kind)
    for ext in _library_extensions(kind):
        p = d / f"{name}{ext}"
        if p.exists():
            return p
    available = ", ".join(n for n, _ in library_list(skill_dir, kind)) or "(empty)"
    noun = "gif" if kind == "gif" else "sound"
    raise FileNotFoundError(
        f"Local {noun} '{name}' not found in library. "
        f"Available: {available}. "
        f"Add with: python scripts/assets.py library add --kind {kind} --name {name} --file <path>"
    )


def library_add(
    name: str, source_path: Path, skill_dir: Path, kind: str = "gif"
) -> Path:
    import shutil

    src = Path(source_path)
    if not src.exists():
        raise FileNotFoundError(f"Source file not found: {src}")
    exts = _library_extensions(kind)
    if src.suffix.lower() not in exts:
        raise ValueError(
            f"Unsupported format '{src.suffix}'. Supported: {', '.join(exts)}"
        )
    dest_dir = library_dir(skill_dir, kind)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{name}{src.suffix.lower()}"
    shutil.copy2(str(src), str(dest))
    return dest


def library_remove(name: str, skill_dir: Path, kind: str = "gif") -> bool:
    d = library_dir(skill_dir, kind)
    for ext in _library_extensions(kind):
        p = d / f"{name}{ext}"
        if p.exists():
            p.unlink()
            return True
    return False


def library_import_dir(
    source_dir: Path, skill_dir: Path, kind: str = "gif"
) -> list[str]:
    src = Path(source_dir)
    if not src.exists():
        raise FileNotFoundError(f"Source directory not found: {src}")
    exts = _library_extensions(kind)
    imported: list[str] = []
    for p in sorted(src.iterdir()):
        if p.is_file() and p.suffix.lower() in exts:
            library_add(p.stem, p, skill_dir, kind)
            imported.append(p.stem)
    return imported


# ---------------------------------------------------------------------------
# Asset resolution
# ---------------------------------------------------------------------------


def resolve_gif(source: str, skill_dir: Path, favourites_path: Path) -> Path:
    """
    Resolve a gif source string to a local Path.

    Patterns:
      "bundled:<name>"     → skill_dir/assets/gifs/<name>.gif
      "favourite:<name>"   → recursive resolve of that favourite's source
      "./path" / "/path"   → local file path (must exist)
    """
    if source.startswith("bundled:"):
        name = source[len("bundled:") :]
        if name not in BUNDLED_GIFS:
            raise ValueError(
                f"Unknown bundled gif '{name}'. Available: {', '.join(BUNDLED_GIFS)}"
            )
        path = skill_dir / BUNDLED_GIFS[name]
        if not path.exists():
            raise FileNotFoundError(
                f"Bundled gif not found: {path}. "
                "Run: cd skills/freesound && uv run python scripts/generate_bundled_assets.py"
            )
        return path

    if source.startswith("local:"):
        name = source[len("local:") :]
        return library_resolve(name, skill_dir)

    if source.startswith("favourite:"):
        name = source[len("favourite:") :]
        entry = get_favourite(name, "gif", favourites_path)
        if entry is None:
            raise ValueError(f"Favourite gif '{name}' not found in favourites.json")
        return resolve_gif(entry["source"], skill_dir, favourites_path)

    if source.startswith("giphy:"):
        raise ValueError(
            "giphy: sources require the skills/giphy skill. "
            "Use bundled:<name>, local:<name>, or a file path instead."
        )

    # Local path
    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"GIF file not found: {path}")
    return path


def resolve_sfx(source: str, skill_dir: Path, favourites_path: Path) -> Path:
    """
    Resolve a sfx source string to a local Path.

    Same patterns as resolve_gif plus "freesound:<query>".
    """
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
            f"Bundled sfx '{name}' not found. "
            "Run: cd skills/freesound && uv run python scripts/download_freesound_presets.py"
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
        query = source[len("freesound:") :]
        cache_dir = skill_dir / "assets" / "sfx" / "cache"
        cache_file = cache_dir / f"freesound_{_cache_key(query)}.mp3"
        if cache_file.exists():
            return cache_file
        url = _search_freesound(query)
        if url is None:
            raise ValueError(f"Freesound returned no results for query: '{query}'")
        return _download_file(url, cache_file)

    if source.startswith("giphy:"):
        raise ValueError("Use 'freesound:' prefix for sound effects, not 'giphy:'")

    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"SFX file not found: {path}")
    return path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _cli_list(favourites_path: Path) -> None:
    data = list_favourites(favourites_path)
    gifs = data.get("gifs", [])
    sfx = data.get("sfx", [])
    print(f"GIFs ({len(gifs)}):")
    for entry in gifs:
        tags = ", ".join(entry.get("tags", []))
        print(f"  {entry['name']:20s}  {entry['source']}  [{tags}]")
    print(f"\nSFX ({len(sfx)}):")
    for entry in sfx:
        tags = ", ".join(entry.get("tags", []))
        print(f"  {entry['name']:20s}  {entry['source']}  [{tags}]")


def _cli_library(args: "argparse.Namespace", skill_dir: Path) -> None:
    kind = getattr(args, "kind", "gif")

    if args.library_cmd == "list":
        all_kinds = ["gif", "sfx"] if kind == "all" else [kind]
        for k in all_kinds:
            entries = library_list(skill_dir, k)
            label = "Stickers (GIF)" if k == "gif" else "Sounds (SFX)"
            print(f"{label} — {len(entries)} in library:")
            if entries:
                for name, path in entries:
                    size_kb = path.stat().st_size // 1024
                    print(f"  local:{name:<22s}  {path.name}  ({size_kb} KB)")
            else:
                print(f"  (empty — drop files into {library_dir(skill_dir, k)})")

    elif args.library_cmd == "add":
        dest = library_add(args.name, Path(args.file), skill_dir, kind)
        print(f"Added [{kind}]: local:{args.name}  →  {dest}")

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
        print("Usage: assets.py library {list|add|remove|import-dir} [--kind gif|sfx]")


def main() -> None:
    skill_dir = Path(__file__).parent.parent
    favourites_path = skill_dir / "favourites.json"

    parser = argparse.ArgumentParser(description="Manage freesound skill assets")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("list", help="List all favourites")

    p_lib = sub.add_parser(
        "library", help="Manage local library (local:name) for GIFs and sounds"
    )
    lib_sub = p_lib.add_subparsers(dest="library_cmd")
    p_lib_list = lib_sub.add_parser("list", help="List library contents")
    p_lib_list.add_argument("--kind", default="all", choices=["gif", "sfx", "all"])
    p_lib_add = lib_sub.add_parser("add", help="Add a file to the library")
    p_lib_add.add_argument(
        "--name", required=True, help="Reference name (used as local:<name>)"
    )
    p_lib_add.add_argument("--file", required=True, help="Source file path")
    p_lib_add.add_argument("--kind", default="gif", choices=["gif", "sfx"])
    p_lib_rm = lib_sub.add_parser("remove", help="Remove a file from the library")
    p_lib_rm.add_argument("--name", required=True)
    p_lib_rm.add_argument("--kind", default="gif", choices=["gif", "sfx"])
    p_lib_imp = lib_sub.add_parser(
        "import-dir", help="Bulk import all matching files from a directory"
    )
    p_lib_imp.add_argument("--dir", required=True, help="Source directory")
    p_lib_imp.add_argument("--kind", default="gif", choices=["gif", "sfx"])

    p_add_gif = sub.add_parser("add-gif", help="Add a gif favourite")
    p_add_gif.add_argument("--name", required=True)
    p_add_gif.add_argument("--source", required=True)
    p_add_gif.add_argument("--tags", default="", help="Comma-separated tags")

    p_add_sfx = sub.add_parser("add-sfx", help="Add a sfx favourite")
    p_add_sfx.add_argument("--name", required=True)
    p_add_sfx.add_argument("--source", required=True)
    p_add_sfx.add_argument("--tags", default="", help="Comma-separated tags")

    p_remove = sub.add_parser("remove", help="Remove a favourite")
    p_remove.add_argument("--name", required=True)
    p_remove.add_argument("--kind", required=True, choices=["gif", "sfx"])

    args = parser.parse_args()

    if args.cmd == "list":
        _cli_list(favourites_path)

    elif args.cmd == "library":
        _cli_library(args, skill_dir)

    elif args.cmd == "add-gif":
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        add_favourite_gif(args.name, args.source, tags, favourites_path)
        print(f"Added gif favourite: {args.name} → {args.source}")

    elif args.cmd == "add-sfx":
        tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        add_favourite_sfx(args.name, args.source, tags, favourites_path)
        print(f"Added sfx favourite: {args.name} → {args.source}")

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
