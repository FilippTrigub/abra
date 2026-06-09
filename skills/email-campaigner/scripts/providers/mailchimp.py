"""Mailchimp provider.

Creates a campaign for the given list_id (audience_id), sets its content,
then sends it. Uses Basic Auth with anystring:API_KEY.
The datacenter prefix is extracted from the key (format: xxxx-us6) or
read from MAILCHIMP_SERVER_PREFIX.
"""

import os
import sys
from typing import Any

import requests
from dotenv import load_dotenv

from .base import EmailProvider

load_dotenv()


class MailchimpProvider(EmailProvider):
    name = "mailchimp"

    def __init__(self) -> None:
        self.api_key = os.environ.get("MAILCHIMP_API_KEY")
        if not self.api_key:
            sys.exit("Error: MAILCHIMP_API_KEY not set")

        server = os.environ.get("MAILCHIMP_SERVER_PREFIX")
        if not server:
            parts = self.api_key.rsplit("-", 1)
            if len(parts) == 2:
                server = parts[1]
            else:
                sys.exit(
                    "Error: MAILCHIMP_SERVER_PREFIX not set and cannot be derived from API key. "
                    "Expected key format: xxxx-us6"
                )
        self.base_url = f"https://{server}.api.mailchimp.com/3.0"
        self._auth = ("anystring", self.api_key)

    def send(self, brief: dict[str, Any]) -> dict[str, Any]:
        list_id = brief.get("list_id") or brief.get("audience_id")
        if not list_id:
            sys.exit("Error: Mailchimp requires 'list_id' or 'audience_id' in brief")
        return self._send_campaign(brief, list_id)

    def _send_campaign(self, brief: dict[str, Any], list_id: str) -> dict[str, Any]:
        campaign_payload: dict[str, Any] = {
            "type": "regular",
            "recipients": {"list_id": list_id},
            "settings": {
                "subject_line": brief["subject"],
                "from_name": brief["from_name"],
                "reply_to": brief.get("reply_to") or brief["from_email"],
            },
        }
        if brief.get("campaign_name"):
            campaign_payload["settings"]["title"] = brief["campaign_name"]

        create_resp = requests.post(
            f"{self.base_url}/campaigns",
            auth=self._auth,
            json=campaign_payload,
            timeout=30,
        )
        result = create_resp.json()
        if create_resp.status_code not in (200, 201):
            sys.exit(f"Mailchimp campaign create error: {result}")
        campaign_id = result["id"]

        content: dict[str, Any] = {}
        if brief.get("body_html"):
            content["html"] = brief["body_html"]
        if brief.get("body_text"):
            content["plain_text"] = brief["body_text"]

        if content:
            content_resp = requests.put(
                f"{self.base_url}/campaigns/{campaign_id}/content",
                auth=self._auth,
                json=content,
                timeout=30,
            )
            if content_resp.status_code not in (200, 201):
                sys.exit(f"Mailchimp content error: {content_resp.json()}")

        send_resp = requests.post(
            f"{self.base_url}/campaigns/{campaign_id}/actions/send",
            auth=self._auth,
            timeout=30,
        )
        if send_resp.status_code == 204:
            print(f"  Campaign sent. ID: {campaign_id}")
            return {"campaign_id": campaign_id, "status": "sent"}

        sys.exit(f"Mailchimp send error ({send_resp.status_code}): {send_resp.json()}")
