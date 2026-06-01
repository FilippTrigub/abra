#!/usr/bin/env python3
"""Brand asset management for Claw-Parade."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


SKILL_DIR = Path(__file__).parent.parent.resolve()
ASSETS_DIR = SKILL_DIR / "brand-assets"
IMAGES_DIR = ASSETS_DIR / "images"
FONTS_DIR = ASSETS_DIR / "fonts"
VIDEOS_DIR = ASSETS_DIR / "videos"
MANIFEST_PATH = ASSETS_DIR / "asset-manifest.json"

VALID_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
VALID_FONT_EXTENSIONS = {".ttf", ".otf", ".woff", ".woff2"}
VALID_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v", ".webm"}
GOOGLE_FONTS_API = "https://www.googleapis.com/webfonts/v1/webfonts"
FONTSOURCE_API = "https://api.fontsource.org/v1/fonts"


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {
            "version": "1.0",
            "brand": "brand-awareness",
            "updated": datetime.now(timezone.utc).isoformat(),
            "images": [],
            "fonts": [],
            "videos": [],
            "ctas": [],
        }
    with MANIFEST_PATH.open() as f:
        manifest = json.load(f)
    manifest.setdefault("images", [])
    manifest.setdefault("fonts", [])
    manifest.setdefault("videos", [])
    manifest.setdefault("ctas", [])
    return manifest


def save_manifest(manifest: dict) -> None:
    manifest["updated"] = datetime.now(timezone.utc).isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")


def safe_url_for_error(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))


def slugify(value: str) -> str:
    chars: list[str] = []
    previous_dash = False
    for char in value.lower():
        if char.isalnum():
            chars.append(char)
            previous_dash = False
        elif not previous_dash:
            chars.append("-")
            previous_dash = True
    return "".join(chars).strip("-") or "font"


def fetch_json(url: str, headers: dict[str, str] | None = None) -> dict | list:
    request_headers = {"User-Agent": "claw-parade-brand-manager/1.0"}
    if headers:
        request_headers.update(headers)
    request = urllib.request.Request(url, headers=request_headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        print(
            f"Error: HTTP {exc.code} fetching {safe_url_for_error(url)}: {message}",
            file=sys.stderr,
        )
        sys.exit(1)
    except urllib.error.URLError as exc:
        print(
            f"Error: Could not fetch {safe_url_for_error(url)}: {exc.reason}",
            file=sys.stderr,
        )
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(
            f"Error: Invalid JSON from {safe_url_for_error(url)}: {exc}",
            file=sys.stderr,
        )
        sys.exit(1)


def download_file(url: str, dest_path: Path) -> str:
    request = urllib.request.Request(
        url, headers={"User-Agent": "claw-parade-brand-manager/1.0"}
    )
    digest = hashlib.sha256()
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            with dest_path.open("wb") as output:
                while True:
                    chunk = response.read(1024 * 64)
                    if not chunk:
                        break
                    digest.update(chunk)
                    output.write(chunk)
    except urllib.error.HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        print(
            f"Error: HTTP {exc.code} downloading {safe_url_for_error(url)}: {message}",
            file=sys.stderr,
        )
        sys.exit(1)
    except urllib.error.URLError as exc:
        print(
            f"Error: Could not download {safe_url_for_error(url)}: {exc.reason}",
            file=sys.stderr,
        )
        sys.exit(1)
    return digest.hexdigest()


def validate_asset_name(name: str) -> None:
    if not name.strip() or name in {".", ".."} or "/" in name or "\\" in name:
        print(
            "Error: Asset name must be a plain file name without path separators.",
            file=sys.stderr,
        )
        sys.exit(1)
    if ".." in Path(name).parts:
        print("Error: Asset name must not contain '..'.", file=sys.stderr)
        sys.exit(1)


def write_font_metadata(name: str, metadata: dict) -> str:
    validate_asset_name(name)
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    metadata_name = f"{name}.metadata.json"
    metadata_path = FONTS_DIR / metadata_name
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
    return f"fonts/{metadata_name}"


def find_by_name(manifest: dict, asset_type: str, name: str) -> dict | None:
    for asset in manifest.get(asset_type, []):
        if asset.get("name") == name:
            return asset
    return None


def find_by_tag(manifest: dict, asset_type: str, tag: str) -> list[dict]:
    return [
        asset for asset in manifest.get(asset_type, []) if tag in asset.get("tags", [])
    ]


def _set_default_cta(manifest: dict, default: bool) -> None:
    if default:
        for cta in manifest["ctas"]:
            cta.pop("default", None)


def store_cta_text(
    name: str, text: str, tags: list[str], force: bool = False, default: bool = False
) -> None:
    if not text.strip():
        print("Error: CTA text must not be empty.", file=sys.stderr)
        sys.exit(1)

    manifest = load_manifest()
    existing = find_by_name(manifest, "ctas", name)
    if existing and not force:
        print(f"Error: CTA '{name}' exists. Use --force.", file=sys.stderr)
        sys.exit(1)
    if existing:
        manifest["ctas"].remove(existing)

    _set_default_cta(manifest, default)
    manifest["ctas"].append(
        {
            "name": name,
            "type": "text",
            "text": text,
            "tags": tags,
            "default": default,
            "added": datetime.now(timezone.utc).isoformat(),
        }
    )
    save_manifest(manifest)
    print(f"Stored CTA text: {name}")


def store_cta_asset(
    name: str,
    asset_name: str,
    cta_type: str,
    tags: list[str],
    force: bool = False,
    default: bool = False,
) -> None:
    manifest = load_manifest()
    asset_type = "images" if cta_type == "image" else "videos"
    asset = find_by_name(manifest, asset_type, asset_name)
    if asset is None:
        print(
            f"Error: {cta_type} asset '{asset_name}' not found. Store it first.",
            file=sys.stderr,
        )
        sys.exit(1)

    existing = find_by_name(manifest, "ctas", name)
    if existing and not force:
        print(f"Error: CTA '{name}' exists. Use --force.", file=sys.stderr)
        sys.exit(1)
    if existing:
        manifest["ctas"].remove(existing)

    _set_default_cta(manifest, default)
    manifest["ctas"].append(
        {
            "name": name,
            "type": cta_type,
            "asset_path": asset["path"],
            "tags": tags,
            "default": default,
            "added": datetime.now(timezone.utc).isoformat(),
        }
    )
    save_manifest(manifest)
    print(f"Stored CTA {cta_type}: {name} -> {asset['path']}")


def store_image(
    input_path: Path, name: str, tags: list[str], force: bool = False
) -> None:
    validate_asset_name(name)
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    if input_path.suffix.lower() not in VALID_IMAGE_EXTENSIONS:
        print(
            f"Error: Invalid image extension: {', '.join(sorted(VALID_IMAGE_EXTENSIONS))}",
            file=sys.stderr,
        )
        sys.exit(1)

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    dest_name = f"{name}{input_path.suffix.lower()}"
    dest_path = IMAGES_DIR / dest_name

    if dest_path.exists() and not force:
        print(f"Error: Asset '{name}' exists. Use --force.", file=sys.stderr)
        sys.exit(1)

    shutil.copy2(input_path, dest_path)

    manifest = load_manifest()
    existing = find_by_name(manifest, "images", name)
    if existing:
        manifest["images"].remove(existing)

    manifest["images"].append(
        {
            "name": name,
            "path": f"images/{dest_name}",
            "tags": tags,
            "added": datetime.now(timezone.utc).isoformat(),
        }
    )

    save_manifest(manifest)
    print(f"Stored image: {name} -> {dest_path}")


def store_font(
    input_path: Path,
    name: str,
    tags: list[str],
    force: bool = False,
    metadata: dict | None = None,
) -> None:
    validate_asset_name(name)
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    if input_path.suffix.lower() not in VALID_FONT_EXTENSIONS:
        print(
            f"Error: Invalid font extension: {', '.join(sorted(VALID_FONT_EXTENSIONS))}",
            file=sys.stderr,
        )
        sys.exit(1)

    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    dest_name = f"{name}{input_path.suffix.lower()}"
    dest_path = FONTS_DIR / dest_name

    if dest_path.exists() and not force:
        print(f"Error: Asset '{name}' exists. Use --force.", file=sys.stderr)
        sys.exit(1)

    shutil.copy2(input_path, dest_path)

    manifest = load_manifest()
    existing = find_by_name(manifest, "fonts", name)
    if existing:
        manifest["fonts"].remove(existing)

    entry = {
        "name": name,
        "path": f"fonts/{dest_name}",
        "tags": tags,
        "added": datetime.now(timezone.utc).isoformat(),
    }
    if metadata:
        entry.update(metadata)

    manifest["fonts"].append(entry)

    save_manifest(manifest)
    print(f"Stored font: {name} -> {dest_path}")


def download_google_font(
    family: str,
    variant: str,
    name: str | None,
    tags: list[str],
    api_key: str,
    force: bool = False,
) -> None:
    query = urllib.parse.urlencode(
        {
            "key": api_key,
            "family": family,
            "capability": "WOFF2",
        }
    )
    data = fetch_json(f"{GOOGLE_FONTS_API}?{query}")
    items = data.get("items", []) if isinstance(data, dict) else []
    font = next(
        (item for item in items if item.get("family", "").lower() == family.lower()),
        items[0] if items else None,
    )
    if not font:
        print(f"Error: Google font family not found: {family}", file=sys.stderr)
        sys.exit(1)

    files = font.get("files", {})
    font_url = files.get(variant)
    if not font_url:
        available = ", ".join(sorted(files.keys())) or "none"
        print(
            f"Error: Variant '{variant}' not found for {font.get('family', family)}. "
            f"Available: {available}",
            file=sys.stderr,
        )
        sys.exit(1)

    suffix = Path(urllib.parse.urlparse(font_url).path).suffix.lower() or ".ttf"
    font_name = name or f"{slugify(font.get('family', family))}-{slugify(variant)}"
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir) / f"{font_name}{suffix}"
        sha256 = download_file(font_url, temp_path)
        fetched_at = datetime.now(timezone.utc).isoformat()
        metadata = {
            "source": "google-fonts",
            "family": font.get("family", family),
            "variant": variant,
            "version": font.get("version"),
            "category": font.get("category"),
            "subsets": font.get("subsets", []),
            "download_url": font_url,
            "license": "See Google Fonts family metadata; Developer API does not "
            "expose a documented license field.",
            "sha256": sha256,
            "fetched_at": fetched_at,
        }
        metadata["metadata_path"] = write_font_metadata(font_name, metadata)
        store_font(temp_path, font_name, tags, force, metadata)


def _fontsource_variant_url(
    variants: dict,
    weight: str,
    style: str,
    subset: str,
    font_format: str,
) -> str | None:
    weight_data = variants.get(weight) or variants.get(str(weight))
    if not isinstance(weight_data, dict):
        return None
    style_data = weight_data.get(style)
    if not isinstance(style_data, dict):
        return None
    subset_data = style_data.get(subset)
    if not isinstance(subset_data, dict):
        return None
    url_data = subset_data.get("url")
    if isinstance(url_data, dict):
        return url_data.get(font_format)
    return None


def download_fontsource_font(
    font_id: str,
    weight: str,
    style: str,
    subset: str | None,
    font_format: str,
    name: str | None,
    tags: list[str],
    force: bool = False,
) -> None:
    data = fetch_json(f"{FONTSOURCE_API}/{urllib.parse.quote(font_id)}")
    if not isinstance(data, dict):
        print(f"Error: Invalid Fontsource response for {font_id}", file=sys.stderr)
        sys.exit(1)

    chosen_subset = subset or data.get("defSubset") or "latin"
    font_url = _fontsource_variant_url(
        data.get("variants", {}), weight, style, chosen_subset, font_format
    )
    if not font_url:
        print(
            "Error: Fontsource variant not found. "
            f"Requested weight={weight}, style={style}, subset={chosen_subset}, format={font_format}.",
            file=sys.stderr,
        )
        sys.exit(1)

    suffix = f".{font_format}"
    font_name = name or "-".join(
        [slugify(data.get("family", font_id)), weight, slugify(style), slugify(chosen_subset)]
    )
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir) / f"{font_name}{suffix}"
        sha256 = download_file(font_url, temp_path)
        fetched_at = datetime.now(timezone.utc).isoformat()
        metadata = {
            "source": "fontsource",
            "font_id": data.get("id", font_id),
            "family": data.get("family", font_id),
            "weight": weight,
            "style": style,
            "subset": chosen_subset,
            "format": font_format,
            "version": data.get("version"),
            "npm_version": data.get("npmVersion"),
            "category": data.get("category"),
            "license": data.get("license"),
            "source_url": data.get("source"),
            "download_url": font_url,
            "sha256": sha256,
            "fetched_at": fetched_at,
        }
        metadata["metadata_path"] = write_font_metadata(font_name, metadata)
        store_font(temp_path, font_name, tags, force, metadata)


def store_video(
    input_path: Path,
    name: str,
    tags: list[str],
    force: bool = False,
    default: bool = False,
) -> None:
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    if input_path.suffix.lower() not in VALID_VIDEO_EXTENSIONS:
        print(
            f"Error: Invalid video extension: {', '.join(sorted(VALID_VIDEO_EXTENSIONS))}",
            file=sys.stderr,
        )
        sys.exit(1)

    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    dest_name = f"{name}{input_path.suffix.lower()}"
    dest_path = VIDEOS_DIR / dest_name

    if dest_path.exists() and not force:
        print(f"Error: Asset '{name}' exists. Use --force.", file=sys.stderr)
        sys.exit(1)

    shutil.copy2(input_path, dest_path)

    manifest = load_manifest()
    existing = find_by_name(manifest, "videos", name)
    if existing:
        manifest["videos"].remove(existing)

    if default:
        for video in manifest["videos"]:
            video.pop("default", None)

    manifest["videos"].append(
        {
            "name": name,
            "path": f"videos/{dest_name}",
            "tags": tags,
            "default": default,
            "added": datetime.now(timezone.utc).isoformat(),
        }
    )

    save_manifest(manifest)
    print(f"Stored video: {name} -> {dest_path}")


def list_assets(asset_type: str | None, tag: str | None) -> None:
    manifest = load_manifest()
    results: list[tuple[str, dict]] = []

    if asset_type in (None, "images"):
        for img in manifest.get("images", []):
            if tag is None or tag in img.get("tags", []):
                results.append(("image", img))

    if asset_type in (None, "fonts"):
        for font in manifest.get("fonts", []):
            if tag is None or tag in font.get("tags", []):
                results.append(("font", font))

    if asset_type in (None, "videos"):
        for video in manifest.get("videos", []):
            if tag is None or tag in video.get("tags", []):
                results.append(("video", video))

    if asset_type in (None, "ctas"):
        for cta in manifest.get("ctas", []):
            if tag is None or tag in cta.get("tags", []):
                results.append(("cta", cta))

    if not results:
        print("No assets found.")
        return

    print(f"Brand Assets ({len(results)}):\n")
    for atype, asset in results:
        print(f"  [{atype.upper()}] {asset['name']}")
        if "path" in asset:
            print(f"    Path: {ASSETS_DIR / asset['path']}")
        elif "asset_path" in asset:
            print(f"    Asset Path: {ASSETS_DIR / asset['asset_path']}")
        elif "text" in asset:
            print(f"    Text: {asset['text']}")
        if asset.get("type"):
            print(f"    Type: {asset['type']}")
        if asset.get("tags"):
            print(f"    Tags: {', '.join(asset['tags'])}")
        print()


def get_asset_path(name: str | None, tag: str | None) -> None:
    if not name and not tag:
        print("Error: Specify --name or --tag", file=sys.stderr)
        sys.exit(1)

    manifest = load_manifest()

    if name:
        asset = find_by_name(manifest, "images", name)
        if not asset:
            asset = find_by_name(manifest, "fonts", name)
        if not asset:
            asset = find_by_name(manifest, "videos", name)
        if not asset:
            asset = find_by_name(manifest, "ctas", name)
        if asset:
            if "path" in asset:
                print(ASSETS_DIR / asset["path"])
            elif "asset_path" in asset:
                print(ASSETS_DIR / asset["asset_path"])
            else:
                print(asset["text"])
            return
        print(f"Error: Asset '{name}' not found.", file=sys.stderr)
        sys.exit(1)

    if tag:
        assets = find_by_tag(manifest, "images", tag)
        if not assets:
            assets = find_by_tag(manifest, "fonts", tag)
        if not assets:
            assets = find_by_tag(manifest, "videos", tag)
        if not assets:
            assets = find_by_tag(manifest, "ctas", tag)
        if assets:
            if "path" in assets[0]:
                print(ASSETS_DIR / assets[0]["path"])
            elif "asset_path" in assets[0]:
                print(ASSETS_DIR / assets[0]["asset_path"])
            else:
                print(assets[0]["text"])
            return
        print(f"Error: No asset with tag '{tag}'.", file=sys.stderr)
        sys.exit(1)


def remove_asset(name: str) -> None:
    manifest = load_manifest()

    asset = find_by_name(manifest, "images", name)
    if asset:
        (ASSETS_DIR / asset["path"]).unlink(missing_ok=True)
        manifest["images"].remove(asset)
        save_manifest(manifest)
        print(f"Removed image: {name}")
        return

    asset = find_by_name(manifest, "fonts", name)
    if asset:
        (ASSETS_DIR / asset["path"]).unlink(missing_ok=True)
        manifest["fonts"].remove(asset)
        save_manifest(manifest)
        print(f"Removed font: {name}")
        return

    asset = find_by_name(manifest, "videos", name)
    if asset:
        (ASSETS_DIR / asset["path"]).unlink(missing_ok=True)
        manifest["videos"].remove(asset)
        save_manifest(manifest)
        print(f"Removed video: {name}")
        return

    asset = find_by_name(manifest, "ctas", name)
    if asset:
        manifest["ctas"].remove(asset)
        save_manifest(manifest)
        print(f"Removed CTA: {name}")
        return

    print(f"Error: Asset '{name}' not found.", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Brand asset management")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_store_image = subparsers.add_parser("store-image", help="Store a brand image")
    p_store_image.add_argument("--input", "-i", required=True, type=Path)
    p_store_image.add_argument("--name", "-n", required=True)
    p_store_image.add_argument("--tags", "-t", default="")
    p_store_image.add_argument("--force", "-f", action="store_true")

    p_store_font = subparsers.add_parser("store-font", help="Store a brand font")
    p_store_font.add_argument("--input", "-i", required=True, type=Path)
    p_store_font.add_argument("--name", "-n", required=True)
    p_store_font.add_argument("--tags", "-t", default="")
    p_store_font.add_argument("--force", "-f", action="store_true")

    p_download_google_font = subparsers.add_parser(
        "download-google-font", help="Download a font from Google Fonts Developer API"
    )
    p_download_google_font.add_argument("--family", required=True)
    p_download_google_font.add_argument("--variant", default="regular")
    p_download_google_font.add_argument("--name", "-n")
    p_download_google_font.add_argument("--tags", "-t", default="")
    p_download_google_font.add_argument(
        "--api-key",
        default=None,
        help="Google Fonts API key. Defaults to GOOGLE_FONTS_API_KEY.",
    )
    p_download_google_font.add_argument("--force", "-f", action="store_true")

    p_download_fontsource_font = subparsers.add_parser(
        "download-fontsource-font", help="Download a font from Fontsource API"
    )
    p_download_fontsource_font.add_argument(
        "--id", required=True, help="Fontsource font id, e.g. inter"
    )
    p_download_fontsource_font.add_argument("--weight", default="400")
    p_download_fontsource_font.add_argument("--style", default="normal")
    p_download_fontsource_font.add_argument("--subset")
    p_download_fontsource_font.add_argument(
        "--format", choices=["woff2", "woff", "ttf"], default="woff2"
    )
    p_download_fontsource_font.add_argument("--name", "-n")
    p_download_fontsource_font.add_argument("--tags", "-t", default="")
    p_download_fontsource_font.add_argument("--force", "-f", action="store_true")

    p_store_video = subparsers.add_parser("store-video", help="Store a brand video")
    p_store_video.add_argument("--input", "-i", required=True, type=Path)
    p_store_video.add_argument("--name", "-n", required=True)
    p_store_video.add_argument("--tags", "-t", default="")
    p_store_video.add_argument("--default", action="store_true")
    p_store_video.add_argument("--force", "-f", action="store_true")

    p_store_cta_text = subparsers.add_parser("store-cta-text", help="Store a text CTA")
    p_store_cta_text.add_argument("--name", "-n", required=True)
    p_store_cta_text.add_argument("--text", required=True)
    p_store_cta_text.add_argument("--tags", "-t", default="")
    p_store_cta_text.add_argument("--default", action="store_true")
    p_store_cta_text.add_argument("--force", "-f", action="store_true")

    p_store_cta_image = subparsers.add_parser(
        "store-cta-image", help="Store an image CTA"
    )
    p_store_cta_image.add_argument("--name", "-n", required=True)
    p_store_cta_image.add_argument("--asset-name", required=True)
    p_store_cta_image.add_argument("--tags", "-t", default="")
    p_store_cta_image.add_argument("--default", action="store_true")
    p_store_cta_image.add_argument("--force", "-f", action="store_true")

    p_store_cta_video = subparsers.add_parser(
        "store-cta-video", help="Store a video CTA"
    )
    p_store_cta_video.add_argument("--name", "-n", required=True)
    p_store_cta_video.add_argument("--asset-name", required=True)
    p_store_cta_video.add_argument("--tags", "-t", default="")
    p_store_cta_video.add_argument("--default", action="store_true")
    p_store_cta_video.add_argument("--force", "-f", action="store_true")

    p_list = subparsers.add_parser("list", help="List brand assets")
    p_list.add_argument("--type", choices=["images", "fonts", "videos", "ctas"])
    p_list.add_argument("--tag", "-t")

    p_get = subparsers.add_parser("get-path", help="Get asset path")
    p_get.add_argument("--name", "-n")
    p_get.add_argument("--tag", "-t")

    p_remove = subparsers.add_parser("remove", help="Remove an asset")
    p_remove.add_argument("--name", "-n", required=True)

    args = parser.parse_args()
    tags = (
        [t.strip() for t in args.tags.split(",") if t.strip()]
        if hasattr(args, "tags")
        else []
    )

    match args.command:
        case "store-image":
            store_image(args.input, args.name, tags, args.force)
        case "store-font":
            store_font(args.input, args.name, tags, args.force)
        case "download-google-font":
            api_key = args.api_key
            if not api_key:
                api_key = os.environ.get("GOOGLE_FONTS_API_KEY")
            if not api_key:
                print(
                    "Error: Google Fonts API key required. Pass --api-key or set "
                    "GOOGLE_FONTS_API_KEY.",
                    file=sys.stderr,
                )
                sys.exit(1)
            download_google_font(
                args.family, args.variant, args.name, tags, api_key, args.force
            )
        case "download-fontsource-font":
            download_fontsource_font(
                args.id,
                args.weight,
                args.style,
                args.subset,
                args.format,
                args.name,
                tags,
                args.force,
            )
        case "store-video":
            store_video(args.input, args.name, tags, args.force, args.default)
        case "store-cta-text":
            store_cta_text(args.name, args.text, tags, args.force, args.default)
        case "store-cta-image":
            store_cta_asset(
                args.name, args.asset_name, "image", tags, args.force, args.default
            )
        case "store-cta-video":
            store_cta_asset(
                args.name, args.asset_name, "video", tags, args.force, args.default
            )
        case "list":
            list_assets(args.type, args.tag)
        case "get-path":
            get_asset_path(args.name, args.tag)
        case "remove":
            remove_asset(args.name)


if __name__ == "__main__":
    main()
