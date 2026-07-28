"""Resend provider.

Direct sends use POST /emails (to: [...]).
Broadcast sends use POST /broadcasts + POST /broadcasts/{id}/send (requires segment_id).
"""

import os
import sys
from typing import Any

import requests
from dotenv import load_dotenv

from .base import EmailProvider

load_dotenv()

BASE_URL = "https://api.resend.com"


class ResendProvider(EmailProvider):
    name = "resend"

    def __init__(self) -> None:
        self.api_key = os.environ.get("RESEND_API_KEY")
        if not self.api_key:
            sys.exit("Error: RESEND_API_KEY not set")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "claw-parade-email-campaigner/1.0",
        }

    def send(self, brief: dict[str, Any]) -> dict[str, Any]:
        if brief.get("segment_id"):
            return self._send_broadcast(brief)
        if brief.get("to"):
            return self._send_direct(brief)
        sys.exit("Error: Resend requires 'to' (direct) or 'segment_id' (broadcast) in brief")

    def _send_direct(self, brief: dict[str, Any]) -> dict[str, Any]:
        to = brief["to"]
        if isinstance(to, str):
            to = [to]

        payload: dict[str, Any] = {
            "from": f"{brief['from_name']} <{brief['from_email']}>",
            "to": to,
            "subject": brief["subject"],
        }
        if brief.get("body_html"):
            payload["html"] = brief["body_html"]
        if brief.get("body_text"):
            payload["text"] = brief["body_text"]
        if brief.get("reply_to"):
            payload["reply_to"] = brief["reply_to"]
        if brief.get("tags"):
            payload["tags"] = [{"name": t, "value": "true"} for t in brief["tags"]]
        if brief.get("scheduled_at"):
            payload["scheduled_at"] = brief["scheduled_at"]

        resp = requests.post(f"{BASE_URL}/emails", headers=self._headers(), json=payload, timeout=30)
        result = resp.json()
        if resp.status_code not in (200, 201):
            sys.exit(f"Resend error: {result}")

        print(f"  Sent to {len(to)} recipient(s). ID: {result.get('id')}")
        return result

    def _send_broadcast(self, brief: dict[str, Any]) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "from": f"{brief['from_name']} <{brief['from_email']}>",
            "subject": brief["subject"],
            "name": brief.get("campaign_name") or brief["subject"],
            "segment_id": brief["segment_id"],
        }
        if brief.get("body_html"):
            payload["html"] = brief["body_html"]
        if brief.get("body_text"):
            payload["text"] = brief["body_text"]
        if brief.get("reply_to"):
            payload["reply_to"] = brief["reply_to"]

        create_resp = requests.post(
            f"{BASE_URL}/broadcasts", headers=self._headers(), json=payload, timeout=30
        )
        create_result = create_resp.json()
        if create_resp.status_code not in (200, 201):
            sys.exit(f"Resend broadcast create error: {create_result}")

        broadcast_id = create_result["id"]

        send_payload: dict[str, Any] = {}
        if brief.get("scheduled_at"):
            send_payload["scheduled_at"] = brief["scheduled_at"]

        send_resp = requests.post(
            f"{BASE_URL}/broadcasts/{broadcast_id}/send",
            headers=self._headers(),
            json=send_payload,
            timeout=30,
        )
        send_result = send_resp.json()
        if send_resp.status_code not in (200, 201):
            sys.exit(f"Resend broadcast send error: {send_result}")

        print(f"  Broadcast sent. ID: {broadcast_id}")
        return {"broadcast_id": broadcast_id, "send": send_result}
