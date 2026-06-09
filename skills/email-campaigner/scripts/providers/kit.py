"""Kit (ConvertKit) provider.

Kit's v3 API can create broadcast drafts but has no programmatic send endpoint.
This creates the broadcast and prints the ID for manual publish in the Kit dashboard.
"""

import os
import sys
from typing import Any

import requests
from dotenv import load_dotenv

from .base import EmailProvider

load_dotenv()

BASE_URL = "https://api.convertkit.com/v3"


class KitProvider(EmailProvider):
    name = "kit"

    def __init__(self) -> None:
        self.api_secret = os.environ.get("KIT_API_SECRET")
        if not self.api_secret:
            sys.exit("Error: KIT_API_SECRET not set")

    def send(self, brief: dict[str, Any]) -> dict[str, Any]:
        content = brief.get("body_html") or brief.get("body_text")
        if not content:
            sys.exit("Error: Kit requires 'body_html' or 'body_text' in brief")

        payload: dict[str, Any] = {
            "api_secret": self.api_secret,
            "subject": brief["subject"],
            "content": content,
            "email_layout_template": "default",
        }
        if brief.get("campaign_name"):
            payload["description"] = brief["campaign_name"]

        resp = requests.post(f"{BASE_URL}/broadcasts", json=payload, timeout=30)
        result = resp.json()
        if resp.status_code not in (200, 201):
            sys.exit(f"Kit error: {result}")

        broadcast_id = result.get("broadcast", {}).get("id")
        print(f"  Broadcast draft created. ID: {broadcast_id}")
        print("  Kit's API does not support programmatic sending.")
        print(f"  Open the Kit dashboard to publish broadcast {broadcast_id}.")
        return result
