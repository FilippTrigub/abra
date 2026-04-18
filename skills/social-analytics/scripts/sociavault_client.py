"""Shared client for SociaVault API."""

import os
import sys
import time
from typing import Any

import requests
import dotenv

# Load environment variables from .env file if it exists
dotenv.load_dotenv()


class SociaVaultClient:
    """Client for SociaVault API."""

    BASE_URL = "https://api.sociavault.com"
    ENDPOINT = "/v1/scrape"

    def __init__(self, api_key: str | None = None, rate_limit_delay_ms: int = 500):
        """Initialize the client.

        Args:
            api_key: SociaVault API key. If not provided, uses SOCIAVAULT_API_KEY env var.
            rate_limit_delay_ms: Delay between requests in milliseconds.
        """
        self.api_key = api_key or os.environ.get("SOCIAVAULT_API_KEY")
        if not self.api_key:
            print(
                "Error: SOCIAVAULT_API_KEY environment variable is not set.",
                file=sys.stderr,
            )
            print(
                "Get your key from https://sociavault.com/dashboard",
                file=sys.stderr,
            )
            sys.exit(1)

        self.rate_limit_delay_ms = rate_limit_delay_ms
        self._last_request_time = 0

    def _apply_rate_limit(self):
        """Apply rate limiting between requests."""
        now = time.time() * 1000  # Convert to milliseconds
        elapsed = now - self._last_request_time
        if elapsed < self.rate_limit_delay_ms:
            time.sleep((self.rate_limit_delay_ms - elapsed) / 1000)
        self._last_request_time = time.time() * 1000

    def _request(self, endpoint: str, params: dict | None = None) -> dict[str, Any]:
        """Make a request to SociaVault API.

        Args:
            endpoint: API endpoint (e.g., '/instagram/posts')
            params: Query parameters

        Returns:
            API response as dictionary

        Raises:
            SystemExit: If API key is invalid or insufficient credits
        """
        self._apply_rate_limit()

        url = f"{self.BASE_URL}{self.ENDPOINT}{endpoint}"
        headers = {
            "X-API-Key": self.api_key,
        }

        response = requests.get(url, params=params, headers=headers, timeout=30)

        if response.status_code == 401:
            print("Error: Invalid API key. Please check your SOCIAVAULT_API_KEY.", file=sys.stderr)
            sys.exit(1)
        elif response.status_code == 402:
            error_data = response.json()
            print(f"Error: {error_data.get('error', 'Insufficient credits')}", file=sys.stderr)
            print(f"Required: {error_data.get('required', 'unknown')} credits", file=sys.stderr)
            print(f"Available: {error_data.get('available', 0)} credits", file=sys.stderr)
            sys.exit(1)
        elif not response.ok:
            print(f"HTTP {response.status_code}: {response.text[:500]}", file=sys.stderr)
            sys.exit(1)

        data = response.json()
        if not data.get("success"):
            print(f"API error: {data.get('error', 'Unknown error')}", file=sys.stderr)
            sys.exit(1)

        return data

    def get_instagram_posts(
        self,
        handle: str,
        max_results: int = 50,
        next_max_id: str | None = None,
    ) -> dict[str, Any]:
        """Fetch Instagram posts for a handle.

        Args:
            handle: Instagram username
            max_results: Maximum posts to fetch (default: 50)
            next_max_id: Cursor for pagination

        Returns:
            Response dict with posts data
        """
        params = {"handle": handle}
        if max_results:
            params["trim"] = True
        if next_max_id:
            params["next_max_id"] = next_max_id

        return self._request("/instagram/posts", params)

    def get_linkedin_post(self, url: str) -> dict[str, Any]:
        """Fetch LinkedIn post analytics.

        Args:
            url: LinkedIn post URL

        Returns:
            Response dict with post data
        """
        return self._request("/linkedin/post", {"url": url})

    def get_tiktok_posts(
        self,
        handle: str,
        max_results: int = 50,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        """Fetch TikTok posts for a handle.

        Args:
            handle: TikTok username
            max_results: Maximum posts to fetch (default: 50)
            cursor: Cursor for pagination

        Returns:
            Response dict with posts data
        """
        params = {"handle": handle}
        if cursor:
            params["cursor"] = cursor
        return self._request("/tiktok/user", params)

    def get_youtube_channel(
        self,
        channel_id: str,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        """Fetch YouTube videos from a channel.

        Args:
            channel_id: YouTube channel ID or URL
            cursor: Cursor for pagination

        Returns:
            Response dict with videos data
        """
        params = {"channel_id": channel_id}
        if cursor:
            params["cursor"] = cursor
        return self._request("/youtube/channel", params)

    def get_twitter_posts(
        self,
        handle: str,
        max_results: int = 50,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        """Fetch Twitter/X posts for a handle.

        Args:
            handle: Twitter username (without @)
            max_results: Maximum posts to fetch (default: 50)
            cursor: Cursor for pagination

        Returns:
            Response dict with posts data
        """
        params = {"handle": handle}
        if cursor:
            params["cursor"] = cursor
        return self._request("/twitter/user", params)

    def get_facebook_posts(
        self,
        page_id: str,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        """Fetch Facebook posts from a page.

        Args:
            page_id: Facebook page ID or name
            cursor: Cursor for pagination

        Returns:
            Response dict with posts data
        """
        params = {"page_id": page_id}
        if cursor:
            params["cursor"] = cursor
        return self._request("/facebook/page", params)

    def get_reddit_posts(
        self,
        username: str,
        max_results: int = 50,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        """Fetch Reddit posts from a user.

        Args:
            username: Reddit username
            max_results: Maximum posts to fetch (default: 50)
            cursor: Cursor for pagination

        Returns:
            Response dict with posts data
        """
        params = {"username": username}
        if cursor:
            params["cursor"] = cursor
        return self._request("/reddit/user", params)

    def get_threads_posts(
        self,
        handle: str,
        max_results: int = 50,
        cursor: str | None = None,
    ) -> dict[str, Any]:
        """Fetch Threads posts for a handle.

        Args:
            handle: Threads username
            max_results: Maximum posts to fetch (default: 50)
            cursor: Cursor for pagination

        Returns:
            Response dict with posts data
        """
        params = {"handle": handle}
        if cursor:
            params["cursor"] = cursor
        return self._request("/threads/user", params)
