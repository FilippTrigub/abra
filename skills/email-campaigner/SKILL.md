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
uv run python scripts/run.mjs --task email
```

With custom output format:

```bash
uv run python scripts/run.mjs --task email --output json
```

## Configuration

```json
{
  "default_task": "email",
  "output_format": "markdown",
  "enabled_tasks": ["email"]
}
```

## Related Skills

- `brand-strategist` - positioning and message inputs
- `post-scheduler` - publishing remains separate
- `brand-manager` - brand asset management
