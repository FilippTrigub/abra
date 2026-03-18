---
name: post-scheduler
description: >-
  Schedule, create, and manage social media posts on Instagram and LinkedIn
  using the Buffer GraphQL API. Use when the user wants to publish content,
  schedule posts, check scheduled posts, list connected channels, or create
  content ideas on Buffer.
metadata:
  {
    "openclaw":
      {
        "emoji": "📲",
        "requires": { "bins": ["uv", "cloudflared"], "env": ["BUFFER_API_KEY"] },
        "primaryEnv": "BUFFER_API_KEY",
      },
  }
---

# buffer

Schedule, create, and manage social media posts on Instagram and LinkedIn via the Buffer GraphQL API.

## Setup

1. Go to https://publish.buffer.com/settings/api
2. Copy your access token
3. Set the environment variable:
   ```bash
   export BUFFER_API_KEY="your-access-token"
   ```
4. Install script dependencies:
   ```bash
   cd skills/buffer/scripts && uv sync
   ```

> **Note:** Buffer's API is in Beta. All operations use POST with a JSON body containing `query` (and optionally `variables`).

## Operations

All scripts are run from `skills/buffer/scripts/` with `uv run`.

### Get Organizations

Retrieve your organization IDs — needed for all other calls.

```bash
uv run organizations.py list
```

### List Channels

List connected channels for an organization.

```bash
uv run channels.py list --org-id ORG_ID
```

List only unlocked (active) channels:

```bash
uv run channels.py list --org-id ORG_ID --unlocked
```

### Get a Single Channel

```bash
uv run channels.py get --channel-id CHANNEL_ID
```

### Get Scheduled Posts

```bash
uv run posts.py list --org-id ORG_ID --status scheduled
```

Filter by channel and include asset details:

```bash
uv run posts.py list --org-id ORG_ID --status scheduled --channel-id CHANNEL_ID --with-assets
```

Paginate results:

```bash
uv run posts.py list --org-id ORG_ID --status scheduled --limit 10 --after CURSOR
```

### Get Sent Posts

```bash
uv run posts.py list --org-id ORG_ID --status sent
```

### Create Text Post

**Share now:**

```bash
uv run posts.py create --channel-id CHANNEL_ID --text "Your post text here" --mode shareNow
```

**Add to queue:**

```bash
uv run posts.py create --channel-id CHANNEL_ID --text "Queued post" --mode addToQueue
```

**Schedule for a specific time:**

```bash
uv run posts.py create --channel-id CHANNEL_ID --text "Scheduled post" \
  --mode customScheduled --due-at "2026-04-01T14:00:00Z"
```

### Create Image Post

Pass a local file path or a public HTTPS URL:

```bash
# Local file (served automatically via cloudflared tunnel)
uv run posts.py create --channel-id CHANNEL_ID --text "Check out this photo!" \
  --mode shareNow \
  --image-url path/to/photo.jpg

# Public URL
uv run posts.py create --channel-id CHANNEL_ID --text "Check out this photo!" \
  --mode shareNow \
  --image-url "https://example.com/photo.jpg"
```

Multiple images (carousel):

```bash
uv run posts.py create --channel-id CHANNEL_ID --text "Photo carousel" --mode shareNow \
  --image-url path/to/photo1.jpg \
  --image-url path/to/photo2.jpg
```

### Create Video Post

Use `--video-url` for video files.

> **Local video files do not work for scheduled posts.** Buffer stores the URL
> reference and fetches the video later — by which time the cloudflared tunnel
> is long gone. Local files via tunnel only work with `--mode shareNow` (Buffer
> publishes immediately while the tunnel is still alive).
>
> For any other mode (`customScheduled`, `addToQueue`, etc.) use a **persistent
> URL**: a Google Drive share link or a direct public HTTPS URL.

**Schedule with a persistent URL:**

```bash
# Google Drive share URL (auto-converted to direct download)
uv run posts.py create --channel-id CHANNEL_ID --text "Video caption" \
  --mode customScheduled --due-at "2026-04-01T12:00:00Z" \
  --video-url "https://drive.google.com/file/d/FILE_ID/view"

# Any public HTTPS URL
uv run posts.py create --channel-id CHANNEL_ID --text "Video caption" \
  --mode customScheduled --due-at "2026-04-01T12:00:00Z" \
  --video-url "https://example.com/video.mp4"
```

### Instagram-Specific Features

- **Post type** — `--ig-type`: `post` (default), `reel`, or `story`
- **First comment** — `--ig-first-comment TEXT`

Example — Instagram reel with first comment:

```bash
uv run posts.py create --channel-id IG_CHANNEL_ID \
  --text "Amazing reel!" \
  --mode customScheduled --due-at "2026-04-01T12:00:00Z" \
  --video-url "https://drive.google.com/file/d/FILE_ID/view" \
  --ig-type reel \
  --ig-first-comment "Follow for more!"
```

### LinkedIn-Specific Features

- **First comment** — `--li-first-comment TEXT`
- **Link attachment** — `--link-attachment URL`

Example — LinkedIn post with link attachment:

```bash
uv run posts.py create --channel-id LI_CHANNEL_ID \
  --text "Great article on AI trends" \
  --mode shareNow \
  --link-attachment "https://example.com/article" \
  --li-first-comment "What do you think?"
```

### Create Idea

Save content ideas to Buffer for later use.

```bash
uv run ideas.py create --org-id ORG_ID --title "Post idea title" --text "Draft content for the post..."
```

## Workflow Guidance

When the user asks to interact with Buffer, follow these steps:

1. **Fetch organizations** first to get the `organizationId`
2. **Fetch channels** and filter to only Instagram (`service: "instagram"`) and LinkedIn (`service: "linkedin"`)
3. **Confirm channel selection** with the user before posting
4. **Show post preview** — display the text, images, and scheduling details before submitting
5. **Report back** the post ID and status after creation

## Error Handling

GraphQL errors return in the `errors` array or as `MutationError` union types. Common errors:

- `NotFoundError` — Invalid org/channel/post ID
- `UnauthorizedError` — Bad or expired API key
- `InvalidInputError` — Malformed query or missing required fields
- `LimitReachedError` — Plan limits exceeded (e.g., too many scheduled posts)

Scripts exit with a non-zero code and print the error message to stderr on failure.

## Limitations

- Cannot edit or delete posts via the API
- TikTok channels are not supported (Instagram and LinkedIn only)
- The Buffer API is in Beta — endpoints may change
- Local file serving requires `cloudflared` to be installed and on PATH
- Local video files only work with `--mode shareNow` — scheduled/queued video posts require a persistent URL (Google Drive or public HTTPS)
