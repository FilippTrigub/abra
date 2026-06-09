"""Dub link tracker.

Wraps CTA URLs with trackable short links before send.
Optional — only active when DUB_API_KEY is set.
"""

import os
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://api.dub.co"


class DubClient:
    def __init__(self) -> None:
        self.api_key = os.environ.get("DUB_API_KEY")
        self.domain = os.environ.get("DUB_DOMAIN")

    def available(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def create_link(
        self, url: str, key: str | None = None, tags: list[str] | None = None
    ) -> str | None:
        payload: dict[str, Any] = {"url": url}
        if key:
            payload["key"] = key
        if tags:
            payload["tagNames"] = tags
        if self.domain:
            payload["domain"] = self.domain

        try:
            resp = requests.post(
                f"{BASE_URL}/links", headers=self._headers(), json=payload, timeout=10
            )
            if resp.status_code in (200, 201):
                return resp.json().get("shortLink")
        except requests.RequestException:
            pass
        return None


def wrap_links(brief: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
    """Replace cta_links URLs with Dub short links if DUB_API_KEY is set.

    Returns (updated_brief, {original_url: short_url}).
    """
    if not brief.get("track_links") or not brief.get("cta_links"):
        return brief, {}

    dub = DubClient()
    if not dub.available():
        return brief, {}

    campaign = brief.get("campaign_name", "campaign").lower().replace(" ", "-")
    links_map: dict[str, str] = {}
    body_html = brief.get("body_html", "")
    body_text = brief.get("body_text", "")

    for i, url in enumerate(brief["cta_links"]):
        key = f"{campaign}-cta-{i + 1}"
        short = dub.create_link(url, key=key, tags=[f"campaign:{campaign}", "channel:email"])
        if short:
            links_map[url] = short
            body_html = body_html.replace(url, short)
            body_text = body_text.replace(url, short)
            print(f"  Dub: {url} → {short}")

    updated = {**brief, "body_html": body_html, "body_text": body_text}
    return updated, links_map
