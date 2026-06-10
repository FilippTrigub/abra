---
name: remotion-video
description: >-
  Self-contained Remotion video renderer for one branded starter composition.
  Validates a versioned render spec, stages assets, renders an MP4 and
  thumbnail, and writes a machine-readable manifest.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎬",
        "requires": { "bins": ["python3", "uv", "node", "npm", "ffmpeg"] },
      },
  }
---

# remotion-video

## What it does

Renders one branded Remotion composition from a versioned render spec. It
validates the spec, stages assets in a temp directory, runs the local Node
renderer, then writes the MP4, thumbnail, and manifest to `output/`.

## Requires

- `python3`
- `uv`
- `node`
- `npm`
- `ffmpeg`
- Chrome Headless Shell, fetched by `npm run browser:ensure`
- No GPU required

## Layout

```
skills/remotion-video/
├── input/
├── output/
├── scripts/
├── remotion/
├── public/
├── schemas/
├── fixtures/
├── config.json
├── SKILL.md
├── pyproject.toml
├── uv.lock
├── package.json
└── package-lock.json
```

## Config pattern

`config.json` holds the default paths and contract versions. Future CLI flags
must override these values without mutating the file at runtime.

## Input contract

The default input spec is `input/render-spec.json`, or any file passed with
`--render-spec`.

The spec uses `render_spec_version: "1.0"` and requires these top-level
fields:

- `composition`
- `title`
- `duration_seconds`
- `fps`
- `width`
- `height`
- `background`
- `brand`
- `scenes`
- `assets`
- `output`

`assets.images`, `assets.videos`, `assets.audio`, and `assets.fonts` may be
present as typed arrays. Asset paths stay relative to the spec file.

Only one composition exists in v1: `branded-starter`.

The authoritative schema lives at `schemas/render-spec.v1.schema.json`.

## Output contract

The render writes portable artifacts to `output/`:

- MP4 video
- PNG thumbnail
- JSON manifest

The manifest uses `manifest_version: "1.0"` and requires these fields:

- `render_id`
- `composition`
- `video_path`
- `thumbnail_path`
- `duration_seconds`
- `fps`
- `width`
- `height`
- `created_at`
- `warnings`
- `source_spec_path`

The authoritative schema lives at `schemas/render-manifest.v1.schema.json`.

Manifest example:

```json
{
  "manifest_version": "1.0",
  "render_id": "launch-reel",
  "composition": "branded-starter",
  "video_path": "output/launch-reel.mp4",
  "thumbnail_path": "output/thumbnail.png",
  "duration_seconds": 12,
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "created_at": "2026-05-11T12:00:00Z",
  "warnings": [],
  "source_spec_path": "input/render-spec.json"
}
```

## Validation

Validate a checked-in fixture without rendering:

```bash
cd "$SKILL_DIR"
uv run python scripts/validate_contracts.py \
  --schema ./schemas/render-spec.v1.schema.json \
  --instance ./fixtures/render-spec.valid.json
```

Expected invalid-contract check:

```bash
cd "$SKILL_DIR"
uv run python scripts/validate_contracts.py \
  --schema ./schemas/render-spec.v1.schema.json \
  --instance ./fixtures/render-spec.invalid.missing-composition.json
```

## Runtime setup

Install the isolated Python and Node runtimes from inside this skill directory:

```bash
cd "$SKILL_DIR"
uv sync
npm ci
```

Ensure the browser runtime is present before rendering:

```bash
cd "$SKILL_DIR"
npm run browser:ensure
```

Run the full end to end render from the checked in fixture spec:

```bash
cd "$SKILL_DIR"
uv run python scripts/render.py --config config.json --render-spec fixtures/render-spec.valid.json
```

The same wrapper can render a real input spec with the default config:

```bash
cd "$SKILL_DIR"
uv run python scripts/render.py --config config.json
```

Helpful checks:

```bash
cd "$SKILL_DIR"
npm run typecheck
uv run python scripts/validate_contracts.py \
  --schema ./schemas/render-spec.v1.schema.json \
  --instance ./fixtures/render-spec.valid.json
```

Exact E2E test command:

```bash
cd tests && uv sync && uv run pytest test_remotion_video.py -v
```

The Node render script entry point is `npm run render -- --spec <path> --source-spec-path <path> --output-dir <dir> --video-path <path> --thumbnail-path <path> --manifest-path <path>`, but the Python wrapper is the supported E2E entry.

## Output

Downstream skills should consume only portable artifacts: the rendered MP4,
the thumbnail, and the machine-readable manifest. They should use
`source_spec_path` plus the artifact paths in the manifest, and they should not
depend on Remotion internals, React components, or temp staging paths.

## Scope boundary

- No workflow-runner integration is added in this phase.
- Only one branded starter contract is defined; there are no multiple
  composition schemas yet.
