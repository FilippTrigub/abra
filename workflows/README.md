# OpenClaw Workflows

Pre-configured workflows for common tasks.

## Structure

```
workflows/
├── creative/               # Content creation workflows
│   ├── video-to-reel/     # Video → branded reel
│   ├── image-to-post/     # Photos → branded post
│   └── audio-to-post/     # Voice → text post
├── brand/                  # Administrative workflows
│   └── brand-enrichment/ # Add content to brand knowledge
├── run.py                 # Workflow runner
└── pyproject.toml
```

## Usage

```bash
cd workflows
uv sync

# Run any workflow
uv run python run.py --workflow <name> --input ./input --channel-id CHANNEL_ID
```

Creative workflows that end in `post-scheduler` now merge scheduler defaults from
their workflow config with any CLI overrides you pass to `run.py`.

- `--channel-id` is required for scheduling workflows and must be a real Buffer
  channel ID
- `CLAW_DEFAULT_CHANNEL=instagram` is not enough for workflow scheduling because
  the scheduler expects an ID, not a platform name
- `--text` is optional; when omitted the runner derives text from prior workflow
  outputs (`caption` for image workflows, transcript segments for audio/video)
- `video-to-reel` defaults to `customScheduled`, `--ig-type reel`, and
  `--video-staging-provider backblaze-b2`, so local scheduled videos also need
  `--due-at`

## Creative Workflows

### video-to-reel

Transform raw video into a branded reel.

```bash
uv run python run.py \
  --workflow video-to-reel \
  --input ./video.mp4 \
  --channel-id CHANNEL_ID \
  --due-at 2026-04-01T12:00:00Z
```

### image-to-post

Transform photos into a branded post.

```bash
uv run python run.py \
  --workflow image-to-post \
  --input ./photos/ \
  --channel-id CHANNEL_ID
```

### audio-to-post

Transform voice message into a text post.

```bash
uv run python run.py \
  --workflow audio-to-post \
  --input ./voice.m4a \
  --channel-id CHANNEL_ID
```

## Brand Workflows

### brand-enrichment

Add new content to keep the brand knowledge fresh.

```bash
uv run python run.py \
  --workflow brand-enrichment \
  --input ./article.md
```

## Options

| Flag | Description |
|------|-------------|
| `--input, -i` | Input file or directory (required) |
| `--output, -o` | Output directory (default: `output/`) |
| `--skip-optional, -s` | Skip optional enhancement steps |
| `--device, -d` | Device: auto, cpu, cuda |
| `--no-archive` | Don't archive input after scheduling |
| `--channel-id` | Required scheduler override for workflows ending in `post-scheduler` |
| `--text` | Override derived scheduler text |
| `--mode`, `--due-at` | Override scheduler mode / schedule time |
| `--image-url`, `--video-url` | Override media path/URL passed to `post-scheduler create` |
| `--video-staging-provider` | Override local scheduled-video staging provider |
| `--ig-type`, `--ig-first-comment`, `--li-first-comment`, `--link-attachment` | Pass scheduler-specific social options through the runner |

## Default Behavior

- **Input**: Media is copied to `input/staging/` before processing
- **Archive**: After post is scheduled, input is moved to `archive/<workflow>/<timestamp>/`
- **Output**: Results go to `output/<workflow>/` by default
- **Scheduler adapter**: Non-scheduler skills still use the normal `--input/--output`
  chaining path, while `post-scheduler` is invoked via its native `create`
  command with workflow defaults plus CLI overrides
