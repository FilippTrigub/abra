---
name: revenue-manager
description: "Manage revenue operations and CRM workflows including lead lifecycle, scoring, routing, pipeline configuration, handoff, enrichment, and community-led revenue motions."
metadata:
  version: 1.0.0
---

# Revenue Manager

Bundle with tasks: **revops**, **crm**

Source skills from: **marketingskills** (revops, community-marketing)

---

## Installation

```bash
cd skills/revenue-manager
uv sync                              # install dependencies (first time only)
```

## Usage

```bash
cd skills/revenue-manager
uv run run.mjs <command> [options]
```

### Commands

| Command | Description |
|---------|-------------|
| `revops` | Revenue operations task - lead lifecycle, scoring, routing, pipeline |
| `crm` | CRM configuration task - community marketing and ambassador programs |

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--input <dir>` | Input directory | `./input` |
| `--output <dir>` | Output directory | `./output` |
| `--device <type>` | Processing device: auto, cpu, cuda | `auto` |

### Examples

```bash
# Run RevOps task with defaults
uv run run.mjs revops

# Run with custom input/output
uv run run.mjs revops --input ./data --output ./results

# Run CRM (Community Marketing) task
uv run run.mjs crm --input ./input --output ./output
```

---

## Task: RevOps

Revenue operations task for lead lifecycle management, scoring, routing, and pipeline configuration.

### What It Generates

When you run `uv run run.mjs revops`, it creates these deliverables in the output directory:

1. **lifecycle-stage-definitions.md** - Stage definitions with entry/exit criteria, owners, and SLAs
2. **scoring-specification.md** - Fit and engagement attributes with point values and MQL threshold
3. **routing-rules.md** - Decision tree with assignment logic and fallbacks
4. **pipeline-configuration.md** - Stage definitions, required fields, and automation triggers
5. **metrics-dashboard-spec.md** - Key metrics, data sources, and target benchmarks

### RevOps Framework

#### Lead Lifecycle Stages

| Stage | Entry Criteria | Exit Criteria | Owner |
|-------|---------------|---------------|-------|
| Subscriber | Opts in to content | Provides company info or shows engagement | Marketing |
| Lead | Identified contact with basic info | Meets minimum fit criteria | Marketing |
| MQL | Passes fit + engagement threshold | Sales accepts or rejects within SLA | Marketing |
| SQL | Sales accepts and qualifies via conversation | Opportunity created or recycled | Sales (SDR/AE) |
| Opportunity | Budget, authority, need, timeline confirmed | Closed-won or closed-lost | Sales (AE) |
| Customer | Closed-won deal | Expands, renews, or churns | CS / Account Mgmt |
| Evangelist | High NPS, referral activity, case study | Ongoing program participation | CS / Marketing |

#### MQL Definition

An MQL requires both **fit** and **engagement**:
- **Fit score** — Does this person match your ICP? (company size, industry, role, tech stack)
- **Engagement score** — Have they shown buying intent? (pricing page, demo request, multiple visits)

#### Speed-to-Lead

- Contact within **5 minutes** = 21x more likely to qualify
- After **30 minutes**, conversion drops by 10x
- After **24 hours**, the lead is effectively cold

### Key Metrics

| Metric | Formula | Benchmark |
|--------|---------|-----------|
| Lead-to-MQL rate | MQLs / Total leads | 5-15% |
| MQL-to-SQL rate | SQLs / MQLs | 30-50% |
| SQL-to-Opportunity | Opportunities / SQLs | 50-70% |
| Speed-to-lead | Time from form fill to first rep contact | < 5 minutes ideal |
| Win rate | Closed-won / total opportunities | 20-30% |

---

## Task: CRM (Community Marketing)

Community marketing task for strategy, ambassador programs, and community-led growth.

### What It Generates

When you run `uv run run.mjs crm`, it creates these deliverables in the output directory:

1. **community-strategy.md** - Platform choice, identity definition, core loop, 90-day launch plan
2. **channel-architecture.md** - Recommended channels/categories with purpose and posting guidelines
3. **new-member-journey.md** - Welcome sequence: pinned post, DM template, first-week prompts
4. **community-ritual-calendar.md** - Weekly/monthly recurring events and threads
5. **ambassador-program-brief.md** - Criteria, benefits, outreach template, tracking plan
6. **community-health-audit.md** - Current metrics, diagnosis, top 3 priorities to fix

### Community Strategy Principles

#### Build around a shared identity, not just a product

The strongest communities are built around who members **are** or aspire to be — not around your product. Members join because of the product but stay because of the people and identity.

Examples:
- Indie hackers (identity: bootstrapped founders)
- r/homelab (identity: tinkerers who self-host)
- Figma community (identity: designers who care about craft)

#### Value must flow to members first

Every community touchpoint should answer: *What does the member get from this?*
- Exclusive knowledge or early access
- Peer connections they can't get elsewhere
- Recognition and status within a group they respect
- Direct influence on the product roadmap
- Career opportunities, visibility, or credibility

#### The Community Flywheel

```
Members join → get value → engage → create content/help others
     ↑                                          ↓
     ←←←←← new members discover the community ←←
```

### Platform Selection

| Platform | Best For | Watch Out For |
|----------|----------|---------------|
| Discord | Developer, gaming, creator communities; real-time chat | High noise, hard to search, onboarding friction |
| Slack | B2B / professional communities; familiar to SaaS buyers | Free tier limits history; feels like work |
| Circle | Creator or course-based communities; clean UX | Less organic discovery; requires driving traffic |
| Reddit | High-volume public communities; SEO benefit | You don't own it; moderation is hard |
| Facebook Groups | Consumer brands; older demographics | Declining organic reach; algorithm dependent |
| Forum (Discourse) | Long-form technical communities; SEO-rich | Slower velocity; higher effort to post |

### Community Health Metrics

Track these signals weekly:
- **DAU/MAU ratio** — Stickiness. Above 20% is healthy for most communities.
- **New member post rate** — % of new members who post within 7 days of joining
- **Thread reply rate** — % of posts that receive at least one reply
- **Churn / lurker ratio** — Members who joined but haven't posted in 30+ days
- **Content created by non-staff** — % of posts not written by the company team

**Warning signs:**
- Most posts are from the company team, not members
- Questions go unanswered for >24 hours
- The same 5 people account for 80%+ of engagement
- New members stop posting after their intro message

---

## Output Directory Structure

```
output/
├── revops/
│   ├── lifecycle-stage-definitions.md
│   ├── scoring-specification.md
│   ├── routing-rules.md
│   ├── pipeline-configuration.md
│   └── metrics-dashboard-spec.md
└── crm/
    ├── community-strategy.md
    ├── channel-architecture.md
    ├── new-member-journey.md
    ├── community-ritual-calendar.md
    ├── ambassador-program-brief.md
    └── community-health-audit.md
```

---

## Related Skills

- **revops** (source) — Lead lifecycle, scoring, routing, pipeline management
- **community-marketing** (source) — Community strategy, ambassador programs
- **sales-enablement** — Sales collateral, pitch decks, objection handling
- **analytics-tracking** — Event tracking and measurement
- **email-sequence** — Automated email flows for nurturing
- **cold-email** — B2B cold outreach emails

---

*Generated by Revenue Manager*
*Source: marketingskills (revops v1.1.0, community-marketing v1.0.0)*
