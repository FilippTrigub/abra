#!/usr/bin/env python3
"""Email campaign execution — reads input/brief.json, sends via configured provider."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from providers import get_provider
from providers.dub import wrap_links


def load_brief(input_dir: Path) -> dict:
    brief_path = input_dir / "brief.json"
    if not brief_path.exists():
        sys.exit(
            f"Error: {brief_path} not found.\n"
            "Create a brief.json in your input directory. "
            "See input/brief.example.json for the format."
        )
    with open(brief_path) as f:
        return json.load(f)


def validate_brief(brief: dict) -> None:
    required = ["subject", "from_email", "from_name"]
    missing = [k for k in required if not brief.get(k)]
    if missing:
        sys.exit(f"Error: brief.json missing required fields: {', '.join(missing)}")

    has_recipients = (
        brief.get("to")
        or brief.get("audience_id")
        or brief.get("list_id")
        or brief.get("segment_id")
    )
    if not has_recipients:
        sys.exit(
            "Error: brief.json must include at least one of: "
            "'to', 'audience_id', 'list_id', 'segment_id'"
        )

    if not brief.get("body_html") and not brief.get("body_text"):
        sys.exit("Error: brief.json must include 'body_html' or 'body_text'")


def print_dry_run(brief: dict, provider_name: str) -> None:
    print(f"[dry-run] Provider:  {provider_name}")
    print(f"[dry-run] Campaign:  {brief.get('campaign_name', '(unnamed)')}")
    print(f"[dry-run] Subject:   {brief['subject']}")
    print(f"[dry-run] From:      {brief['from_name']} <{brief['from_email']}>")

    if brief.get("to"):
        recipients = brief["to"] if isinstance(brief["to"], list) else [brief["to"]]
        print(f"[dry-run] To:        {', '.join(recipients)}")
    elif brief.get("segment_id"):
        print(f"[dry-run] Segment:   {brief['segment_id']}")
    elif brief.get("list_id") or brief.get("audience_id"):
        print(f"[dry-run] List:      {brief.get('list_id') or brief.get('audience_id')}")

    if brief.get("track_links") and brief.get("cta_links"):
        print(f"[dry-run] Dub links: {brief['cta_links']}")
    if brief.get("scheduled_at"):
        print(f"[dry-run] Scheduled: {brief['scheduled_at']}")

    print("[dry-run] No email sent.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Execute an email campaign from a brief",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  uv run python scripts/campaign.py
  uv run python scripts/campaign.py --provider resend
  uv run python scripts/campaign.py --input ./input --output ./output --dry-run
        """,
    )
    parser.add_argument("--input", default="./input", help="Input directory (default: ./input)")
    parser.add_argument("--output", default="./output", help="Output directory (default: ./output)")
    parser.add_argument(
        "--provider",
        choices=["resend", "mailchimp", "sendgrid", "kit"],
        help="Force a specific provider (default: auto-detect from env)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate brief and print what would be sent, without sending",
    )
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    brief = load_brief(input_dir)
    validate_brief(brief)

    provider_name = args.provider or brief.get("provider")
    provider = get_provider(provider_name)

    if args.dry_run:
        print_dry_run(brief, provider.name)
        return

    brief, dub_links = wrap_links(brief)

    print(f"Sending via {provider.name}...")
    result = provider.send(brief)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report = {
        "campaign_name": brief.get("campaign_name", ""),
        "provider": provider.name,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "subject": brief["subject"],
        "from": f"{brief['from_name']} <{brief['from_email']}>",
        "result": result,
        "dub_links": dub_links,
    }

    report_path = output_dir / f"send-{timestamp}.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"Done. Report: {report_path}")


if __name__ == "__main__":
    main()
