---
name: email-campaigner
description: Create and run email campaigns using the email providers that the workflow actually needs. Use for newsletters, nurture sequences, launch campaigns, promotional sends, and campaign link tracking.
---

# Email Campaigner

Focused email execution skill for campaign planning and send-ready email assets.

## Scope

This skill owns one job: building email campaigns.

It does not generate social content, publishing plans, or general content strategy.

## Task

| Task | Description | Input | Output |
|------|-------------|-------|--------|
| `email` | Build an email campaign or sequence | Campaign brief, audience notes, offer, messaging | Email sequence, subject lines, CTAs, test ideas |

## Providers

This skill is connected only to providers that are directly relevant to email execution:

- `resend`
- `mailchimp`
- `sendgrid`
- `kit`
- `dub`

## Usage

```bash
cd skills/email-campaigner
uv sync
# Copy and fill in the brief:
cp input/brief.example.json input/brief.json
# Then run:
uv run python scripts/campaign.py
```

With explicit provider or custom paths:

```bash
uv run python scripts/campaign.py --provider resend
uv run python scripts/campaign.py --input ./input --output ./output
uv run python scripts/campaign.py --dry-run
```

## Input

`input/brief.json` — see `input/brief.example.json` for the full field reference.

Required fields: `subject`, `from_name`, `from_email`, plus one of `to` / `list_id` / `audience_id` / `segment_id`, plus `body_html` or `body_text`.

## Output

`output/send-TIMESTAMP.json` — provider response, recipient count, and any Dub short-link mappings.

## Provider selection

If `provider` is not set in the brief and `--provider` is not passed, the first provider with a matching API key in the environment is used (priority: resend → mailchimp → sendgrid → kit).

## Environment variables

| Provider | Required | Optional |
|----------|----------|---------|
| Resend | `RESEND_API_KEY` | — |
| Mailchimp | `MAILCHIMP_API_KEY` | `MAILCHIMP_SERVER_PREFIX` (derived from key if absent) |
| SendGrid | `SENDGRID_API_KEY` | — |
| Kit | `KIT_API_SECRET` | `KIT_API_KEY` |
| Dub (link tracking) | `DUB_API_KEY` | `DUB_DOMAIN` |

## Kit limitation

Kit's v3 API creates broadcast drafts but has no programmatic send endpoint. After running, open the Kit dashboard to publish the broadcast. The broadcast ID is printed to stdout and included in the output report.

## Related Skills

- `brand-strategist` - positioning and message inputs
- `post-scheduler` - publishing remains separate
- `brand-manager` - brand asset management
