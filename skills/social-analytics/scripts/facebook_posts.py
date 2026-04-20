"""Fetch Facebook posts and analytics for a page."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sociavault_client import SociaVaultClient


def main():
    parser = argparse.ArgumentParser(description="Fetch Facebook posts and analytics for a page")
    parser.add_argument(
        "--page-name",
        help="Facebook page name (e.g., natgeo)",
    )
    parser.add_argument(
        "--post-url",
        help="Facebook post URL (alternative to page-name)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./output",
        help="Output directory for JSON results (default: ./output)",
    )

    args = parser.parse_args()

    if not args.page_name and not args.post_url:
        print("Error: Either --page-name or --post-url is required", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        client = SociaVaultClient()

        if args.page_name:
            response = client.get_facebook_posts(page_id=args.page_name)
            identifier = args.page_name
        else:
            response = client.get_facebook_posts(page_id=args.post_url)
            identifier = args.post_url.split("/")[-1]

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_file = output_dir / f"facebook_{identifier}_{timestamp}.json"

        output_data = {
            "platform": "facebook",
            "page_name": args.page_name,
            "post_url": args.post_url,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "credits_used": response.get("creditsUsed", 1),
            "posts": response.get("data", {}).get("items", []),
        }

        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=2)

        print(f"Successfully fetched {len(output_data['posts'])} posts")
        print(f"Output written to: {output_file}")

    except SystemExit:
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
