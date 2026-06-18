---
name: seo-researcher
description: Research SEO opportunities through audits, keyword discovery, traffic validation, and site architecture analysis.
---

# SEO Researcher

SEO research and analysis bundle that performs audits, keyword discovery, programmatic SEO exploration, and site architecture analysis. Each task calls real provider APIs directly (no input files are read) and writes a real JSON result to `./output/`.

## Providers

Each task calls a subset of these providers, wrapped per-call so a missing key degrades gracefully (see Troubleshooting) instead of failing the whole task:

- Google Search Console: `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REFRESH_TOKEN`
- Semrush: `SEMRUSH_API_KEY`
- Ahrefs: `AHREFS_API_KEY`
- DataForSEO: `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`
- Keywords Everywhere: `KEYWORDS_EVERYWHERE_API_KEY`
- Plausible: `PLAUSIBLE_API_KEY`, `PLAUSIBLE_SITE_ID`

At least one is required for any task to return real data; with none set, tasks still run and write output, but every `providers.*` entry will report `status: "unavailable"`.

## Usage

All tasks share a common pattern. Run with:

```bash
node scripts/run.mjs --task <task-name> [options]
```

### Available Tasks

| Task | Output `task` value | Description | Providers used |
|------|---------------------|-------------|-----------------|
| `audit` | `seo-audit` | Site audit | DataForSEO, Ahrefs, Semrush, GSC |
| `aiseo` | `ai-seo` | Keyword/content recommendations | GSC, Semrush, Ahrefs, Plausible |
| `pseo` | `programmatic-seo` | Keyword cluster generation | DataForSEO, Keywords Everywhere, Semrush, GSC, Ahrefs |
| `clusters` | `site-architecture` | Site architecture and clustering analysis | Ahrefs, GSC, DataForSEO |
| `competitors` | `competitor-alternatives` | Competitor discovery and overlap analysis | Semrush, DataForSEO, Ahrefs |

### Task-Specific Options

#### SEO Audit (`audit`)

```bash
node scripts/run.mjs --task audit --domain example.com
```

Options:
- `--domain <url>` - Target domain to audit (required)
- `--max-pages <number>` - Maximum pages to crawl (default: 100)
- `--include-sitemaps <boolean>` - Include sitemap analysis (default: true)
- `--include-robots <boolean>` - Include robots.txt analysis (default: true)

#### AI SEO (`aiseo`)

```bash
node scripts/run.mjs --task aiseo --domain example.com --keywords "seo tools, marketing automation"
```

Options:
- `--domain <url>` - Target domain (required)
- `--keywords <comma-separated>` - Initial keyword list
- `--output-format <json|csv|markdown>` - Output format (default: json)
- `--include-suggestions <boolean>` - Include content suggestions (default: true)

#### Programmatic SEO (`pseo`)

```bash
node scripts/run.mjs --task pseo --domain example.com --base-topic "seo audit"
```

Options:
- `--domain <url>` - Target domain (required)
- `--base-topic <string>` - Base topic for cluster generation
- `--cluster-count <number>` - Number of clusters to generate (default: 10)
- `--min-keyword-volume <number>` - Minimum keyword volume threshold

#### Site Architecture (`clusters`)

```bash
node scripts/run.mjs --task clusters --domain example.com
```

Options:
- `--domain <url>` - Target domain (required)
- `--cluster-threshold <float>` - Similarity threshold for clustering (default: 0.7)
- `--include-sitemaps <boolean>` - Include sitemap data (default: true)
- `--max-clusters <number>` - Maximum number of clusters (default: 50)

#### Competitor Analysis (`competitors`)

```bash
node scripts/run.mjs --task competitors --domain example.com --competitors competitor1.com,competitor2.com
```

Options:
- `--domain <url>` - Target domain (required)
- `--competitors <comma-separated>` - Competitor domains
- `--competitor-count <number>` - Auto-discover this many competitors (default: 5)
- `--analysis-depth <shallow|medium|deep>` - Analysis depth (default: medium)

## Input / Output

No task currently reads from `./input/` — all parameters are passed via CLI flags (`--domain`, `--keywords`, `--competitors`, etc.) or `config.json` defaults.

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
  "output_format": "json",
  "include_sitemaps": true,
  "include_robots": true,
  "max_pages": 100,
  "cluster_threshold": 0.7,
  "competitor_count": 5
}
```

Provider credentials are never read from `config.json` — they're read directly from the environment variables listed under Providers above. CLI flags always override config.json values.

## Provider Mapping

- **SEO Audit**: DataForSEO (on-page audit), Ahrefs (top pages), Semrush (domain overview), GSC (sitemaps)
- **AI SEO**: GSC (current rankings), Semrush (keyword opportunities), Ahrefs (content suggestions, top pages), Plausible (traffic validation)
- **Programmatic SEO**: DataForSEO + Keywords Everywhere (keyword candidates), Semrush (keyword relationships), GSC + Ahrefs (filters out keywords already ranked for)
- **Site Architecture**: Ahrefs (URL inventory), GSC (page list, sitemaps), DataForSEO (keyword-based content silos)
- **Competitor Analysis**: Semrush + DataForSEO (competitor discovery), DataForSEO (keyword overlap with named competitors), Ahrefs (domain authority comparison at `--analysis-depth deep`)

## Troubleshooting

### Missing API Keys

Each task calls every relevant provider independently and catches missing-credential errors per provider — a missing key never crashes the whole task. Check the `providers` object in the output JSON: each provider reports either `{ "status": "ok", "data": ... }` or `{ "status": "unavailable", "reason": "<which env var is missing>" }`. Set the corresponding environment variable from the Providers section above and re-run.

### Rate Limiting

If hitting rate limits, add delays between requests or reduce the `max_pages` parameter.

### Output Issues

Check that `./output/` directory exists and is writable. Create it if needed:
```bash
mkdir -p output
```
