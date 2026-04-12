---
name: brand-strategist
description: Create foundational brand and product strategy including positioning, research, psychology, and pricing. Use when establishing brand context or making strategic brand decisions.
---

# Brand Strategist

Strategy bundle for brand and product positioning.

## Tasks

| Task | What it does |
|------|-------------|
| `position` | Create/update product marketing context document |
| `research` | Customer research and persona development |
| `psychology` | Marketing psychology application |
| `pricing` | Pricing strategy and tier structure |

## Usage

```bash
npm install
node scripts/run.mjs --task <task> --input ./input --output ./output
```

## Input

Place source materials in `input/`:
- Existing context files (`BRAND.md`, `.agents/product-marketing-context.md`)
- Notes, transcripts, survey results
- Package.json for auto-draft

## Output

Results written to `output/`:
- `product-marketing-context.md`
- `pricing-strategy.md`
- Research reports

## Context Sources

This skill references:
- `BRAND.md` (Abra brand)
- `.agents/product-marketing-context.md` (marketingskills context)

## Dependencies

No external CLI tools required for this bundle.
