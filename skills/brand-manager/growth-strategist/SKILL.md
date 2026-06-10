---
name: growth-strategist
description: Generate growth ideas and low-cost marketing approaches. Use for campaign ideation, growth planning, and free-tool strategy exploration.
---

# Growth Strategist

An exploratory strategy bundle for generating growth ideas and discovering low-cost tools without increasing spend.

## Overview

This skill combines two complementary approaches to marketing strategy:

1. **Marketing Ideas Generator** - Generates creative, categorized marketing campaign ideas based on your goals, target audience, and tone preferences
2. **Free Tools Discovery** - Recommends free marketing tools across social media, analytics, design, automation, content, and email categories

## Directory Structure

```
skills/brand-manager/growth-strategist/
├── input/          ← (optional) Place source files here before running
├── output/         ← Processed results appear here after running
├── scripts/
│   ├── strategy.py ← Entry point
│   └── tasks/      ← Task implementations
│       ├── ideas.py       ← Marketing ideas generator
│       └── freetools.py   ← Free tools discovery
├── config.json     ← Default parameters (overridable via CLI)
├── SKILL.md        ← This documentation
└── pyproject.toml  ← Python dependencies (managed by uv)
```

## How to Run

```bash
cd skills/brand-manager/growth-strategist
uv sync                              # install dependencies (first time only)
```

### Run Marketing Ideas Task

```bash
uv run python scripts/strategy.py ideas --goal brand_awareness --audience small_business --tone professional
```

### Run Free Tools Task

```bash
uv run python scripts/strategy.py freetools --categories social_media,analytics,design
```

## Task Descriptions

### `ideas` - Marketing Campaign Ideas Generator

Generates creative marketing campaign ideas tailored to your specific needs.

**Parameters:**
- `--goal` - Marketing objective (`brand_awareness`, `lead_generation`, `customer_engagement`, `product_launch`)
- `--audience` - Target audience (`small_business`, `enterprise`, `consumers`, `developers`)
- `--tone` - Communication style (`professional`, `casual`, `humorous`, `inspirational`)
- `--max-ideas` - Number of ideas to generate (default: 10)
- `--include-examples` - Include case study examples (default: true)

**Output:** Markdown-formatted campaign ideas with:
- Idea names and descriptions
- Customization guidance
- Audience relevance insights
- Recommended channels
- Effort and impact estimates
- Example case studies

### `freetools` - Free Marketing Tools Discovery

Discovers and recommends free marketing tools to enhance your strategies.

**Parameters:**
- `--categories` - Tool categories (comma-separated): `social_media`, `analytics`, `design`, `automation`, `content`, `email`
- `--output-format` - Output format (default: `markdown`)

**Output:** Markdown-formatted tool recommendations including:
- Top picks with ratings
- Tools grouped by category
- Features and free tier limits
- Best-use recommendations
- Free-to-paid upgrade paths
- Implementation tips

## Configuration

`config.json` holds default parameters. CLI flags always take precedence:

```json
{
  "input_dir": "./input",
  "output_dir": "./output",
  "task": "ideas",
  "marketing_goal": "brand_awareness",
  "target_audience": "small_business",
  "tone": "professional",
  "max_ideas": 10,
  "include_examples": true,
  "tools_categories": ["social_media", "analytics", "design", "automation"],
  "output_format": "markdown",
  "verbose": false
}
```

## Use Cases

### Quick Ideation Session

Need marketing ideas for a new product launch? Run:

```bash
uv run python scripts/strategy.py ideas --goal product_launch --audience consumers --max-ideas 15
```

### Free Tool Stack Builder

Looking to build a marketing toolkit without costs? Run:

```bash
uv run python scripts/strategy.py freetools --categories social_media,analytics,design,content,email
```

### Combine Tasks for Strategy Planning

```bash
# Generate ideas
uv run python scripts/strategy.py ideas --goal lead_generation --audience enterprise > output/ideas.md

# Discover tools
uv run python scripts/strategy.py freetools --categories automation,email > output/tools.md
```

## Ideas Categories

The `ideas` task supports 4 goal types, each with 5+ proven strategies:

- **Brand Awareness**: User-generated content, educational series, influencer partnerships
- **Lead Generation**: Free tools, webinars, gated content, interactive quizzes
- **Customer Engagement**: Social polls, customer spotlights, gamified loyalty
- **Product Launch**: Countdown campaigns, early bird access, beta tester programs

## Tool Categories

The `freetools` task covers 6 categories with top-rated free tools:

- **Social Media**: Buffer, Canva, Later, Hootsuite
- **Analytics**: Google Analytics, Search Console, Hotjar, Microsoft Clarity
- **Design**: Canva, GIMP, Inkscape, Figma
- **Automation**: Zapier, Make, n8n
- **Content**: Grammarly, Hemingway, Unsplash, Pexels
- **Email**: Mailchimp, MailerLite, Brevo

## Notes

- Both tasks output to `output/` directory by default
- Results are formatted in Markdown for easy sharing and documentation
- Free tiers of recommended tools are listed with limitations
- All tools are actively maintained and widely trusted in the industry

## License

MIT
