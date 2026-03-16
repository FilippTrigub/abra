"""timeline.py — Text-cue to timestamp resolution for the freesound skill.

Parses transcript JSON output from the verbatim skill and finds the end
timestamp of a user-specified phrase.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


def load_transcript(path: Path) -> list[dict]:
    """
    Load verbatim skill output JSON.

    Expected format: [{"start": 0.0, "end": 1.2, "text": "hello world"}, ...]

    Raises:
        FileNotFoundError: if path does not exist.
        ValueError: if the JSON is not a list of segment dicts.
    """
    if not path.exists():
        raise FileNotFoundError(f"Transcript not found: {path}")
    with path.open() as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError(f"Transcript must be a JSON array, got {type(data).__name__}")
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(
                f"Transcript item {i} must be a dict, got {type(item).__name__}"
            )
        if "text" not in item:
            raise ValueError(f"Transcript item {i} missing 'text' key")
    return data


def _normalise(text: str) -> str:
    """Lowercase and collapse whitespace."""
    return re.sub(r"\s+", " ", text.lower()).strip()


def resolve_text_cue(phrase: str, transcript_path: Path) -> float:
    """
    Find the END timestamp (seconds) of *phrase* in the transcript.

    Search is case-insensitive; phrase can span multiple consecutive segments.

    Raises:
        ValueError: if the phrase is not found anywhere in the transcript.
    """
    segments = load_transcript(transcript_path)
    phrase_norm = _normalise(phrase)

    # Build a single concatenated string with per-character segment tracking.
    # Each character position maps to the end-time of its segment.
    combined = ""
    # List of (char_end_position, segment_end_time) — inclusive upper bound
    seg_bounds: list[tuple[int, float]] = []

    for seg in segments:
        seg_text = _normalise(seg["text"])
        if combined:
            combined += " "
        combined += seg_text
        seg_bounds.append((len(combined), float(seg["end"])))

    idx = combined.find(phrase_norm)
    if idx == -1:
        raise ValueError(
            f"Phrase '{phrase}' not found in transcript. "
            f"Available text: {combined[:200]}..."
        )

    phrase_end_pos = idx + len(phrase_norm)

    # Find the first segment whose end position covers phrase_end_pos
    for char_end, seg_end in seg_bounds:
        if phrase_end_pos <= char_end:
            return seg_end

    # Fallback: phrase ends at/past the last segment
    return seg_bounds[-1][1]


def format_timestamp(seconds: float) -> str:
    """Format a float seconds value as 'MM:SS.mmm'."""
    total_ms = int(round(seconds * 1000))
    ms = total_ms % 1000
    total_s = total_ms // 1000
    secs = total_s % 60
    mins = total_s // 60
    return f"{mins:02d}:{secs:02d}.{ms:03d}"
