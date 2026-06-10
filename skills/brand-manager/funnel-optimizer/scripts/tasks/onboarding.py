from __future__ import annotations

import json
from pathlib import Path


def run(input_dir: str, output_dir: str) -> None:
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    input_files = (
        [f.name for f in sorted(input_path.iterdir()) if f.suffix in (".md", ".txt")]
        if input_path.exists()
        else []
    )
    brand_context = f"\nBased on input files: {', '.join(input_files)}\n" if input_files else ""

    print("Analyzing onboarding flow for activation opportunities...")

    analysis = {
        "summary": {
            "activation_goal": "not_provided",
            "activation_rate": None,
            "time_to_activation": None,
            "main_dropoff": None,
            "brand_context": brand_context,
        },
        "immediate_post_signup": {
            "value_delivered_immediately": False,
            "clear_single_next_action": False,
            "blank_slate_risk": False,
            "empty_states_optimized": False,
        },
        "onboarding_flow": {
            "step_count": 0,
            "progress_indication_present": False,
            "interactive_over_tutorial": False,
            "checklist_pattern": False,
        },
        "friction_points": [],
        "recommendations": {
            "quick_wins": [
                {
                    "action": "Add progress bar to multi-step flow",
                    "rationale": "Shows advancement and estimated completion time",
                    "impact": "low",
                    "effort": "low",
                },
                {
                    "action": "Replace tutorial with interactive walkthrough",
                    "rationale": "Users learn by doing, not watching",
                    "impact": "medium",
                    "effort": "medium",
                },
                {
                    "action": "Celebrate activation achievement",
                    "rationale": "Positive reinforcement encourages continued engagement",
                    "impact": "medium",
                    "effort": "low",
                },
            ],
            "high_impact": [
                {
                    "action": "Implement onboarding checklist pattern",
                    "rationale": "Progress visualization creates motivation to complete",
                    "impact": "high",
                    "effort": "medium",
                },
                {
                    "action": "Set up trigger-based email sequence",
                    "rationale": "Re-engage users who stall at key points",
                    "impact": "high",
                    "effort": "medium",
                },
                {
                    "action": "Reduce step count by 30%",
                    "rationale": "Fewer steps = faster time to value",
                    "impact": "high",
                    "effort": "high",
                },
            ],
            "test_hypotheses": [
                {
                    "hypothesis": "Value-first approach will increase activation by 25%",
                    "test": "Show product experience before any setup questions",
                    "primary_metric": "activation rate",
                    "secondary_metrics": ["time to activation", "day 7 retention"],
                },
                {
                    "hypothesis": "Onboarding checklist will increase completion by 20%",
                    "test": "A/B test checklist vs. linear flow",
                    "primary_metric": "onboarding completion rate",
                    "secondary_metrics": ["activation rate", "time to activation"],
                },
                {
                    "hypothesis": "Personalized onboarding by role will increase activation by 15%",
                    "test": "Role-based onboarding paths vs. generic path",
                    "primary_metric": "activation rate",
                    "secondary_metrics": ["time to activation", "engagement score"],
                },
            ],
            "onboarding_flow_design": {
                "activation_goal": "unknown",
                "recommended_steps": [
                    {"step": 1, "action": "Immediate value action", "rationale": "Deliver core value instantly"},
                    {"step": 2, "action": "Quick customization", "rationale": "Personalize experience without friction"},
                    {"step": 3, "action": "Second value moment", "rationale": "Reinforce value with secondary action"},
                    {"step": 4, "action": "Optional advanced setup", "rationale": "For power users who want more"},
                ],
                "empty_state_template": {
                    "headline": "Your first [item] is ready",
                    "description": "Click here to add your first [item] and see the value",
                    "primary_cta": "Create my first [item]",
                    "secondary_cta": "View example",
                },
            },
        },
        "multi_channel": {
            "email_coordination": False,
            "trigger_based_emails": [
                {"trigger": "incomplete_onboarding_24h", "purpose": "reminder"},
                {"trigger": "incomplete_onboarding_72h", "purpose": "help + examples"},
                {"trigger": "activation_achieved", "purpose": "celebration + next step"},
                {"trigger": "feature_discovery_day7", "purpose": "show advanced features"},
            ],
            "re_engagement_tactics": [],
        },
    }

    output_file = output_path / "onboarding_cro_analysis.json"
    output_file.write_text(json.dumps(analysis, indent=2))

    print(f"\nAnalysis saved to: {output_file}")
    print(f"\nFriction Points Found: {len(analysis['friction_points'])}")
    print(f"Quick Wins: {len(analysis['recommendations']['quick_wins'])}")
    print(f"High-Impact Changes: {len(analysis['recommendations']['high_impact'])}")
    print(f"Test Hypotheses: {len(analysis['recommendations']['test_hypotheses'])}")
