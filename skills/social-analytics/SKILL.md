---
name: social-analytics
description: >-
  Fetch analytics and performance metrics for your own social media posts
  across multiple platforms. Use when the user wants to see engagement data,
  views, likes, comments, or performance statistics for their Instagram,
  LinkedIn, TikTok, YouTube, Twitter/X, Facebook, Reddit, or Threads posts.
  This skill fetches publicly available analytics via the SociaVault API.
metadata:
  openclaw:
    emoji: 📊
    requires:
      bins: ["uv"]
      env:
        - SOCIAVAULT_API_KEY
    primaryEnv: SOCIAVAULT_API_KEY
---

# social-analytics

Fetch analytics for your own social media posts across Instagram, LinkedIn,
TikTok, YouTube, Twitter/X, Facebook, Reddit, and Threads via the SociaVault API.

## Setup

1. Get an API key from [SociaVault Dashboard](https://sociavault.com/dashboard)
2. Set your API key:

```bash
export SOCIAVAULT_API_KEY="sk_live_your_api_key_here"
```

Or add it to `~/.openclaw/openclaw.json`:

```json
{
  "env": {
    "SOCIAVAULT_API_KEY": "sk_live_your_api_key_here"
  }
}
```

3. Install dependencies:

```bash
cd skills/social-analytics && uv sync
```

## Platform Support

| Platform | What You Can Fetch | Input Required |
|----------|-------------------|----------------|
| Instagram | Posts, Reels with play_count, likes, comments | Handle (username) |
| LinkedIn | Individual posts with likeCount, commentCount | Post URL |
| TikTok | Posts with views, likes, comments | Handle (username) |
| YouTube | Videos with views, likes, comments | Channel URL or Video URL |
| Twitter/X | Tweets with likes, retweets, replies | Handle (username) |
| Facebook | Posts with likes, comments, shares | Page name or Post URL |
| Reddit | Posts with upvotes, comments | Username |
| Threads | Posts with likes, replies | Handle (username) |

## Operations

All commands run from `skills/social-analytics/`.

### Instagram Posts

Fetch all public posts for a handle:

```bash
uv run python scripts/instagram_posts.py --handle username --output ./output
```

Options:
- `--handle`: Instagram username (required)
- `--max-results`: Maximum posts to fetch (default: 50)
- `--output`: Output directory for JSON results (default: ./output)

Example:

```bash
uv run python scripts/instagram_posts.py --handle natgeo --output ./output
```

### LinkedIn Post

Fetch analytics for a single LinkedIn post:

```bash
uv run python scripts/linkedin_post.py --url "https://linkedin.com/posts/..." --output ./output
```

Options:
- `--url`: LinkedIn post URL (required)
- `--output`: Output directory for JSON results (default: ./output)

Example:

```bash
uv run python scripts/linkedin_post.py \
  --url "https://www.linkedin.com/posts/elonmusk/..." \
  --output ./output
```

### TikTok Posts

Fetch all public posts for a handle:

```bash
uv run python scripts/tiktok_posts.py --handle username --output ./output
```

Options:
- `--handle`: TikTok username (required)
- `--max-results`: Maximum posts to fetch (default: 50)
- `--output`: Output directory (default: ./output)

### YouTube Videos

Fetch videos from a channel:

```bash
uv run python scripts/youtube_videos.py --channel-url "https://youtube.com/@channel" --output ./output
```

Options:
- `--channel-url`: YouTube channel URL (required)
- `--video-url`: Single video URL (alternative to channel)
- `--output`: Output directory (default: ./output)

### Twitter/X Posts

Fetch posts from a handle:

```bash
uv run python scripts/twitter_posts.py --handle username --output ./output
```

Options:
- `--handle`: Twitter username (required, without @)
- `--max-results`: Maximum posts to fetch (default: 50)
- `--output`: Output directory (default: ./output)

### Facebook Posts

Fetch posts from a page:

```bash
uv run python scripts/facebook_posts.py --page-name page-name --output ./output
```

Options:
- `--page-name`: Facebook page name (required)
- `--post-url`: Single post URL (alternative to page)
- `--output`: Output directory (default: ./output)

### Reddit Posts

Fetch posts from a user:

```bash
uv run python scripts/reddit_posts.py --username username --output ./output
```

Options:
- `--username`: Reddit username (required)
- `--max-results`: Maximum posts to fetch (default: 50)
- `--output`: Output directory (default: ./output)

### Threads Posts

Fetch posts from a handle:

```bash
uv run python scripts/threads_posts.py --handle username --output ./output
```

Options:
- `--handle`: Threads username (required)
- `--max-results`: Maximum posts to fetch (default: 50)
- `--output`: Output directory (default: ./output)

## Output Format

All scripts output JSON files with the following structure:

```json
{
  "platform": "instagram",
  "handle": "username",
  "fetched_at": "2026-04-17T12:00:00Z",
  "posts": [
    {
      "id": "3824512658796290411",
      "url": "https://instagram.com/p/ABC123",
      "media_type": "video",
      "play_count": 100404,
      "like_count": 4500,
      "comment_count": 120,
      "caption": "Post text here",
      "created_at": "2025-10-15T12:00:00Z"
    }
  ],
  "credits_used": 1
}
```

## Credits

- **Cost**: 1 credit per request via SociaVault
- **Rate limits**: Script includes built-in delays between requests
- **Balance check**: Monitor your balance in the SociaVault dashboard

## Integration with post-scheduler

You can combine with the existing `post-scheduler` skill:

1. List sent posts from Buffer (which includes URLs)
2. Extract URLs for each platform
3. Fetch analytics for each URL
4. Output combined report with post text + engagement metrics

Example workflow:

```bash
# Get sent posts
uv run python skills/post-scheduler/scripts/posts.py list --org-id ORG_ID --status sent

# For each post URL, fetch analytics
uv run python skills/social-analytics/scripts/linkedin_post.py --url "POST_URL" --output ./analytics
```

## Limitations

- **Public content only**: Fetches only publicly available posts
- **No historical trending**: Returns current state only; trending requires polling
- **Platform-specific**: Not all platforms expose all metrics (e.g., LinkedIn doesn't expose link clicks)
- **Credit-based**: Each request costs 1 credit

## Troubleshooting

**Error: Invalid API key**
- Check that `SOCIAVAULT_API_KEY` is set correctly
- Verify the key starts with `sk_live_`
- Check your credit balance in the dashboard

**Error: User not found**
- Verify the handle/username is correct
- Ensure the account is public (not private)
- For LinkedIn, verify the post URL is accessible

**Error: Insufficient credits**
- Add credits via SociaVault dashboard
- Monitor usage in the dashboard

## Support

- **Documentation**: https://docs.sociavault.com
- **Email**: support@sociavault.com
- **Discord**: https://discord.gg/sociavault

## Related Skills

- `post-scheduler`: Create, schedule, and manage social media posts
- `social-content`: Generate and optimize social media content ideas

---

## What the Metrics Mean for Content Strategy

Raw engagement numbers mean little without interpretation. Use this guide when presenting analytics results to the user.

### Priority signal hierarchy

Rank these signals in this order when evaluating content performance:

1. **Dwell time / consumption rate** — did people actually read/watch to the end? This is the strongest signal that the content delivered real value. High views + low consumption = strong hook, weak body.

2. **Save rate** — saves indicate the viewer found the content reference-worthy. High saves on educational or how-to content signal a strong content pillar worth repeating.

3. **Comment / reaction ratio** — comments create secondary reach and indicate emotional resonance. A high reaction count with zero comments can mean the content felt complete but not discussion-worthy.

4. **Profile visits and connection/follow requests** — these indicate the post drove brand-level interest, not just content-level curiosity. A post that drives profile visits is working as a brand asset.

5. **Likes and raw view count** — useful as a baseline but not the best signal for brand-building. High views on a low-save post may indicate entertainment rather than expertise.

### Double-down logic

When a post significantly outperforms others on *save rate* and *profile visits*, it is a strong signal to:
- Repeat the content format (not necessarily the exact topic)
- Examine the hook and identify which archetype it used (see `visual-hook` skill)
- Extract the structural pattern and apply it to adjacent topics

Do not just repeat what performed well on likes. Save rate and profile visits are better indicators of brand-building value.

### Pattern identification questions

When reviewing analytics across several posts, ask:

- What format (video, carousel, image+text, text-only) has the highest average save rate?
- Which content pillar (educational, story, insight, conversion) drives the most profile visits?
- Are there posting days or times that correlate with higher engagement?
- Does a particular hook type (contrarian, teacher, investigator) outperform others in this account?

### LinkedIn-specific metrics

LinkedIn does not expose link clicks in public analytics. Prioritize:
- Comment volume (LinkedIn's algorithm heavily weights comments)
- Reaction diversity (not just likes — the other reactions signal stronger emotional response)
- Profile visits in the 24 hours after posting

### Instagram-specific metrics

Instagram Reels with high play_count but low comment_count suggest the content was viewed passively. Prioritize posts with both play_count and comment_count performing together — those indicate active engagement.

For carousels, a high reach combined with low saves suggests the hook worked but the content did not feel reference-worthy. Revisit the slide structure.
