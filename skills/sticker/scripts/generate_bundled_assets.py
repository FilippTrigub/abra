#!/usr/bin/env python3
"""
generate_bundled_assets.py — Generate bundled GIF and WAV assets for the sticker skill.

Uses only stdlib (wave, struct, math) and Pillow. No external audio processing needed.

Run once after cloning:
    cd skills/sticker && uv run python scripts/generate_bundled_assets.py
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

try:
    from PIL import Image, ImageDraw  # type: ignore[import-untyped]

    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False
    print("Warning: Pillow not installed. GIFs will not be generated.")
    print("Install with: pip install pillow  (or: uv run --with pillow ...)")

ASSETS_DIR = Path(__file__).parent.parent / "assets"
GIF_DIR = ASSETS_DIR / "gifs"
SFX_DIR = ASSETS_DIR / "sfx"
SIZE = 200  # GIF canvas px
N_FRAMES = 4  # frames per animation
FRAME_MS = 100  # ms per frame


# ---------------------------------------------------------------------------
# GIF helpers
# ---------------------------------------------------------------------------


def blank() -> "Image.Image":
    return Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))


def save_gif(frames: "list[Image.Image]", path: Path) -> None:
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


def make_heart() -> "list[Image.Image]":
    frames = []
    for i in range(N_FRAMES):
        s = 1.0 + 0.12 * math.sin(i * math.pi / 2)
        img = blank()
        draw = ImageDraw.Draw(img)
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


def make_sparkles() -> "list[Image.Image]":
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
        draw = ImageDraw.Draw(img)
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


def make_confetti() -> "list[Image.Image]":
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
        draw = ImageDraw.Draw(img)
        for x, y, w, h, color in pieces:
            ny = (y + fi * 14) % (SIZE + 20)
            draw.rectangle(
                [x - w // 2, ny - h // 2, x + w // 2, ny + h // 2], fill=color
            )
        frames.append(img)
    return frames


def make_fire() -> "list[Image.Image]":
    frames = []
    for i in range(N_FRAMES):
        img = blank()
        draw = ImageDraw.Draw(img)
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


def make_stars() -> "list[Image.Image]":
    frames = []
    star_defs = [
        (SIZE // 2, SIZE // 2, 68),
        (SIZE // 4, SIZE // 4, 28),
        (3 * SIZE // 4, SIZE // 4, 22),
    ]
    for i in range(N_FRAMES):
        img = blank()
        draw = ImageDraw.Draw(img)
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


def make_thumbsup() -> "list[Image.Image]":
    frames = []
    for i in range(N_FRAMES):
        img = blank()
        draw = ImageDraw.Draw(img)
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


def make_crown() -> "list[Image.Image]":
    frames = []
    for i in range(N_FRAMES):
        img = blank()
        draw = ImageDraw.Draw(img)
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


def make_explosion() -> "list[Image.Image]":
    frames = []
    for i in range(N_FRAMES):
        img = blank()
        draw = ImageDraw.Draw(img)
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
# WAV generation
# ---------------------------------------------------------------------------

RATE = 44100


def _pack(samples: list[int]) -> bytes:
    return struct.pack(f"<{len(samples)}h", *samples)


def _c(v: float) -> int:
    return max(-32767, min(32767, int(v)))


def sine(freq: float, dur: float, amp: float = 0.55, fade: float = 0.12) -> list[int]:
    n = int(RATE * dur)
    fade_n = int(RATE * fade)
    s = []
    for i in range(n):
        t = i / RATE
        v = amp * math.sin(2 * math.pi * freq * t)
        if i >= n - fade_n:
            v *= (n - i) / max(fade_n, 1)
        s.append(_c(v * 32767))
    return s


def noise(dur: float, amp: float = 0.30) -> list[int]:
    import random

    rng = random.Random(1)
    n = int(RATE * dur)
    fade = n // 5
    s = []
    for i in range(n):
        v = rng.uniform(-1, 1) * amp
        if i < fade:
            v *= i / max(fade, 1)
        elif i > n - fade:
            v *= (n - i) / max(fade, 1)
        s.append(_c(v * 32767))
    return s


def sweep(f0: float, f1: float, dur: float, amp: float = 0.45) -> list[int]:
    n = int(RATE * dur)
    fade = max(1, n // 8)
    s = []
    for i in range(n):
        t = i / RATE
        f = f0 + (f1 - f0) * (i / n)
        v = amp * math.sin(2 * math.pi * f * t)
        if i < fade:
            v *= i / fade
        elif i > n - fade:
            v *= (n - i) / fade
        s.append(_c(v * 32767))
    return s


def save_wav(samples: list[int], path: Path) -> None:
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(_pack(samples))
    print(f"  ✓ {path.name}")


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


def generate_sfx() -> None:
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    items: list[tuple[str, list[int]]] = [
        ("pop.wav", sine(880, 0.12, amp=0.7)),
        ("whoosh.wav", noise(0.28, amp=0.32) + sweep(700, 150, 0.14, amp=0.22)),
        ("chime.wav", sine(1047, 0.42, amp=0.62, fade=0.28)),
        ("applause.wav", noise(0.52, amp=0.28)),
        ("bass_drop.wav", sweep(220, 45, 0.38, amp=0.80)),
        ("ding.wav", sine(1319, 0.20, amp=0.65, fade=0.13)),
        ("swoosh.wav", noise(0.28, amp=0.25) + sweep(550, 80, 0.13, amp=0.18)),
        ("clap.wav", noise(0.16, amp=0.55)),
    ]
    for fname, samples in items:
        p = SFX_DIR / fname
        if p.exists():
            print(f"  (exists) {fname}")
            continue
        try:
            save_wav(samples, p)
        except Exception as exc:
            print(f"  ✗ {fname}: {exc}")


if __name__ == "__main__":
    print("Generating GIFs...")
    generate_gifs()
    print("\nGenerating SFX...")
    generate_sfx()
    n_gifs = len(list(GIF_DIR.glob("*.gif")))
    n_sfx = len(list(SFX_DIR.glob("*.wav")))
    print(f"\nDone: {n_gifs} GIFs, {n_sfx} WAVs in {ASSETS_DIR}")
