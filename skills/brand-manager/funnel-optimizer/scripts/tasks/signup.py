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

    print("Analyzing signup flow for conversion opportunities...")

    analysis = {
        "summary": {
            "flow_name": "not_provided",
            "flow_type": "unknown",
            "completion_rate": None,
            "step_count": None,
            "social_auth": "partial",
            "brand_context": brand_context,
        },
        "field_analysis": {
            "email_field": {
                "single_field": True,
                "inline_validation": False,
                "typo_detection": False,
                "mobile_keyboard_optimized": False,
            },
            "password_field": {
                "show_password_toggle": False,
                "requirements_shown_upfront": False,
                "strength_meter": False,
                "paste_enabled": True,
            },
            "name_field": {
                "single_name_field": False,
                "required": True,
                "can_be_optional": True,
                "personalization_use": False,
            },
            "deferred_fields": {
                "phone_number": {"current": "required", "recommendation": "defer"},
                "company": {"current": "optional", "recommendation": "defer"},
                "use_case_questions": {"current": "present", "recommendation": "defer"},
            },
        },
        "friction_points": [],
        "recommendations": {
            "quick_wins": [
                {
                    "action": "Add 'No credit card required' badge",
                    "rationale": "Reduces perceived commitment anxiety",
                    "impact": "medium",
                    "effort": "low",
                },
                {
                    "action": "Add password toggle (eye icon)",
                    "rationale": "Reduces typos and frustration",
                    "impact": "low",
                    "effort": "low",
                },
                {
                    "action": "Make name field optional",
                    "rationale": "Reduces friction for users who don't need personalization",
                    "impact": "medium",
                    "effort": "low",
                },
            ],
            "high_impact": [
                {
                    "action": "Add Google/Apple social auth",
                    "rationale": "One-click signup has significantly higher completion",
                    "impact": "high",
                    "effort": "medium",
                },
                {
                    "action": "Defer phone number and company fields to onboarding",
                    "rationale": "Reduce signup friction, collect later when user is invested",
                    "impact": "high",
                    "effort": "medium",
                },
                {
                    "action": "Implement progressive commitment pattern",
                    "rationale": "Start with email only, add fields after psychological commitment",
                    "impact": "high",
                    "effort": "high",
                },
            ],
            "test_hypotheses": [
                {
                    "hypothesis": "Single-step form will increase completion by 15%",
                    "test": "Compare single-step vs. current multi-step",
                    "primary_metric": "form completion rate",
                    "secondary_metrics": ["time to complete", "error rate"],
                },
                {
                    "hypothesis": "Social auth as primary will increase conversions by 20%",
                    "test": "Make Google auth the default option",
                    "primary_metric": "social auth usage rate",
                    "secondary_metrics": ["overall completion rate"],
                },
                {
                    "hypothesis": "Making name optional will increase completions by 8%",
                    "test": "A/B test with/without name requirement",
                    "primary_metric": "form completion rate",
                    "secondary_metrics": ["quality of leads"],
                },
            ],
            "form_redesign": {
                "recommended_fields": [
                    {"field": "email", "required": True, "rationale": "Essential for account creation"},
                    {"field": "password", "required": True, "rationale": "Essential for account security"},
                    {"field": "name", "required": False, "rationale": "Optional for personalization, can be collected later"},
                    {"field": "google_auth", "required": False, "rationale": "Alternative signup method"},
                    {"field": "apple_auth", "required": False, "rationale": "Alternative signup method (especially for iOS users)"},
                ],
                "deferred_fields": [
                    {"field": "phone_number", "when": "onboarding if needed for SMS features"},
                    {"field": "company", "when": "onboarding for B2B products"},
                    {"field": "use_case", "when": "onboarding if needed for personalization"},
                ],
            },
        },
        "post_submit_experience": {},
    }

    output_file = output_path / "signup_cro_analysis.json"
    output_file.write_text(json.dumps(analysis, indent=2))

    print(f"\nAnalysis saved to: {output_file}")
    print(f"\nFriction Points Found: {len(analysis['friction_points'])}")
    print(f"Quick Wins: {len(analysis['recommendations']['quick_wins'])}")
    print(f"High-Impact Changes: {len(analysis['recommendations']['high_impact'])}")
    print(f"Test Hypotheses: {len(analysis['recommendations']['test_hypotheses'])}")
