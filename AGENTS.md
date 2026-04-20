# Claw-Parade — Agent Guide

## Skill Directory Structure

Every media-processing skill lives under `skills/<skill-name>/` and follows this layout:

```
skills/<skill-name>/
├── input/          ← drop source media here before running
├── output/         ← processed results appear here after running
├── scripts/        ← Python entry-point(s)
├── config.json     ← default parameters (all overridable via CLI)
├── SKILL.md        ← human-readable description and usage examples
├── pyproject.toml  ← Python dependencies (managed by uv)
└── uv.lock
```

## How to Run a Skill

```bash
cd skills/<skill-name>
uv sync                              # install deps (first time only)
uv run python scripts/<script>.py   # uses config.json defaults
```

All scripts accept CLI flags that override any config key:

```bash
uv run python scripts/<script>.py \
  --input  ./input  \   # source directory
  --output ./output \   # destination directory
  --device cpu          # force CPU (skip GPU requirement)
```

## Input / Output Convention

- **`input/`** — place source files (images, videos, audio) here before running. The script scans this directory, processes every supported file, and writes nothing back to it.
- **`output/`** — results are written here. File names match the source file names unless the format changes (e.g. `.mp4` → `.mp4`, image → `.json` sidecar for `image-captioner`).
- Both directories must exist before running. They ship empty in the repo.

Supported extensions per skill are defined at the top of each script as `INPUT_EXTENSIONS` or `VIDEO_EXTENSIONS`.

## Config Pattern

`config.json` holds the default value for every parameter. CLI flags always take precedence. Internally the script merges CLI overrides into the config dict and passes a temp JSON file to `process()` — so `config.json` is never mutated at runtime.

Example `config.json`:
```json
{
  "input_dir":  "./input",
  "output_dir": "./output",
  "device":     "auto",
  "model":      "isnet-general-use"
}
```

`"device": "auto"` resolves to `"cuda"` when a CUDA GPU is available, otherwise `"cpu"`.

## Skills That Do Not Use input/ / output/

Two skills interact with external APIs rather than local files and have no `input/` or `output/` dirs:

| Skill | What it does |
|---|---|
| `post-scheduler` | Posts to Instagram / LinkedIn via Buffer GraphQL API |
| `social-analytics` | Fetches engagement analytics via SociaVault API |
| `canva-connector` | 23 tools for Canva design management via MCP |

One skill uses its own internal asset store instead:

| Skill | Storage |
|---|---|
| `brand-manager` | `brand-assets/` — stores logos, fonts, and a JSON manifest |

## GPU / CPU Notes

Every skill that touches ML accepts `--device cpu` to run without a GPU (speed varies). Skills that require a GPU hard-exit with a clear error message showing required vs. available VRAM. See `SKILLS.md` for per-skill VRAM requirements.

## Project-Level Directories

```
input/    ← raw inputs for the overall Abra pipeline (articles, notes, recordings)
output/   ← final pipeline outputs organised by channel (instagram/, linkedin/, twitter/)
skills/   ← all individual skill modules
```

These are separate from the per-skill `input/` and `output/` directories inside each skill folder.

## Environment Variables

Some skills require API keys or credentials:

| Variable | Required By | Where to Get |
|---------|-------------|--------------|
| `BUFFER_API_KEY` | `post-scheduler` | https://publish.buffer.com/settings/api |
| `SOCIAVAULT_API_KEY` | `social-analytics` | https://sociavault.com/dashboard |
| `BACKBLAZE_B2_*` | `post-scheduler` (video uploads) | Backblaze B2 dashboard |

Set via shell export or in `~/.openclaw/openclaw.json`:

```json
{
  "env": {
    "SOCIAVAULT_API_KEY": "sk_live_..."
  }
}
```
