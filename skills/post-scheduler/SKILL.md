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
        "requires":
          {
            "bins": ["uv", "cloudflared"],
            "env":
              [
                "BUFFER_API_KEY",
                "BACKBLAZE_B2_ENV_FILE",
                "BACKBLAZE_B2_KEY_ID",
                "BACKBLAZE_B2_APPLICATION_KEY",
                "BACKBLAZE_B2_BUCKET_ID",
                "BACKBLAZE_B2_BUCKET_NAME",
              ],
          },
        "primaryEnv": "BUFFER_API_KEY",
      },
  }
---

# post-scheduler

Schedule, create, and manage social media posts on Instagram and LinkedIn via the Buffer GraphQL API.

## Setup

1. Go to https://publish.buffer.com/settings/api
2. Copy your access token
3. Either run `./installers/install-abra-on-openclaw.sh` to persist `BUFFER_API_KEY` into
   `~/.openclaw/openclaw.json`, or set the environment variable manually:
   ```bash
   export BUFFER_API_KEY="your-access-token"
   ```
4. Install skill dependencies:
   ```bash
   cd skills/post-scheduler && uv sync
   ```

> **Note:** Buffer's API is in Beta. All operations use POST with a JSON body containing `query` (and optionally `variables`).

## Operations

All commands below are run from `skills/post-scheduler/`.

### Get Organizations

Retrieve your organization IDs — needed for all other calls.

```bash
uv run python scripts/organizations.py list
```

### List Channels

List connected channels for an organization.

```bash
uv run python scripts/channels.py list --org-id ORG_ID
```

List only unlocked (active) channels:

```bash
uv run python scripts/channels.py list --org-id ORG_ID --unlocked
```

### Get a Single Channel

```bash
uv run python scripts/channels.py get --channel-id CHANNEL_ID
```

### Get Scheduled Posts

```bash
uv run python scripts/posts.py list --org-id ORG_ID --status scheduled
```

Filter by channel and include asset details:

```bash
uv run python scripts/posts.py list --org-id ORG_ID --status scheduled --channel-id CHANNEL_ID --with-assets
```

Paginate results:

```bash
uv run python scripts/posts.py list --org-id ORG_ID --status scheduled --limit 10 --after CURSOR
```

### Get Sent Posts

```bash
uv run python scripts/posts.py list --org-id ORG_ID --status sent
```

### Create Text Post

**Share now:**

```bash
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Your post text here" --mode shareNow
```

**Add to queue:**

```bash
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Queued post" --mode addToQueue
```

**Schedule for a specific time:**

```bash
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Scheduled post" \
  --mode customScheduled --due-at "2026-04-01T14:00:00Z"
```

### Create Image Post

Pass a local file path or a public HTTPS URL:

```bash
# Local file (served automatically via cloudflared tunnel)
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Check out this photo!" \
  --mode shareNow \
  --image-url path/to/photo.jpg

# Public URL
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Check out this photo!" \
  --mode shareNow \
  --image-url "https://example.com/photo.jpg"
```

Multiple images (carousel):

```bash
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Photo carousel" --mode shareNow \
  --image-url path/to/photo1.jpg \
  --image-url path/to/photo2.jpg
```

### Create Video Post

Use `--video-url` for video files.

**Local `shareNow` video still uses cloudflared:**

```bash
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Publish right now" \
  --mode shareNow \
  --video-url path/to/video.mp4
```

**Local scheduled/queued video must be staged first:**

For local video files in `customScheduled`, `addToQueue`, `shareNext`, or
`recommendedTime`, pass `--video-staging-provider 0x0.st` or
`--video-staging-provider backblaze-b2`.

- Staged-upload providers currently supported: `0x0.st`, `backblaze-b2`
- Unknown retention is never allowed
- Retention must be known and strictly longer than `(due_at - now) + 12h`
- `0x0.st` is treated as having a known minimum retention of 30 days
- `backblaze-b2` assumes your bucket is `allPublic` and operator-managed to outlive the scheduling window
- If the due time is unknown, local scheduled/queued video staging is rejected

**Backblaze B2 env vars:**

- `BACKBLAZE_B2_KEY_ID`
- `BACKBLAZE_B2_APPLICATION_KEY`
- `BACKBLAZE_B2_BUCKET_ID`
- `BACKBLAZE_B2_BUCKET_NAME`
- optional pointer env: `BACKBLAZE_B2_ENV_FILE`

Recommended OpenClaw setup:

1. store the Backblaze values in a plain dotenv file next to your OpenClaw config:

```bash
~/.openclaw/post-scheduler-backblaze.env
```

2. point OpenClaw at that file via the config `env` block:

```json5
{
  env: {
    BACKBLAZE_B2_ENV_FILE: "/home/node/.openclaw/post-scheduler-backblaze.env",
  },
}
```

The runtime supports two credential sources:

1. export the four `BACKBLAZE_B2_*` vars in your shell
2. set `BACKBLAZE_B2_ENV_FILE=/absolute/path/to/backblaze-b2.env`

Resolution order is:

1. direct shell environment variables
2. `BACKBLAZE_B2_ENV_FILE`

If `BACKBLAZE_B2_ENV_FILE` is set, it must point to a readable dotenv file.

The scheduler uses the native B2 flow (`b2_authorize_account` →
`b2_get_upload_url` → upload file) and then constructs the stable public URL as
`https://.../file/<bucket-name>/<file-name>`. The bucket must already be public,
and any lifecycle/deletion policy is your responsibility.

The Backblaze credentials can be provided via normal shell environment
variables or a mounted dotenv file referenced by `BACKBLAZE_B2_ENV_FILE`.
Dotenv files must use plain dotenv syntax (`KEY=value`). `installers/install-abra-on-openclaw.sh` now
writes the recommended file beside `openclaw.json`, sets
`env.BACKBLAZE_B2_ENV_FILE`, persists `BUFFER_API_KEY` in `openclaw.json env`
when provided, and removes any old workspace-local `skills/post-scheduler/.env`
during reinstall. When resolving `BUFFER_API_KEY`, the installer uses shell env
first, existing OpenClaw config second, and the repo root `.env` as a fallback
default before prompting.

**Schedule a local video with staging:**

```bash
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Scheduled video" \
  --mode customScheduled --due-at "2026-04-01T12:00:00Z" \
  --video-url path/to/video.mp4 \
  --video-staging-provider backblaze-b2
```

`temp.sh` was tested and rejected for Buffer video scheduling because its returned
URL serves an HTML wrapper on `GET` and only returns the raw file on `POST`.
Buffer expects a direct video URL it can fetch with `GET`, so B2 is the cheapest
repo-supported provider that satisfies the requirement.

The B2 path was verified end-to-end with a scheduled Instagram Reel: local file →
B2 upload → Buffer scheduled post. One extra platform rule showed up during
verification: Instagram Reels require videos to be at least 3 seconds long. The
older `tests/fixtures/clip_5s.mp4` fixture is actually only 2 seconds, so it was
rejected until it was extended to a 4-second clip.

**Schedule with a persistent remote URL:**

```bash
# Google Drive share URL (auto-converted to direct download)
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Video caption" \
  --mode customScheduled --due-at "2026-04-01T12:00:00Z" \
  --video-url "https://drive.google.com/file/d/FILE_ID/view"

# Any public HTTPS URL
uv run python scripts/posts.py create --channel-id CHANNEL_ID --text "Video caption" \
  --mode customScheduled --due-at "2026-04-01T12:00:00Z" \
  --video-url "https://example.com/video.mp4"
```

### Instagram-Specific Features

- **Post type** — `--ig-type`: `post` (default), `reel`, or `story`
- **First comment** — `--ig-first-comment TEXT`

Example — Instagram reel with first comment:

```bash
uv run python scripts/posts.py create --channel-id IG_CHANNEL_ID \
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
uv run python scripts/posts.py create --channel-id LI_CHANNEL_ID \
  --text "Great article on AI trends" \
  --mode shareNow \
  --link-attachment "https://example.com/article" \
  --li-first-comment "What do you think?"
```

### Create Idea

Save content ideas to Buffer for later use.

```bash
uv run python scripts/ideas.py create --org-id ORG_ID --title "Post idea title" --text "Draft content for the post..."
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
- Local image files and local `shareNow` video files require `cloudflared`
- Local scheduled/queued video files require `--video-staging-provider 0x0.st` or `backblaze-b2`
- Local scheduled/queued video staging is rejected unless retention is known and strictly longer than `(due_at - now) + 12h`

---

## Platform Scheduling Strategy

### LinkedIn

**Optimal posting windows**: 9–11 am and 12–2 pm (audience's timezone).

**Weekly rhythm**:
- Tuesday and Thursday: story posts (personal journey, behind-the-scenes, honest reflection)
- Wednesday and Friday: educational posts (how-to, insight, framework)
- Sunday/Monday: use for planning and coming up with post ideas, not publishing

**Comment-first strategy**: Before publishing, spend time leaving comments on target creators' posts. This warms the account and signals activity to the algorithm. Responding to your own comments within the first 60 minutes after publishing amplifies reach.

**What LinkedIn penalizes** (suppress reach):
- External links in the post body — use the first comment for links instead
- Asking for reposts explicitly
- Sharing other people's posts too often
- Back-to-back posts in the same format
- Major edits after publication

**What LinkedIn rewards**:
- Dwell time (readers finishing the post)
- Saves
- Comments and reactions
- Profile visits from the post

### Instagram

**Post types and their roles**:
- Reels: best for reach; the opening 3 seconds determine everything
- Carousels: best for engagement and saves; first slide is the hook, second slide must immediately deliver value or the reader stops swiping
- Feed image: lowest reach but builds brand aesthetics
- Stories: conversational, ephemeral, behind-the-scenes

**Carousel structure**:
- Slide 1: hook / promise
- Slide 2: immediate payoff or tension (this is where readers decide to continue)
- Slides 3–5: examples, steps, or proof
- Final slide: takeaway or CTA

**Instagram avoids**:
- Overusing hashtags beyond the 3–5 most relevant
- Posting without a strong first-frame hook
- Long captions that open with "I" or a warm-up sentence

### Universal scheduling principle

Post consistently before trying to optimize posting times. Consistency in format and cadence builds audience recognition faster than finding the perfect hour. Data from `social-analytics` should guide time adjustments only after a baseline of consistent posting exists.
