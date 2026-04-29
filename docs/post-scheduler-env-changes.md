# Post-Scheduler Environment Variables — Change Summary

## Overview

This document summarizes the changes made to how the `post-scheduler` skill loads Backblaze B2 environment variables, and the new installer support for API-key-based skills.

---

## Changes Made

### 1. Removed Runtime Fallback to Skill-Local `.env`

**Before**: The skill would read B2 credentials from:
1. Direct environment variables
2. `skills/post-scheduler/.env` (skill-local fallback)

**After**: The skill now reads B2 credentials from:
1. Direct environment variables (`BACKBLAZE_B2_*`)
2. `BACKBLAZE_B2_ENV_FILE` pointing to a dotenv file

There is **no more runtime fallback** to `skills/post-scheduler/.env`.

### 2. Moved Backblaze Config File Location

**Before**: `~/.openclaw/workspace-abra/skills/post-scheduler/.env`

**After**: `~/.openclaw/post-scheduler-backblaze.env`

The installer writes credentials here and wires the path into `openclaw.json` via `env.BACKBLAZE_B2_ENV_FILE`.

### 3. Updated Installer (`installers/install-abra-on-openclaw.sh`)

The installer now:

- Writes Backblaze credentials to `~/.openclaw/post-scheduler-backblaze.env`
- Sets `env.BACKBLAZE_B2_ENV_FILE` in `~/.openclaw/openclaw.json`
- Migrates legacy workspace `.env` if present on reinstall
- Removes legacy file after migration

### 4. New API Key Installer Support

Added generic installer support for four API keys:

- `BUFFER_API_KEY` (post-scheduler)
- `GIPHY_API_KEY` (giphy)
- `FREESOUND_API_KEY` (freesound)
- `PIXABAY_API_KEY` (pixabay)

**Resolution order** (when running `./installers/install-abra-on-openclaw.sh`):

1. Shell environment variables
2. Existing `openclaw.json` `env` block values
3. Repo root `.env` file (as fallback default)
4. Interactive prompt (if stdin is a tty)

Values are then persisted into `~/.openclaw/openclaw.json` under `env`.

### 5. Added Backup File

Created `backblaze.backup.env` in repo root (gitignored) containing the original credentials for reference.

---

## Files Changed

| File | Change |
|------|--------|
| `skills/post-scheduler/scripts/video_staging.py` | Removed `_SKILL_ENV_PATH` fallback; added `_B2_ENV_FILE_VAR` and `_configured_b2_env_path()` |
| `tests/test_post_scheduler_video_staging.py` | Removed tests for skill-local `.env` fallback; updated tests for new env-file path |
| `installers/install-abra-on-openclaw.sh` | Added new helper functions, moved config file to `~/.openclaw/`, added API key installer support |
| `README.md` | Documented new config path, resolution order, and API key installer support |
| `SKILLS.md` | Updated skill summary with new secret loading behavior |
| `skills/post-scheduler/SKILL.md` | Updated setup instructions |
| `skills/giphy/SKILL.md` | Added installer note |
| `skills/freesound/SKILL.md` | Added installer note |
| `skills/pixabay/SKILL.md` | Added installer note |
| `.gitignore` | Added `backblaze.backup.env` |

---

## Recommended OpenClaw Config

```json5
{
  env: {
    BUFFER_API_KEY: "...",
    GIPHY_API_KEY: "...",
    FREESOUND_API_KEY: "...",
    PIXABAY_API_KEY: "...",
    BACKBLAZE_B2_ENV_FILE: "/home/node/.openclaw/post-scheduler-backblaze.env",
  },
}
```

---

## Resolution Order Summary

### Backblaze B2 Credentials
1. Direct `BACKBLAZE_B2_*` shell env vars
2. `BACKBLAZE_B2_ENV_FILE` (dotenv file)
3. (no fallback to skill-local `.env`)

### Installer API Keys (BUFFER, GIPHY, FREESOUND, PIXABAY)
1. Shell env vars
2. Existing `openclaw.json` `env` block
3. Repo root `.env` file
4. Interactive prompt (if tty)

---

## Migration Note

On reinstall, `installers/install-abra-on-openclaw.sh` will:
1. Migrate any existing `~/.openclaw/workspace-abra/skills/post-scheduler/.env` to `~/.openclaw/post-scheduler-backblaze.env`
2. Remove the legacy file
3. Wire `env.BACKBLAZE_B2_ENV_FILE` in `openclaw.json`
