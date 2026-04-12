---
name: ads-manager
description: Plan ads, generate ad creative, and configure paid acquisition measurement. Use for paid campaign setup and tracking.
---

# Ads Manager

A focused skill for managing paid marketing campaigns across ads planning, creative asset generation, and analytics/tracking configuration.

## Overview

This bundle integrates three core capabilities:

| Task | Description |
|------|-------------|
| `ads-plan` | Create, optimize, and manage advertising campaigns with current provider support centered on Google Ads |
| `creative` | Generate and optimize ad creative assets in multiple formats with AI enhancement |
| `tracking` | Configure analytics and conversion tracking for GA4, Google Ads, Meta Pixel, and LinkedIn Insight Tag |

## Installation

```bash
cd skills/ads-manager
uv sync  # Install dependencies from pyproject.toml
```

## Usage

### Run All Tasks

```bash
uv run node run.mjs --task <task-name> [options]
```

### Task: ads-plan

Create and manage advertising campaigns with automated budget allocation and audience targeting.

```bash
# Generate ads plan for Google Ads
uv run node run.mjs --task ads-plan --platform google-ads --budget 5000 --duration 30

# Google Ads campaign plan
uv run node run.mjs --task ads-plan --platform google-ads --budget 10000 --duration 45
```

**Options:**
- `--platform <platform>` - Ad platform (current provider connection: `google-ads`)
- `--budget <amount>` - Campaign budget. Default: from config
- `--duration <days>` - Campaign duration in days. Default: 30
- `--audience <json>` - Override audience targeting (JSON string)
- `--output <file>` - Output file for the plan. Default: `output/ads-plan.json`

**Output:** `output/ads-plan.json` - Complete campaign strategy with budget allocation, audience segments, and recommended ad groups.

### Task: creative

Generate ad creative assets in multiple formats with optional AI enhancement.

```bash
# Generate square creatives
uv run node run.mjs --task creative --format square --input ./input/images/

# Generate all formats with AI enhancement
uv run node run.mjs --task creative --format square,portrait,landscape --ai-enhance

# Use custom brand guidelines
uv run node run.mjs --task creative --brand-guidelines ./input/brand.json --templates product,testimonial
```

**Options:**
- `--format <formats>` - Output format(s) (square, portrait, landscape, story). Default: all formats
- `--input <dir>` - Input image directory. Default: `./input`
- `--output <dir>` - Output directory. Default: `./output`
- `--ai-enhance` - Enable AI-powered enhancement
- `--templates <list>` - Creative templates to use (product, testimonial, announcement, offer)
- `--brand-guidelines <file>` - Brand guidelines JSON file

**Output:** `output/creative/` - Generated creative assets in specified formats.

### Task: tracking

Set up analytics and conversion tracking across platforms.

```bash
# Configure GA4 tracking
uv run node run.mjs --task tracking --ga4-measurement-id G-XXXXXXXXXX

# Full tracking setup
uv run node run.mjs --task tracking \
  --ga4-measurement-id G-XXXXXXXXXX \
  --google-ads-conversion-id 123456789 \
  --google-ads-conversion-label ABC123defgh

# Generate tracking code snippets
uv run node run.mjs --task tracking --output-snippets --output-dir ./output/tracking-code
```

**Options:**
- `--ga4-measurement-id <id>` - GA4 Measurement ID (required if GA4 enabled)
- `--google-ads-conversion-id <id>` - Google Ads Conversion ID
- `--google-ads-conversion-label <label>` - Google Ads Conversion Label
- `--meta-pixel-id <id>` - Meta Pixel ID
- `--linkedin-tag-id <id>` - LinkedIn Insight Tag ID
- `--output-snippets` - Generate HTML/JS tracking code snippets
- `--output-dir <dir>` - Output directory for snippets. Default: `./output/tracking-code`
- `--dry-run` - Validate configuration without writing files

**Output:** `output/tracking-config.json` - Complete tracking configuration, optionally with HTML/JS snippets.

## Configuration

Edit `config.json` to set default values for all tasks:

```json
{
  "ads_plan": {
    "platforms": ["google-ads"],
    "default_budget": 5000,
    "target_audience": {
      "age_range": [25, 45],
      "interests": ["marketing"]
    }
  },
  "creative": {
    "formats": ["square", "portrait"],
    "ai_enhance": true
  },
  "tracking": {
    "ga4": {
      "enabled": true,
      "measurement_id": "G-XXXXXXXXXX"
    }
  }
}
```

## Dependencies

Core providers:
- `skills/_providers/marketing` - GA4 and Google Ads provider wrappers
- `dotenv` - Environment variable management
- `zod` - Configuration validation

## Integration

This bundle can be integrated into larger marketing automation workflows:

```bash
# Sequential execution
uv run node run.mjs --task ads-plan --platform google-ads
uv run node run.mjs --task creative --input ./output/ads-plan/ --format square
uv run node run.mjs --task tracking --ga4-measurement-id G-XXXXXX
```

## Troubleshooting

### Authentication Issues
Ensure environment variables are set for API access:
- `GA4_ACCESS_TOKEN` and `GA4_PROPERTY_ID`
- Google Ads environment variables required by the Google Ads wrapper

### Output Not Generated
- Check `./input` directory exists and contains required files
- Verify configuration in `config.json`
- Run with `--dry-run` to validate setup

## License

See project root LICENSE file.
