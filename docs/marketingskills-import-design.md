# Marketingskills Import Design

> Design for integrating `marketingskills` into Abra using a capsule-aligned approach.

---

## Problem Statement

The current schematic has two architectural problems:

1. **Empty capsules**: Bundle skills have no dedicated runtime, they just coordinate hidden docs. This contradicts Abra's capsule model where each skill is an isolated env with its own `scripts/`.

2. **Contradictory integration docs**: `marketingskills/tools/integrations/*.md` document APIs using curl commands, but the repo provides Node CLI tools under `tools/clis/*.js`. The CLIs should be canonical.

---

## Core Principles

### Capsule Model (Abra-style)

Every skill is a self-contained capsule with:

- Dedicated `scripts/` directory with its own entrypoints
- Isolated `input/` and `output/`
- Own `config.json` and `package.json`
- Independent runtime that can be invoked directly

Shared code is imported, not inherited.

### CLI-First Execution

Node CLIs are the canonical execution layer.

- Integration docs should reference existing CLIs, not curl
- Each bundle's scripts use CLIs where applicable
- Curl examples move to reference-only

---

## Revised Architecture

```
claw-parade/
├── skills/
│   ├── brand-strategist/
│   │   ├── input/
│   │   ├── output/
│   │   ├── scripts/
│   │   │   ├── run.mjs              # entrypoint
│   │   │   └── tasks/
│   │   │       ├── position.mjs
│   │   │       ├── research.mjs
│   │   │       └── pricing.mjs
│   │   ├── config.json
│   │   ├── SKILL.md
│   │   └── package.json
│   │
│   ├── email-campaigner/
│   │   ├── input/
│   │   ├── output/
│   │   ├── scripts/
│   │   │   ├── run.mjs
│   │   │   └── tasks/
│   │   │       ├── content-strategy.mjs
│   │   │       ├── copy.mjs
│   │   │       ├── social.mjs
│   │   │       ├── email.mjs
│   │   │       └── publish.mjs
│   │   ├── config.json
│   │   ├── SKILL.md
│   │   └── package.json
│   │
│   ├── seo-researcher/
│   │   ├── input/
│   │   ├── output/
│   │   ├── scripts/
│   │   │   ├── run.mjs
│   │   │   └── tasks/
│   │   │       ├── audit.mjs
│   │   │       ├── aiseo.mjs
│   │   │       ├── pseo.mjs
│   │   │       └── clusters.mjs
│   │   ├── config.json
│   │   ├── SKILL.md
│   │   └── package.json
│   │
│   ├── funnel-optimizer/
│   │   ├── input/
│   │   ├── output/
│   │   ├── scripts/
│   │   │   ├── run.mjs
│   │   │   └── tasks/
│   │   │       ├── cro.mjs
│   │   │       ├── signup.mjs
│   │   │       ├── onboarding.mjs
│   │   │       ├── form.mjs
│   │   │       ├── experiment.mjs
│   │   │       └── retention.mjs
│   │   ├── config.json
│   │   ├── SKILL.md
│   │   └── package.json
│   │
│   ├── ads-manager/
│   │   ├── input/
│   │   ├── output/
│   │   ├── scripts/
│   │   │   ├── run.mjs
│   │   │   └── tasks/
│   │   │       ├── ads-plan.mjs
│   │   │       ├── creative.mjs
│   │   │       └── tracking.mjs
│   │   ├── config.json
│   │   ├── SKILL.md
│   │   └── package.json
│   │
│   ├── revenue-manager/
│   │   ├── input/
│   │   ├── output/
│   │   ├── scripts/
│   │   │   ├── run.mjs
│   │   │   └── tasks/
│   │   │       ├── revops.mjs
│   │   │       └── crm.mjs
│   │   ├── config.json
│   │   ├── SKILL.md
│   │   └── package.json
│   │
│   └── growth-strategist/
│       ├── input/
│       ├── output/
│       ├── scripts/
│       │   ├── run.mjs
│       │   └── tasks/
│       │       ├── ideas.mjs
│       │       └── freetools.mjs
│       ├── config.json
│       ├── SKILL.md
│       └── package.json
│
├── lib/
│   └── marketing-cli/          # shared CLI wrapper library
│       ├── index.mjs           # exports all wrappers
│       ├── buffer.mjs           # buffer CLI wrapper
│       ├── ga4.mjs            # ga4 CLI wrapper
│       ├── google-ads.mjs       # google-ads CLI wrapper
│       └── [shared adapters]   # additional CLI wrappers as needed
│
└── marketing-registry/
    ├── bundles.json           # bundle inventory
    └── raw-skill-map.json   # maps task → source raw skill
```

---

## Bundle: Capsule Contract

Each bundle follows Abra's capsule model:

### Required files
```
bundle-skill/
├── input/         # source files
├── output/       # results written here
├── scripts/
│   ├── run.mjs   # main entrypoint
│   └── tasks/    # dedicated task scripts
├── config.json   # defaults
├── SKILL.md       # human-readable docs
└── package.json  # Node dependencies
```

### Execution pattern
```bash
cd skills/email-campaigner
npm install
node scripts/run.mjs --input ./input --output ./output
```

### CLI config override
```bash
node scripts/run.mjs --input ./input --output ./output --mode draft
```

---

## Bundle: Configuration

Each bundle has its own `config.json`:

```json
{
  "input_dir": "./input",
  "output_dir": "./output",
  "default_mode": "plan",
  "output_format": "markdown",
  "include_raw_skills": true,
  "allowed_tools": [],
  "enabled_tasks": ["content-strategy", "copy", "social"]
}
```

---

## Shared CLI Library

Create a shared library that bundle scripts import:

```text
lib/marketing-cli/
├── index.mjs        # exports all wrappers
├── buffer.mjs       # buffer CLI wrapper
├── ga4.mjs         # ga4 CLI wrapper
├── google-ads.mjs  # google-ads CLI wrapper
└── resend.mjs      # resend CLI wrapper
```

### Usage in bundle scripts
```javascript
import { runBuffer } from '../../lib/marketing-cli/buffer.mjs';

async function publishToBuffer(text, profileId) {
  return runBuffer(['update', text, `--profile=${profileId}`]);
}
```

---

## Raw Skills as Build-Time Only

During the build phase, raw skills are used as source material.

During the build step:
1. Extract relevant content from `marketingskills/skills/<skill>/SKILL.md`
2. Copy into bundle's `scripts/tasks/*.mjs` as inline or bundled modules
3. Bundle into a self-contained capsule

After the build:
- `marketingskills/` is deleted
- Bundle scripts contain all needed content inline
- No runtime file dependencies

---

## Integration Docs: Fix the Contradiction

The current `tools/integrations/*.md` documents curl.

Two options:

### Option A: Update existing docs (recommended)
Rewrite each integration doc to lead with CLI, deprioritize curl.

Structure:
```markdown
# Tool Name

## CLI (recommended)
\`\`\`bash
node tools/clis/tool-name.js <command>
\`\`\`

## API Reference
(curl examples moved here, marked as reference)
```

### Option B: Create CLI-first docs
Create new `tools/cli-guides/*.md` that lead with CLI.

---

## Execution Models

Bundle scripts have three execution modes:

### Mode 1: Strategy-only (default)
Reads inputs + raw skill docs → produces plans/briefs

No tool execution.

### Mode 2: Tool-assisted
Strategies + calls allowed Node CLIs where appropriate

Requires explicit enablement in config.

### Mode 3: Full execution
Strategies + CLIs + Abra-native skill chaining

Requires explicit enablement.

---

## Bundle Inventory

| Bundle | Primary task | Raw skills referenced | Tool dependencies |
|--------|-------------|----------------|---------------------|
| `brand-strategist` | positioning, ICP, pricing | 4 | optional |
| `email-campaigner` | email campaigns and sequences | 1 | resend, mailchimp, sendgrid, kit, dub |
| `seo-researcher` | SEO audit, pSEO, schema | 4 | gsc, semrush, ahrefs, dataforseo |
| `funnel-optimizer` | CRO, experiments, retention | 6 | ga4, mixpanel, hotjar, optimizely |
| `ads-manager` | paid planning, analytics | 3 | google-ads, ga4 |
| `revenue-manager` | CRM, revops, lead flow | 2 | hubspot, salesforce, outreach, apollo |
| `growth-strategist` | ideation, free tools | 2 | none |

---

## Import Priority

### Phase 1 (core)
- `brand-strategist`
- `email-campaigner`
- `seo-researcher`

### Phase 2 (growth)
- `funnel-optimizer`
- `ads-manager`

### Phase 3 (ops)
- `revenue-manager`
- `growth-strategist`

---

## Development vs Runtime

### Development-only (temporary)
These are needed only during the build/import phase:

- `marketingskills/` source repo
- Integration docs
- Tool registry
- CLI source files

### Runtime (permanent)
These must be present in Abra:

- `skills/marketing-*- each bundle` capsule skill with its own runtime
- `lib/marketing-cli/` shared CLI wrappers

---

## Workflow: Import → Delete

1. **Copy raw skill content** into each bundle's `scripts/tasks/*.mjs` as inline or bundled modules
2. **Copy CLI tools** needed by each bundle to `lib/marketing-cli/`
3. **Build** each bundle capsule locally
4. **Test** all bundles work without `marketingskills/` present
5. **Delete** the `marketingskills/` directory

After this workflow, no bundle references external paths.

---

## Key Design Rules

1. **Each bundle is a capsule**: own scripts, own input/output, own config
2. **Shared CLI library**: wrappers live in `lib/marketing-cli/`, imported by bundles
3. **No external runtime dependencies**: all content copied inline during build
4. **CLI-first docs**: integrations lead with Node CLIs
5. **Explicit enablement**: tool execution opt-in per config
6. **Self-contained builds**: verify bundles work without marketingskills/ present

---

## Open Questions

- How to handle CLI auth across bundles (per-bundle vs shared credentials)?
- Build verification test: should bundles require marketingskills/ to be deleted to pass?
