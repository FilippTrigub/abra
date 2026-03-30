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
        "x_min": 50,
        "x_max": 980,
        "y_upper": 250,
        "y_center": 960,
        "y_lower": 1300,
    },
    "feed-portrait": {
        "x_min": 50,
        "x_max": 980,
        "y_upper": 180,
        "y_center": 675,
        "y_lower": 950,
    },
    "feed-square": {
        "x_min": 50,
        "x_max": 980,
        "y_upper": 150,
        "y_center": 540,
        "y_lower": 800,
    },
}


POSITION_TO_KEY = {
    "upper-middle": "y_upper",
    "center": "y_center",
    "lower-middle": "y_lower",
}
