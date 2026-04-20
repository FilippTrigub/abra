"""Fetch Reddit posts and analytics for a given username."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sociavault_client import SociaVaultClient


def main():
    parser = argparse.ArgumentParser(
        description="Fetch Reddit posts and analytics for a given username"
    )
    parser.add_argument(
        "--username",
        required=True,
        help="Reddit username",
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

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        client = SociaVaultClient()
        response = client.get_reddit_posts(
            username=args.username,
            max_results=args.max_results,
        )

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_file = output_dir / f"reddit_{args.username}_{timestamp}.json"

        output_data = {
            "platform": "reddit",
            "username": args.username,
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
