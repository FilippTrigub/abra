---
name: seo-researcher
description: Research SEO opportunities through audits, keyword discovery, traffic validation, and site architecture analysis.
---

# SEO Researcher

SEO research and analysis bundle that performs audits, keyword discovery, programmatic SEO exploration, and site architecture analysis.

## Installation

```bash
cd skills/brand-manager/seo-researcher
uv sync
```

## Usage

All tasks share a common pattern. Run with:

```bash
uv run python scripts/run.mjs --task <task-name> [options]
```

### Available Tasks

| Task | marketingSkills Name | Description |
|------|---------------------|-------------|
| `audit` | `seo-audit` | Comprehensive SEO site audit |
| `aiseo` | `ai-seo` | AI-powered SEO content recommendations |
| `pseo` | `programmatic-seo` | Programmatic SEO cluster generation |
| `clusters` | `site-architecture` | Site architecture and clustering analysis |
| `competitors` | `competitor-alternatives` | Competitor alternative analysis |

### Task-Specific Options

#### SEO Audit (`audit`)

```bash
uv run python scripts/run.mjs --task audit --domain example.com
```

Options:
- `--domain <url>` - Target domain to audit (required)
- `--max-pages <number>` - Maximum pages to crawl (default: 100)
- `--include-sitemaps <boolean>` - Include sitemap analysis (default: true)
- `--include-robots <boolean>` - Include robots.txt analysis (default: true)

#### AI SEO (`aiseo`)

```bash
uv run python scripts/run.mjs --task aiseo --domain example.com --keywords "seo tools, marketing automation"
```

Options:
- `--domain <url>` - Target domain (required)
- `--keywords <comma-separated>` - Initial keyword list
- `--output-format <json|csv|markdown>` - Output format (default: json)
- `--include-suggestions <boolean>` - Include content suggestions (default: true)

#### Programmatic SEO (`pseo`)

```bash
uv run python scripts/run.mjs --task pseo --domain example.com --base-topic "seo audit"
```

Options:
- `--domain <url>` - Target domain (required)
- `--base-topic <string>` - Base topic for cluster generation
- `--cluster-count <number>` - Number of clusters to generate (default: 10)
- `--min-keyword-volume <number>` - Minimum keyword volume threshold

#### Site Architecture (`clusters`)

```bash
uv run python scripts/run.mjs --task clusters --domain example.com
```

Options:
- `--domain <url>` - Target domain (required)
- `--cluster-threshold <float>` - Similarity threshold for clustering (default: 0.7)
- `--include-sitemaps <boolean>` - Include sitemap data (default: true)
- `--max-clusters <number>` - Maximum number of clusters (default: 50)

#### Competitor Analysis (`competitors`)

```bash
uv run python scripts/run.mjs --task competitors --domain example.com --competitors competitor1.com,competitor2.com
```

Options:
- `--domain <url>` - Target domain (required)
- `--competitors <comma-separated>` - Competitor domains
- `--competitor-count <number>` - Auto-discover this many competitors (default: 5)
- `--analysis-depth <shallow|medium|deep>` - Analysis depth (default: medium)

## Input / Output

### Input Directory (`./input/`)

Drop any reference files here:
- `sitemap.xml` - Sitemap to analyze
- `keywords.txt` - Initial keyword list
- `competitors.txt` - Competitor domains list

### Output Directory (`./output/`)

Results are written here with task-specific naming:
- `seo-audit-<timestamp>.json` - Audit results
- `ai-seo-<timestamp>.json` - AI SEO recommendations
- `programmatic-seo-<timestamp>.json` - PSEO clusters
- `site-architecture-<timestamp>.json` - Architecture analysis
- `competitors-<timestamp>.json` - Competitor analysis

## Configuration

Edit `config.json` to set defaults:

```json
{
  "input_dir": "./input",
  "output_dir": "./output",
  "domain": "example.com",
  "marketingskills_api_key": "your-api-key",
  "seo_api_key": "your-api-key",
  "output_format": "json",
  "include_sitemaps": true,
  "include_robots": true,
  "max_pages": 100,
  "cluster_threshold": 0.7,
  "competitor_count": 5
}
```

CLI flags always override config.json values.

## Integration with marketingSkills

This bundle uses marketingSkills for:
- **SEO Audit**: Crawls site, analyzes on-page SEO, technical issues
- **AI SEO**: Generates content recommendations using AI
- **Programmatic SEO**: Creates keyword clusters for PSEO
- **Site Architecture**: Analyzes URL structure and internal linking
- **Competitor Analysis**: Compares against competitor sites

## Troubleshooting

### Missing API Keys

If you see authentication errors, ensure your API keys are set in `config.json` or as environment variables:
- `MARKETINGSKILLS_API_KEY`
- `SEO_API_KEY`

### Rate Limiting

If hitting rate limits, add delays between requests or reduce the `max_pages` parameter.

### Output Issues

Check that `./output/` directory exists and is writable. Create it if needed:
```bash
mkdir -p output
```
