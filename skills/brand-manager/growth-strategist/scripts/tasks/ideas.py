from __future__ import annotations

import random
from pathlib import Path

IDEA_TEMPLATES: dict[str, list[str]] = {
    "brand_awareness": [
        "User-Generated Content Campaign: Encourage customers to share photos with your product using a branded hashtag",
        "Educational Content Series: Create blog posts/videos teaching your audience about industry trends",
        "Influencer Partnerships: Collaborate with micro-influencers who align with your brand values",
        "Community Challenges: Launch a 7-day challenge related to your product's benefits",
        "Behind-the-Scenes Content: Show your company culture and product development process",
    ],
    "lead_generation": [
        "Free Tool/Calculator: Build a useful free tool that solves a common problem in your niche",
        "Webinar Series: Host educational webinars with expert speakers in your field",
        "Gated Content Upgrades: Offer detailed guides or templates in exchange for contact info",
        "Interactive Quiz: Create an engaging quiz that provides personalized recommendations",
        "Live Q&A Sessions: Host regular live sessions where you answer audience questions",
    ],
    "customer_engagement": [
        "Social Media Polls: Run polls to gather opinions and boost engagement",
        "Customer Spotlights: Feature success stories and testimonials from your customers",
        "Gamified Loyalty Program: Create a point-based system for repeat engagement",
        "Exclusive Community Access: Build a private group for your most engaged customers",
        "Content Contests: Host creative contests with prizes for best submissions",
    ],
    "product_launch": [
        "Countdown Campaign: Build anticipation with daily countdown posts revealing features",
        "Early Bird Access: Offer exclusive pre-launch access to email subscribers",
        "Demo Video Series: Create short videos showcasing different product features",
        "Beta Tester Program: Recruit beta users in exchange for early access and feedback",
        "Launch Day Event: Host a virtual or in-person launch event with giveaways",
    ],
}

TONE_MODIFIERS: dict[str, list[str]] = {
    "professional": [
        "Maintain consistent branding across all touchpoints",
        "Use data-driven insights to inform your approach",
        "Focus on measurable ROI and clear KPIs",
        "Include case studies and social proof",
        "Emphasize reliability and trustworthiness",
    ],
    "casual": [
        "Use conversational language and emojis",
        "Be authentic and relatable in your messaging",
        "Share personal stories and behind-the-scenes content",
        "Keep it light and entertaining",
        "Encourage two-way conversations",
    ],
    "humorous": [
        "Incorporate trending memes and pop culture references",
        "Use witty copy and unexpected twists",
        "Don't be afraid to poke fun at industry norms",
        "Create shareable, viral-worthy content",
        "Balance humor with brand messaging",
    ],
    "inspirational": [
        "Focus on transformation and success stories",
        "Use aspirational language and imagery",
        "Celebrate small wins and milestones",
        "Connect your brand to bigger purposes",
        "Motivate action through emotional appeals",
    ],
}

AUDIENCE_INSIGHTS: dict[str, dict] = {
    "small_business": {
        "pain_points": ["Limited budget", "Time constraints", "Need for quick results"],
        "preferences": ["ROI-focused", "Easy-to-implement tactics", "Scalable solutions"],
        "channels": ["LinkedIn", "Email", "Facebook Groups"],
    },
    "enterprise": {
        "pain_points": ["Complex approval processes", "Integration requirements", "Security concerns"],
        "preferences": ["Enterprise features", "Dedicated support", "Proven track record"],
        "channels": ["LinkedIn", "Industry events", "Email"],
    },
    "consumers": {
        "pain_points": ["Price sensitivity", "Trust issues", "Decision paralysis"],
        "preferences": ["Social proof", "Free trials", "Easy purchase process"],
        "channels": ["Instagram", "TikTok", "YouTube"],
    },
    "developers": {
        "pain_points": ["Learning curve", "Documentation quality", "API reliability"],
        "preferences": ["Technical depth", "Open source options", "Community support"],
        "channels": ["GitHub", "Twitter", "Dev communities"],
    },
}


def run(config: dict) -> None:
    output_path = Path(config.get("output_dir", "./output"))
    output_path.mkdir(parents=True, exist_ok=True)

    marketing_goal = config.get("marketing_goal", "brand_awareness")
    target_audience = config.get("target_audience", "small_business")
    tone = config.get("tone", "professional")
    max_ideas = int(config.get("max_ideas", 10))
    include_examples = config.get("include_examples", True)

    templates = IDEA_TEMPLATES.get(marketing_goal, IDEA_TEMPLATES["brand_awareness"])
    modifiers = TONE_MODIFIERS.get(tone, TONE_MODIFIERS["professional"])
    insights = AUDIENCE_INSIGHTS.get(target_audience, AUDIENCE_INSIGHTS["small_business"])

    print(f"Generating {max_ideas} marketing ideas for goal: {marketing_goal}...")

    ideas = []
    for i, base_idea in enumerate(templates[:max_ideas]):
        modifier = modifiers[i % len(modifiers)]
        pain_point = insights["pain_points"][i % len(insights["pain_points"])]
        ideas.append({
            "id": i + 1,
            "name": base_idea.split(":")[0],
            "description": base_idea,
            "customization": modifier,
            "audience_relevance": pain_point,
            "recommended_channels": ", ".join(insights["channels"]),
            "estimated_effort": ["Low", "Medium", "High"][i % 3],
            "expected_impact": ["Quick Win", "Medium Term", "Long Term"][i % 3],
        })

    markdown = f"""# Marketing Campaign Ideas

Generated based on:
- **Goal**: {marketing_goal}
- **Target Audience**: {target_audience}
- **Tone**: {tone}
- **Max Ideas**: {max_ideas}

## Audience Insights

**Key Pain Points:**
{chr(10).join(f"- {p}" for p in insights["pain_points"])}

**Preferences:**
{chr(10).join(f"- {p}" for p in insights["preferences"])}

**Recommended Channels:**
{", ".join(insights["channels"])}

---

## Campaign Ideas

"""

    for idea in ideas:
        markdown += f"""### {idea["id"]}. {idea["name"]}

{idea["description"]}

**Customization Focus**: {idea["customization"]}

**Why It Works**: Addresses "{idea["audience_relevance"]}"

**Recommended Channels**: {idea["recommended_channels"]}

**Effort**: {idea["estimated_effort"]} | **Impact**: {idea["expected_impact"]}

---

"""

    if include_examples and ideas:
        example_idea = ideas[0]
        markdown += f"""### Example Case Study

**Company**: SimilarBrand
**Strategy**: {example_idea["name"]}
**Results**: 30% increase in engagement, 2x ROI in 3 months

---

"""

    markdown += """## Next Steps

1. Select 2-3 ideas to test first
2. Create detailed execution plans for each
3. Set up tracking metrics before launch
4. Schedule content creation and distribution
5. Review and optimize based on results
"""

    output_file = output_path / "marketing_ideas.md"
    output_file.write_text(markdown)
    print(f"\nIdeas saved to: {output_file}")
    print(f"Generated {len(ideas)} ideas")
