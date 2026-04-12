---
name: funnel-optimizer
description: Optimize the full conversion funnel from page visit through signup, onboarding, experimentation, and retention. Use when improving conversion rates, reducing dropoff, or analyzing lifecycle performance.
metadata:
  version: 1.0.0
---

# Funnel Optimizer

A comprehensive suite of conversion optimization tools covering every stage of the user journey. This skill integrates six specialized analysis tasks:

1. **CRO (Page Conversion Rate Optimization)** — Analyze and optimize marketing pages (homepages, landing pages, pricing pages, feature pages, blog posts)
2. **Signup (Signup Flow CRO)** — Optimize signup, registration, and account creation flows to reduce friction and increase completions
3. **Onboarding (Post-Signup Onboarding CRO)** — Help users reach their "aha moment" quickly through optimized first-run experiences
4. **Form (Form CRO)** — Optimize non-signup forms (lead capture, contact forms, demo requests, applications, surveys, checkout forms)
5. **Experiment (A/B Test Setup)** — Design, plan, and implement statistically valid A/B tests and growth experiments
6. **Retention (Churn Prevention)** — Reduce voluntary and involuntary churn through cancel flows, save offers, and dunning strategies

## How to Run

```bash
cd skills/brand-manager/funnel-optimizer
uv sync                              # install deps (first time only)
uv run python scripts/run.mjs <task> # run a specific task
```

## Tasks

### cro
**Purpose:** Analyze marketing pages and provide actionable CRO recommendations.

**Use when:** Users want to optimize homepage, landing page, pricing page, feature page, or blog post conversions.

**Key Analysis Areas:**
- Value proposition clarity
- Headline effectiveness
- CTA placement, copy, and hierarchy
- Visual hierarchy and scannability
- Trust signals and social proof
- Objection handling
- Friction points

**Example:**
```bash
uv run python scripts/run.mjs cro --page https://example.com/pricing
```

### signup
**Purpose:** Optimize signup and registration flows to reduce dropoff and increase completions.

**Use when:** Users want to improve signup completion rates, reduce registration friction, or simplify account creation.

**Key Analysis Areas:**
- Field count and justification
- Field-by-field optimization
- Single-step vs. multi-step decisions
- Trust and friction reduction
- Mobile optimization
- Post-submit experience

**Example:**
```bash
uv run python scripts/run.mjs signup --flow signup-flow-v2
```

### onboarding
**Purpose:** Help users reach their "aha moment" quickly through optimized onboarding experiences.

**Use when:** Users are signing up but not activating, need help with empty states, or want to reduce time-to-value.

**Key Analysis Areas:**
- Activation definition and metrics
- Immediate post-signup experience
- Onboarding checklist design
- Empty states
- Tooltips and guided tours
- Multi-channel onboarding (email + in-app)
- Stalled user handling

**Example:**
```bash
uv run python scripts/run.mjs onboarding --activation "first_project_created"
```

### form
**Purpose:** Optimize non-signup forms (lead capture, contact forms, demo requests, applications, surveys, checkout forms).

**Use when:** Users want to improve form completion rates, reduce form friction, or optimize specific form types.

**Key Analysis Areas:**
- Field count and justification
- Field-by-field optimization
- Form layout (single vs. multi-column)
- Multi-step form design
- Error handling
- Submit button optimization
- Trust and friction reduction
- Mobile optimization

**Example:**
```bash
uv run python scripts/run.mjs form --type demo_request --form demo-request-v3
```

### experiment
**Purpose:** Design, plan, and implement statistically valid A/B tests and growth experiments.

**Use when:** Users want to test changes, build an experimentation program, or compare two approaches with data.

**Key Analysis Areas:**
- Hypothesis framing
- Test type selection (A/B, A/B/n, MVT, split URL)
- Sample size calculation
- Metrics selection (primary, secondary, guardrail)
- Variant design
- Traffic allocation
- Implementation approach (client-side vs. server-side)
- Result analysis and documentation

**Example:**
```bash
uv run python scripts/run.mjs experiment --hypothesis "New CTA increases signups by 15%" --baseline-conversion 0.03
```

### retention
**Purpose:** Reduce both voluntary churn (cancellations) and involuntary churn (payment failures).

**Use when:** Users are losing subscribers, need help with cancel flows, want to set up dunning, or need retention strategies.

**Key Analysis Areas:**
- Voluntary churn (cancel flows, exit surveys, dynamic save offers)
- Involuntary churn (payment recovery, dunning emails, smart retries)
- Churn prediction and proactive retention
- Risk signal detection
- Health score modeling
- Dunning stack setup
- Metrics and measurement

**Example:**
```bash
uv run python scripts/run.mjs retention --churn-rate 0.05 --billing-provider stripe
```

## Input / Output Convention

- **`input/`** — Place source files (page URLs, form data, signup flow screenshots, experiment results) here before running a task
- **`output/`** — Results appear here after running (analysis reports, recommendations, test designs, retention strategies)

## Configuration

All tasks respect the `config.json` defaults, which can be overridden via CLI flags:

- `--input` — Source directory (default: `./input`)
- `--output` — Destination directory (default: `./output`)
- `--device` — Force `cpu` or use `auto` detection for GPU
- Task-specific flags documented per task

## Related Skills

This bundle integrates concepts from:

| Skill | Integration |
|-------|-------------|
| **page-cro** | Base task for page-level conversion analysis |
| **signup-flow-cro** | Base task for signup flow optimization |
| **onboarding-cro** | Base task for post-signup activation |
| **form-cro** | Base task for non-signup form optimization |
| **ab-test-setup** | Base task for experiment design |
| **churn-prevention** | Base task for retention and cancel flows |
| **referral-program** | Complementary viral growth strategy |
| **email-sequence** | For onboarding and win-back sequences |
| **analytics-tracking** | For setting up event tracking |

## When to Use This Bundle

Use this bundle when you want to:

✅ Optimize conversions at any stage of the customer journey  
✅ Systematically analyze and improve dropoff points  
✅ Build a data-driven experimentation program  
✅ Reduce churn and improve retention  
✅ Get comprehensive, actionable recommendations  

## Example Workflow

```bash
# 1. Analyze landing page CRO
uv run python scripts/run.mjs cro --page https://example.com/pricing

# 2. Optimize the signup flow
uv run python scripts/run.mjs signup --flow signup-flow

# 3. Design A/B tests for key changes
uv run python scripts/run.mjs experiment --hypothesis "Remove phone field increases signups"

# 4. Set up retention for at-risk users
uv run python scripts/run.mjs retention --churn-rate 0.04 --billing stripe
```

## Task-Specific Questions

Each task will ask for context-specific information:

**CRO:** Conversion rate, traffic source, current analytics, user research data  
**Signup:** Completion rate, field-level analytics, data requirements, post-signup flow  
**Onboarding:** Activation definition, dropoff points, current post-signup experience  
**Form:** Completion rate, field-level analytics, submission follow-up, mobile split  
**Experiment:** Baseline conversion, traffic volume, change being tested, measurement tools  
**Retention:** Churn rate, billing provider, cancel flow status, payment recovery setup

---

## Quick Reference

| Task | Use For |
|------|---------|
| `cro` | Page-level CRO (homepage, landing, pricing, features) |
| `signup` | Signup/registration flow optimization |
| `onboarding` | Post-signup activation and first-run experience |
| `form` | Non-signup forms (lead capture, contact, demo, checkout) |
| `experiment` | A/B test design and experimentation program |
| `retention` | Churn prevention, cancel flows, payment recovery |
