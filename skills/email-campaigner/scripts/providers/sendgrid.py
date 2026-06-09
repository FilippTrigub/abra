"""SendGrid provider.

Uses the v3 Mail Send API. Requires 'to' in brief (list of addresses).
"""

import os
import sys
from typing import Any

import requests
from dotenv import load_dotenv

from .base import EmailProvider

load_dotenv()

BASE_URL = "https://api.sendgrid.com/v3"


class SendGridProvider(EmailProvider):
    name = "sendgrid"

    def __init__(self) -> None:
        self.api_key = os.environ.get("SENDGRID_API_KEY")
        if not self.api_key:
            sys.exit("Error: SENDGRID_API_KEY not set")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def send(self, brief: dict[str, Any]) -> dict[str, Any]:
        to = brief.get("to", [])
        if isinstance(to, str):
            to = [to]
        if not to:
            sys.exit("Error: SendGrid requires 'to' (list of addresses) in brief")

        content: list[dict[str, str]] = []
        if brief.get("body_text"):
            content.append({"type": "text/plain", "value": brief["body_text"]})
        if brief.get("body_html"):
            content.append({"type": "text/html", "value": brief["body_html"]})
        if not content:
            sys.exit("Error: SendGrid requires 'body_html' or 'body_text' in brief")

        payload: dict[str, Any] = {
            "personalizations": [{"to": [{"email": e} for e in to]}],
            "from": {"email": brief["from_email"], "name": brief["from_name"]},
            "subject": brief["subject"],
            "content": content,
        }
        if brief.get("reply_to"):
            payload["reply_to"] = {"email": brief["reply_to"]}

        resp = requests.post(
            f"{BASE_URL}/mail/send", headers=self._headers(), json=payload, timeout=30
        )
        if resp.status_code == 202:
            print(f"  Accepted by SendGrid. {len(to)} recipient(s).")
            return {"status": "accepted", "recipient_count": len(to)}

        sys.exit(f"SendGrid error ({resp.status_code}): {resp.text}")
