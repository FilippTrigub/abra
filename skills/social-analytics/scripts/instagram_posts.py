"""Fetch Instagram posts and analytics for a given handle."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

# Import the client
from sociavault_client import SociaVaultClient


def main():
    parser = argparse.ArgumentParser(
        description="Fetch Instagram posts and analytics for a given handle"
    )
    parser.add_argument(
        "--handle",
        required=True,
        help="Instagram username (without @)",
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=50,
        help="Maximum posts to fetch (default: 50)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./output",
        help="Output directory for JSON results (default: ./output)",
    )

    args = parser.parse_args()

    # Create output directory if it doesn't exist
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Fetch posts
    try:
        client = SociaVaultClient()
        response = client.get_instagram_posts(
            handle=args.handle,
            max_results=args.max_results,
        )

        # Prepare output
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_file = output_dir / f"instagram_{args.handle}_{timestamp}.json"

        output_data = {
            "platform": "instagram",
            "handle": args.handle,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "credits_used": response.get("creditsUsed", 1),
            "posts": response.get("data", {}).get("items", []),
            "pagination": {
                "more_available": response.get("data", {}).get("more_available", False),
                "next_max_id": response.get("data", {}).get("next_max_id"),
            },
        }

        # Write output
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
