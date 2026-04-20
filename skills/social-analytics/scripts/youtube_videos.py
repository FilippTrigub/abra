"""Fetch YouTube videos and analytics for a channel or video."""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sociavault_client import SociaVaultClient


def main():
    parser = argparse.ArgumentParser(
        description="Fetch YouTube videos and analytics for a channel or video"
    )
    parser.add_argument(
        "--channel-url",
        help="YouTube channel URL (e.g., https://youtube.com/@channel)",
    )
    parser.add_argument(
        "--video-url",
        help="YouTube video URL (alternative to channel-url)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="./output",
        help="Output directory for JSON results (default: ./output)",
    )

    args = parser.parse_args()

    if not args.channel_url and not args.video_url:
        print("Error: Either --channel-url or --video-url is required", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        client = SociaVaultClient()

        if args.channel_url:
            response = client.get_youtube_channel(channel_id=args.channel_url)
            identifier = args.channel_url.split("/")[-1]
        else:
            response = client.get_youtube_channel(channel_id=args.video_url)
            identifier = args.video_url.split("v=")[-1].split("&")[0]

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        output_file = output_dir / f"youtube_{identifier}_{timestamp}.json"

        output_data = {
            "platform": "youtube",
            "channel_url": args.channel_url,
            "video_url": args.video_url,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "credits_used": response.get("creditsUsed", 1),
            "videos": response.get("data", {}).get("items", []),
        }

        with open(output_file, "w") as f:
            json.dump(output_data, f, indent=2)

        print(f"Successfully fetched {len(output_data['videos'])} videos")
        print(f"Output written to: {output_file}")

    except SystemExit:
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
