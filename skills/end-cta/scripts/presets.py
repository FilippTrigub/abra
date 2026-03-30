from __future__ import annotations

PRESETS: dict[str, dict[str, object]] = {
    "bold-white": {
        "fill": "#ffffff",
        "stroke": "#111111",
        "stroke_width": 4,
        "box_fill": None,
    },
    "bold-black": {
        "fill": "#111111",
        "stroke": "#ffffff",
        "stroke_width": 4,
        "box_fill": None,
    },
    "neon-red": {
        "fill": "#ffffff",
        "stroke": "#ff0033",
        "stroke_width": 5,
        "box_fill": None,
    },
    "neon-yellow": {
        "fill": "#111111",
        "stroke": "#ffd400",
        "stroke_width": 5,
        "box_fill": None,
    },
    "minimal": {
        "fill": "#ffffff",
        "stroke": None,
        "stroke_width": 0,
        "box_fill": "#111111cc",
    },
}

SAFE_ZONES: dict[str, dict[str, int]] = {
    "reels": {
        "left": 90,
        "right": 990,
        "top": 200,
        "upper": 320,
        "center": 960,
        "lower": 1520,
        "bottom": 1760,
    },
    "feed-portrait": {
        "left": 90,
        "right": 990,
        "top": 120,
        "upper": 240,
        "center": 675,
        "lower": 1110,
        "bottom": 1240,
    },
    "feed-square": {
        "left": 90,
        "right": 990,
        "top": 90,
        "upper": 200,
        "center": 540,
        "lower": 860,
        "bottom": 980,
    },
}

POSITIONS = {
    "top-left": ("left", "top"),
    "top-right": ("right", "top"),
    "upper-middle": ("center_x", "upper"),
    "center": ("center_x", "center"),
    "lower-middle": ("center_x", "lower"),
    "bottom-right": ("right", "bottom"),
    "bottom-left": ("left", "bottom"),
}
