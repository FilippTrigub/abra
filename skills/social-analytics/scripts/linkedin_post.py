"""Fetch LinkedIn post analytics for a given post URL."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sociavault_client import SociaVaultClient


def main():
    parser = argparse.ArgumentParser(
        description="Fetch LinkedIn post analytics for a given post URL"
    )
    parser.add_argument(
        "--url",
        required=True,
        help="LinkedIn post URL",
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

    # Fetch post
    try:
        client = SociaVaultClient()
        response = client.get_linkedin_post(url=args.url)

        # Prepare output
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_file = output_dir / f"linkedin_{args.url.split('/')[-1]}_{timestamp}.json"

        output_data = {
            "platform": "linkedin",
            "url": args.url,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "credits_used": response.get("creditsUsed", 1),
            "post": response.get("data", {}).get("success", {}),
        }

        # Write output
        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=2)

        post_info = output_data["post"]
        print(f"Successfully fetched post by {post_info.get('author', {}).get('name', 'Unknown')}")
        print(f"  Likes: {post_info.get('likeCount', 0)}")
        print(f"  Comments: {post_info.get('commentCount', 0)}")
        print(f"Output written to: {output_file}")

    except SystemExit:
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
