from __future__ import annotations

import json
from pathlib import Path


def run(input_dir: str, output_dir: str, form_type: str = "unknown") -> None:
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    input_files = (
        [f.name for f in sorted(input_path.iterdir()) if f.suffix in (".md", ".txt")]
        if input_path.exists()
        else []
    )
    brand_context = f"\nBased on input files: {', '.join(input_files)}\n" if input_files else ""

    print("Analyzing form for conversion opportunities...")

    analysis: dict = {
        "summary": {
            "form_name": "not_provided",
            "form_type": form_type,
            "completion_rate": None,
            "field_count": None,
            "mobile_split": None,
            "brand_context": brand_context,
        },
        "field_analysis": {
            "total_fields": 0,
            "email": {"single_field": True, "inline_validation": False, "typo_detection": False},
            "name": {"single_name_field": False, "required": True, "can_be_optional": True},
            "phone": {"required": True, "optional_recommended": True, "auto_format": False, "country_handling": False},
            "company": {"required": True, "auto_suggest": False, "enrichment_available": False, "inferred_from_email": False},
            "free_text": {"character_limits_set": False, "expand_on_focus": False, "optional": False},
        },
        "friction_points": [],
        "recommendations": {
            "quick_wins": [
                {
                    "action": "Make free text/comment fields optional",
                    "rationale": "Free text is the lowest priority field",
                    "impact": "medium",
                    "effort": "low",
                },
                {
                    "action": "Add auto-format for phone numbers",
                    "rationale": "Improves UX and data quality",
                    "impact": "low",
                    "effort": "low",
                },
                {
                    "action": "Change button copy to be value-focused",
                    "rationale": "Button text like 'Submit' is weak; use action + value",
                    "impact": "medium",
                    "effort": "low",
                },
            ],
            "high_impact": [
                {
                    "action": "Reduce field count by 30-40%",
                    "rationale": "Each field reduces completion; defer non-essential fields",
                    "impact": "high",
                    "effort": "medium",
                },
                {
                    "action": "Implement field enrichment (e.g., company from email)",
                    "rationale": "Auto-fill known data to reduce typing",
                    "impact": "high",
                    "effort": "medium",
                },
                {
                    "action": "Switch to single-column layout",
                    "rationale": "Higher completion, mobile-friendly",
                    "impact": "high",
                    "effort": "low",
                },
                {
                    "action": "Add inline validation",
                    "rationale": "Prevents errors and frustration",
                    "impact": "high",
                    "effort": "medium",
                },
            ],
            "test_hypotheses": [
                {
                    "hypothesis": "Reducing to 4 fields will increase completion by 25%",
                    "test": "Remove company and phone as required",
                    "primary_metric": "form completion rate",
                    "secondary_metrics": ["lead quality", "sales follow-up rate"],
                },
                {
                    "hypothesis": "Single-column layout will improve mobile conversion by 20%",
                    "test": "A/B test single vs. multi-column layout",
                    "primary_metric": "mobile completion rate",
                    "secondary_metrics": ["time to complete", "error rate"],
                },
                {
                    "hypothesis": "Value-focused CTA copy will increase clicks by 15%",
                    "test": "Test 'Get My Quote' vs. 'Submit'",
                    "primary_metric": "CTA click-through rate",
                    "secondary_metrics": ["completion rate"],
                },
            ],
            "form_redesign": {"recommended_fields": [], "optional_fields": [], "copy": {"button_copy": None, "error_messages": {}}},
        },
    }

    if form_type == "lead_capture":
        analysis["recommendations"]["quick_wins"].append({
            "action": "Test email-only field",
            "rationale": "Minimum friction for content gating",
            "impact": "high",
            "effort": "low",
        })
        analysis["recommendations"]["form_redesign"]["recommended_fields"] = [
            {"field": "email", "required": True, "rationale": "Essential for delivering content"},
        ]
        analysis["recommendations"]["form_redesign"]["optional_fields"] = [
            {"field": "name", "rationale": "Can enrich post-download"},
        ]
    elif form_type == "demo_request":
        analysis["recommendations"]["form_redesign"]["recommended_fields"] = [
            {"field": "name", "required": True, "rationale": "Personalize demo"},
            {"field": "email", "required": True, "rationale": "Send demo link and follow-up"},
            {"field": "company", "required": False, "rationale": "Optional for qualification"},
            {"field": "phone", "required": False, "rationale": "Optional, ask for preferred contact method"},
            {"field": "use_case", "required": False, "rationale": "Helps personalize demo"},
        ]
        analysis["recommendations"]["form_redesign"]["copy"]["button_copy"] = "Request My Personalized Demo"
    elif form_type == "contact":
        analysis["recommendations"]["form_redesign"]["recommended_fields"] = [
            {"field": "email", "required": True, "rationale": "Respond to inquiry"},
            {"field": "name", "required": False, "rationale": "Optional, but preferred"},
            {"field": "message", "required": True, "rationale": "Understand the inquiry"},
        ]
        analysis["recommendations"]["form_redesign"]["copy"]["button_copy"] = "Send Message"
        analysis["recommendations"]["quick_wins"].append({
            "action": "Add expected response time",
            "rationale": "Sets expectations and reduces follow-up emails",
            "impact": "low",
            "effort": "low",
        })
    elif form_type == "checkout":
        analysis["recommendations"]["quick_wins"].extend([
            {
                "action": "Add guest checkout option",
                "rationale": "Reduces friction for first-time buyers",
                "impact": "high",
                "effort": "medium",
            },
            {
                "action": "Add progress indicator",
                "rationale": "Shows remaining steps",
                "impact": "medium",
                "effort": "low",
            },
        ])

    output_file = output_path / "form_cro_analysis.json"
    output_file.write_text(json.dumps(analysis, indent=2))

    print(f"\nAnalysis saved to: {output_file}")
    print(f"\nFriction Points Found: {len(analysis['friction_points'])}")
    print(f"Quick Wins: {len(analysis['recommendations']['quick_wins'])}")
    print(f"High-Impact Changes: {len(analysis['recommendations']['high_impact'])}")
    print(f"Test Hypotheses: {len(analysis['recommendations']['test_hypotheses'])}")
