#!/usr/bin/env python3
"""
generate_bundled_assets.py — Generate placeholder GIF animations for the freesound skill.

Produces simple geometric GIFs as local fallbacks for visual overlays.
GIFs are used as optional visual companions for SFX overlays.

Run once after cloning:
    cd skills/freesound && uv run python scripts/generate_bundled_assets.py

For real sounds, run:
    cd skills/freesound && uv run python scripts/download_freesound_presets.py
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageDraw  # type: ignore[import-untyped]

    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False
    print("Warning: Pillow not installed. GIFs will not be generated.")
    print("Install with: pip install pillow  (or: uv run --with pillow ...)")

PILImage: Any = Image if HAS_PILLOW else None
PILImageDraw: Any = ImageDraw if HAS_PILLOW else None

ASSETS_DIR = Path(__file__).parent.parent / "assets"
GIF_DIR = ASSETS_DIR / "gifs"
SFX_DIR = ASSETS_DIR / "sfx"
SIZE = 200  # GIF canvas px
N_FRAMES = 4  # frames per animation
FRAME_MS = 100  # ms per frame


# ---------------------------------------------------------------------------
# GIF helpers
# ---------------------------------------------------------------------------


def blank() -> Any:
    return PILImage.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))


def save_gif(frames: list[Any], path: Path) -> None:
    out = [f.convert("RGBA") for f in frames]
    out[0].save(
        path,
        save_all=True,
        append_images=out[1:],
        duration=FRAME_MS,
        loop=0,
        format="GIF",
    )
    print(f"  ✓ {path.name}")


def ipt(v: float) -> int:
    """Float → int for pixel coords."""
    return int(round(v))


# ---------------------------------------------------------------------------
# Individual GIF generators
# ---------------------------------------------------------------------------


def make_heart() -> list[Any]:
    frames = []
    for i in range(N_FRAMES):
        s = 1.0 + 0.12 * math.sin(i * math.pi / 2)
        img = blank()
        draw = PILImageDraw.Draw(img)
        cx, cy = SIZE // 2, SIZE // 2
        r = int(SIZE * 0.18 * s)
        draw.ellipse([cx - 2 * r, cy - r, cx, cy + r], fill=(220, 20, 60, 240))
        draw.ellipse([cx, cy - r, cx + 2 * r, cy + r], fill=(220, 20, 60, 240))
        draw.polygon(
            [
                (cx - 2 * r, cy),
                (cx + 2 * r, cy),
                (cx, cy + ipt(2.2 * r)),
            ],
            fill=(220, 20, 60, 240),
        )
        frames.append(img)
    return frames


def make_sparkles() -> list[Any]:
    frames = []
    palette = [(255, 215, 0, 230), (255, 255, 120, 230), (255, 180, 0, 210)]
    stars = [
        (0.5, 0.5, 60),
        (0.25, 0.28, 28),
        (0.75, 0.25, 22),
        (0.2, 0.72, 18),
        (0.8, 0.75, 32),
    ]
    for i in range(N_FRAMES):
        img = blank()
        draw = PILImageDraw.Draw(img)
        base_angle = i * math.pi / N_FRAMES
        for j, (fx, fy, r) in enumerate(stars):
            cx, cy = ipt(fx * SIZE), ipt(fy * SIZE)
            a = base_angle + j * 0.7
            pts = []
            for k in range(8):
                rad = r if k % 2 == 0 else r // 2
                theta = a + k * math.pi / 4
                pts.append(
                    (cx + ipt(rad * math.cos(theta)), cy + ipt(rad * math.sin(theta)))
                )
            draw.polygon(pts, fill=palette[j % len(palette)])
        frames.append(img)
    return frames


def make_confetti() -> list[Any]:
    import random

    rng = random.Random(42)
    palette = [
        (255, 80, 80, 230),
        (80, 200, 255, 230),
        (255, 215, 50, 230),
        (100, 220, 100, 230),
        (200, 100, 255, 230),
        (255, 150, 50, 230),
    ]
    pieces = [
        (
            rng.randint(15, SIZE - 15),
            rng.randint(0, SIZE),
            rng.randint(8, 18),
            rng.randint(4, 10),
            palette[k % len(palette)],
        )
        for k in range(32)
    ]
    frames = []
    for fi in range(N_FRAMES):
        img = blank()
        draw = PILImageDraw.Draw(img)
        for x, y, w, h, color in pieces:
            ny = (y + fi * 14) % (SIZE + 20)
            draw.rectangle(
                [x - w // 2, ny - h // 2, x + w // 2, ny + h // 2], fill=color
            )
        frames.append(img)
    return frames


def make_fire() -> list[Any]:
    frames = []
    for i in range(N_FRAMES):
        img = blank()
        draw = PILImageDraw.Draw(img)
        cx = SIZE // 2
        flick = ipt(8 * math.sin(i * math.pi / 2))
        # Outer flame
        draw.ellipse(
            [cx - 55 + flick // 2, SIZE // 4 + flick, cx + 55 - flick // 2, SIZE - 8],
            fill=(220, 80, 20, 200),
        )
        # Inner
        draw.ellipse([cx - 35, SIZE // 3, cx + 35, SIZE - 14], fill=(255, 140, 0, 220))
        # Core
        draw.ellipse([cx - 14, SIZE // 2, cx + 14, SIZE - 20], fill=(255, 220, 50, 240))
        frames.append(img)
    return frames


def make_stars() -> list[Any]:
    frames = []
    star_defs = [
        (SIZE // 2, SIZE // 2, 68),
        (SIZE // 4, SIZE // 4, 28),
        (3 * SIZE // 4, SIZE // 4, 22),
    ]
    for i in range(N_FRAMES):
        img = blank()
        draw = PILImageDraw.Draw(img)
        angle = i * math.pi / N_FRAMES
        for cx, cy, r in star_defs:
            pts = []
            for k in range(10):
                rad = r if k % 2 == 0 else r // 2
                theta = angle + k * math.pi / 5
                pts.append(
                    (cx + ipt(rad * math.cos(theta)), cy + ipt(rad * math.sin(theta)))
                )
            draw.polygon(pts, fill=(255, 215, 0, 240))
        frames.append(img)
    return frames


def make_thumbsup() -> list[Any]:
    frames = []
    for i in range(N_FRAMES):
        img = blank()
        draw = PILImageDraw.Draw(img)
        dy = ipt(7 * math.sin(i * math.pi / 2))
        cx, cy = SIZE // 2, SIZE // 2 + dy
        blue = (50, 100, 220, 240)
        # Palm
        draw.rectangle([cx - 32, cy - 8, cx + 32, cy + 50], fill=blue)
        # Thumb arc
        draw.ellipse([cx - 18, cy - 58, cx + 18, cy - 8], fill=blue)
        draw.rectangle([cx - 18, cy - 38, cx + 18, cy - 8], fill=blue)
        frames.append(img)
    return frames


def make_crown() -> list[Any]:
    frames = []
    for i in range(N_FRAMES):
        img = blank()
        draw = PILImageDraw.Draw(img)
        alpha = ipt(200 + 40 * math.sin(i * math.pi / 2))
        color = (255, 200, 0, min(255, alpha))
        outline = (180, 140, 0, 255)
        cx, base_y = SIZE // 2, SIZE * 2 // 3
        # Base band
        draw.rectangle(
            [cx - 65, base_y, cx + 65, base_y + 38],
            fill=color,
            outline=outline,
            width=2,
        )
        # Points
        for px, pt in [
            (cx - 58, base_y - 48),
            (cx, base_y - 68),
            (cx + 58, base_y - 48),
        ]:
            draw.polygon(
                [(px, base_y), (px, pt), (px + 20, base_y)], fill=color, outline=outline
            )
        # Jewels
        for jx in [cx - 42, cx, cx + 42]:
            draw.ellipse(
                [jx - 7, base_y + 12, jx + 7, base_y + 26], fill=(220, 50, 50, 240)
            )
        frames.append(img)
    return frames


def make_explosion() -> list[Any]:
    frames = []
    for i in range(N_FRAMES):
        img = blank()
        draw = PILImageDraw.Draw(img)
        t = i / max(N_FRAMES - 1, 1)
        cx, cy = SIZE // 2, SIZE // 2
        r_out = ipt(35 + 55 * t)
        r_in = ipt(20 + 30 * t)
        pts = []
        for k in range(16):
            r = r_out if k % 2 == 0 else r_in
            theta = k * math.pi / 8
            pts.append((cx + ipt(r * math.cos(theta)), cy + ipt(r * math.sin(theta))))
        draw.polygon(pts, fill=(255, 140, 0, ipt(220 - 60 * t)))
        draw.ellipse(
            [cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=(255, 220, 50, 230)
        )
        frames.append(img)
    return frames


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def generate_gifs() -> None:
    if not HAS_PILLOW:
        print("  Skipping (Pillow unavailable)")
        return
    GIF_DIR.mkdir(parents=True, exist_ok=True)
    items = [
        ("heart.gif", make_heart),
        ("sparkles.gif", make_sparkles),
        ("confetti.gif", make_confetti),
        ("fire.gif", make_fire),
        ("stars.gif", make_stars),
        ("thumbsup.gif", make_thumbsup),
        ("crown.gif", make_crown),
        ("explosion.gif", make_explosion),
    ]
    for fname, fn in items:
        p = GIF_DIR / fname
        if p.exists():
            print(f"  (exists) {fname}")
            continue
        try:
            save_gif(fn(), p)
        except Exception as exc:
            print(f"  ✗ {fname}: {exc}")


if __name__ == "__main__":
    print("Generating placeholder GIFs...")
    generate_gifs()
    n_gifs = len(list(GIF_DIR.glob("*.gif")))
    print(f"\nDone: {n_gifs} placeholder GIFs in {GIF_DIR}")
    print("For real sounds: uv run python scripts/download_freesound_presets.py")
