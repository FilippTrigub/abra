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

---

## Strategic Branding Principles

These principles should be applied when running any task in this skill.

### Positioning: niche beats generic

Recognized niche expertise commands a premium. Generic positioning competes with everything; specific positioning competes with a smaller, more interested market. When building the product marketing context, push toward a specific claim rather than staying broad. Ask: what do we want to be known for in one sentence?

### Rule of One

Every piece of positioning should have one central idea — a single spear tip. When the message has too many benefits or angles, it becomes "toss-salad copy." Test the positioning: can you say it in one sentence? Does every bullet support the same claim? If not, cut until the core is clear.

A strong one-big-idea message must be:
- **Easy to understand** — the reader gets it immediately
- **Easy to believe** — credible, not gimmicky
- **Interesting or unique** — gives the reader a reason to care

### Interest stacking

A positioning document should capture a clear primary domain and 2–3 secondary interests that add human texture without diluting the core message. This prevents the brand from feeling robotic and creates more points of connection with the audience.

### Counterpositioning

Being intentionally different from the established competitor archetype is often more effective than outcompeting them head-on. When working on `position`, ask: what does the conventional player look like, and how can this brand be recognizably different? This can be stylistic (low-fi vs. polished), voice-based (honest vs. promotional), or claim-based (specific vs. broad).

### Brand levels and expectations

Define which level of personal brand the user actually needs before building strategy:

- **Level 1** — the brand supports existing work (consulting, coaching, services) but is not the main identity
- **Level 2** — the brand becomes part of the user's online and offline identity
- **Level 3** — the brand drives its own conversation and has reach beyond direct relationships

Tailor the positioning, content, and monetization recommendations to the right level.

### Monetization sequence

Trust must precede transactions. The recommended sequence is:

1. Contact info in bio (first monetization step)
2. Email list (second step — retains audience outside social platforms)
3. Services (natural extension of demonstrated expertise)
4. Low-ticket teaching products
5. Higher-ticket offers

Never recommend monetization steps before the trust foundations are in place.

### Persona development

When running `research`, extract personas with:
- Specific pain point (not "they're busy" but "they know they need to post but don't have time to turn useful calls into content")
- Trust drivers (what makes them believe an expert is credible)
- Objections (what makes them skeptical of offers like this)
- Alternative behaviors (what they do instead of solving the problem the right way)

### Pricing anchoring

When running `pricing`, anchor tiers to the concrete outcome rather than the feature list. A tier named "done-for-you" is weaker than one named by the result it delivers. Pricing should feel like a fair trade for a specific transformation, not a monthly SaaS fee.
