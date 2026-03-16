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
uv run python run.py --workflow <name> --input ./input
```

## Creative Workflows

### video-to-reel

Transform raw video into a branded reel.

```bash
uv run python run.py \
  --workflow video-to-reel \
  --input ./video.mp4
```

### image-to-post

Transform photos into a branded post.

```bash
uv run python run.py \
  --workflow image-to-post \
  --input ./photos/
```

### audio-to-post

Transform voice message into a text post.

```bash
uv run python run.py \
  --workflow audio-to-post \
  --input ./voice.m4a
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

## Default Behavior

- **Input**: Media is copied to `input/staging/` before processing
- **Archive**: After post is scheduled, input is moved to `archive/<workflow>/<timestamp>/`
- **Output**: Results go to `output/<workflow>/` by default
