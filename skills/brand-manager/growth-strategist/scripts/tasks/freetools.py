from __future__ import annotations

from pathlib import Path

FREE_TOOLS: dict[str, list[dict]] = {
    "social_media": [
        {
            "name": "Buffer",
            "features": ["Schedule posts", "Analytics", "Team collaboration"],
            "free_tier": "3 channels, 10 scheduled posts per channel",
            "best_for": "Small businesses starting with social media",
            "url": "https://buffer.com",
            "rating": 4.5,
        },
        {
            "name": "Canva",
            "features": ["Design templates", "Brand kit", "Content calendar"],
            "free_tier": "Unlimited designs, 5GB storage",
            "best_for": "Creating professional social media graphics",
            "url": "https://canva.com",
            "rating": 4.7,
        },
        {
            "name": "Later",
            "features": ["Visual calendar", "Link in bio", "User-generated content"],
            "free_tier": "5 posts per platform per month",
            "best_for": "Instagram-focused marketing",
            "url": "https://later.com",
            "rating": 4.3,
        },
        {
            "name": "Hootsuite",
            "features": ["Multi-platform scheduling", "Social listening", "Reports"],
            "free_tier": "2 social accounts, 5 scheduled posts",
            "best_for": "Managing multiple social accounts",
            "url": "https://hootsuite.com",
            "rating": 4.2,
        },
    ],
    "analytics": [
        {
            "name": "Google Analytics",
            "features": ["Traffic analysis", "User behavior", "Conversion tracking"],
            "free_tier": "Unlimited data collection",
            "best_for": "Comprehensive website analytics",
            "url": "https://analytics.google.com",
            "rating": 4.6,
        },
        {
            "name": "Google Search Console",
            "features": ["SEO monitoring", "Keyword rankings", "Index coverage"],
            "free_tier": "Unlimited",
            "best_for": "Understanding search engine performance",
            "url": "https://searchconsole.google.com",
            "rating": 4.5,
        },
        {
            "name": "Hotjar",
            "features": ["Heatmaps", "Session recordings", "Feedback polls"],
            "free_tier": "100 pageviews/day, 3 heatmaps",
            "best_for": "Understanding user behavior on site",
            "url": "https://hotjar.com",
            "rating": 4.4,
        },
        {
            "name": "Microsoft Clarity",
            "features": ["Heatmaps", "Session recordings", "Duration filtering"],
            "free_tier": "Unlimited",
            "best_for": "Complementary analytics to Google Analytics",
            "url": "https://clarity.microsoft.com",
            "rating": 4.3,
        },
    ],
    "design": [
        {
            "name": "Canva",
            "features": ["Templates", "Brand kit", "Resize tool"],
            "free_tier": "Unlimited designs, 5GB storage",
            "best_for": "All-in-one design platform",
            "url": "https://canva.com",
            "rating": 4.7,
        },
        {
            "name": "GIMP",
            "features": ["Photo editing", "Retouching", "Custom workflows"],
            "free_tier": "Full featured, open source",
            "best_for": "Advanced image editing without cost",
            "url": "https://gimp.org",
            "rating": 4.1,
        },
        {
            "name": "Figma",
            "features": ["UI/UX design", "Prototyping", "Team collaboration"],
            "free_tier": "3 projects, unlimited files",
            "best_for": "Web and app design collaboration",
            "url": "https://figma.com",
            "rating": 4.8,
        },
    ],
    "automation": [
        {
            "name": "Zapier",
            "features": ["Workflow automation", "App integrations", "Multi-step zaps"],
            "free_tier": "100 tasks/month, 5 zaps",
            "best_for": "Connecting apps without coding",
            "url": "https://zapier.com",
            "rating": 4.6,
        },
        {
            "name": "Make (Integromat)",
            "features": ["Visual automation", "Complex workflows", "Error handling"],
            "free_tier": "1,000 operations/month",
            "best_for": "Complex automation scenarios",
            "url": "https://make.com",
            "rating": 4.5,
        },
        {
            "name": "n8n",
            "features": ["Self-hostable", "Node-based workflow", "Custom code"],
            "free_tier": "Free for self-hosted",
            "best_for": "Technical teams wanting full control",
            "url": "https://n8n.io",
            "rating": 4.4,
        },
    ],
    "content": [
        {
            "name": "Grammarly",
            "features": ["Grammar checking", "Tone detection", "Plagiarism detection"],
            "free_tier": "Basic grammar and spelling",
            "best_for": "Improving writing quality",
            "url": "https://grammarly.com",
            "rating": 4.6,
        },
        {
            "name": "Unsplash",
            "features": ["Free stock photos", "High-resolution images", "Commercial use allowed"],
            "free_tier": "Unlimited free downloads",
            "best_for": "Finding professional-quality images",
            "url": "https://unsplash.com",
            "rating": 4.8,
        },
        {
            "name": "Pexels",
            "features": ["Free stock photos & videos", "No attribution required", "Commercial use"],
            "free_tier": "Unlimited free downloads",
            "best_for": "Video and image content creation",
            "url": "https://pexels.com",
            "rating": 4.7,
        },
    ],
    "email": [
        {
            "name": "Mailchimp",
            "features": ["Email campaigns", "Audience management", "Marketing automation"],
            "free_tier": "Up to 500 contacts, 1,000 sends/month",
            "best_for": "Email marketing beginners",
            "url": "https://mailchimp.com",
            "rating": 4.3,
        },
        {
            "name": "MailerLite",
            "features": ["Drag-and-drop builder", "Automation workflows", "Landing pages"],
            "free_tier": "Up to 1,000 subscribers, 12,000 emails/month",
            "best_for": "Cost-effective email marketing",
            "url": "https://mailerlite.com",
            "rating": 4.5,
        },
        {
            "name": "Brevo",
            "features": ["Email campaigns", "Transactional emails", "SMS marketing"],
            "free_tier": "Unlimited contacts, 300 emails/day",
            "best_for": "Marketing automation on a budget",
            "url": "https://brevo.com",
            "rating": 4.3,
        },
    ],
}


def run(config: dict) -> None:
    output_path = Path(config.get("output_dir", "./output"))
    output_path.mkdir(parents=True, exist_ok=True)

    categories = config.get("tools_categories", ["social_media", "analytics", "design", "automation"])

    print(f"Discovering free marketing tools for categories: {', '.join(categories)}...")

    all_tools = []
    tools_by_category: dict[str, list[dict]] = {}
    for category in categories:
        tools = FREE_TOOLS.get(category, [])
        if tools:
            tools_by_category[category] = tools
            all_tools.extend([{**t, "category": category} for t in tools])

    all_tools.sort(key=lambda t: t["rating"], reverse=True)
    top_picks = all_tools[:5]

    markdown = f"""# Free Marketing Tools Recommendations

**Categories Explored**: {", ".join(categories)}
**Total Tools Found**: {len(all_tools)}

---

## Top Picks

"""

    for i, tool in enumerate(top_picks, 1):
        markdown += f"""### {i}. {tool["name"]} {tool["rating"]}/5

**Category**: {tool["category"]}
**Best For**: {tool["best_for"]}
**Free Tier**: {tool["free_tier"]}

---

"""

    markdown += "## Tools by Category\n\n"

    for category, tools in tools_by_category.items():
        title = " ".join(w.capitalize() for w in category.split("_"))
        markdown += f"### {title}\n\n"
        for tool in tools:
            markdown += f"""#### {tool["name"]} {tool["rating"]}/5

**Features**: {", ".join(tool["features"])}

**Free Tier**: {tool["free_tier"]}

**Best For**: {tool["best_for"]}

---

"""

    markdown += """## Implementation Tips

1. **Start with 2-3 tools** - Don't overwhelm yourself with too many options
2. **Test the free tiers** - Most tools offer generous free plans
3. **Create a tool stack** - Combine complementary tools (e.g., Canva + Buffer + Google Analytics)
4. **Set up tracking** - Use analytics tools to measure tool effectiveness
5. **Review quarterly** - Reassess if free tiers still meet your needs

---

## Free to Paid Upgrade Paths

| Tool | When to Consider Paid | Starting Price |
|------|----------------------|----------------|
| Buffer | Need more than 3 channels | ~$6/month |
| Canva | Need Brand Kit Pro | ~$12.99/month |
| Mailchimp | Surpassing 500 contacts | ~$13/month |
| Hotjar | Need more than 100 pageviews/day | ~$39/month |
| Zapier | Need unlimited tasks | ~$20/month |
"""

    output_file = output_path / "free_tools.md"
    output_file.write_text(markdown)
    print(f"\nRecommendations saved to: {output_file}")
    print(f"Found {len(all_tools)} tools across {len(tools_by_category)} categories")
