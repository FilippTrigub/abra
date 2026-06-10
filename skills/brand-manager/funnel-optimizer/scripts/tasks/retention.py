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

    print("Analyzing churn patterns and retention opportunities...")

    analysis = {
        "summary": {
            "churn_rate": None,
            "billing_provider": None,
            "has_cancel_flow": False,
            "churn_types": "voluntary",
            "active_subscribers": None,
            "brand_context": brand_context,
        },
        "voluntary_churn_analysis": {
            "current_state": {"has_cancel_flow": False, "has_exit_survey": False, "has_save_offers": False},
            "common_cancel_reasons": [
                "too_expensive",
                "not_using_enough",
                "missing_feature",
                "switching_competitor",
                "technical_issues",
                "temporary_need",
                "business_closed",
            ],
            "offer_mapping": {
                "too_expensive": ["discount_25%", "downgrade_option"],
                "not_using_enough": ["pause_subscription", "onboarding_help"],
                "missing_feature": ["roadmap_preview", "workaround_guide"],
                "switching_competitor": ["competitive_comparison", "discount"],
                "technical_issues": ["priority_support", "credit"],
                "temporary_need": ["pause_subscription"],
                "business_closed": ["respectful_exit"],
            },
        },
        "involuntary_churn_analysis": {
            "typical_share": "30-50% of total churn",
            "recoverability": "highest recovery rates among all churn types",
            "dunning_stack": {
                "pre_dunning": [
                    "card_expiry_alerts",
                    "backup_payment_method",
                    "card_updater_services",
                    "pre_billing_notification",
                ],
                "smart_retry_logic": {
                    "soft_decline": "Retry 3-5 times over 7-10 days",
                    "hard_decline": "Don't retry — ask for new card",
                    "authentication_required": "Send customer to update payment",
                },
                "retry_timing": [
                    "Retry 1: 24 hours after failure",
                    "Retry 2: 3 days after failure",
                    "Retry 3: 5 days after failure",
                    "Retry 4: 7 days after failure (with dunning email escalation)",
                ],
                "dunning_emails": [
                    {"email": 1, "timing": "Day 0", "tone": "friendly_alert", "content": "payment didn't go through - update card"},
                    {"email": 2, "timing": "Day 3", "tone": "helpful_reminder", "content": "quick reminder to update payment"},
                    {"email": 3, "timing": "Day 7", "tone": "urgency", "content": "account will be paused in 3 days"},
                    {"email": 4, "timing": "Day 10", "tone": "final_warning", "content": "last chance to keep account"},
                ],
            },
        },
        "risk_signals": {
            "high_risk_signals": [
                {"signal": "login_frequency_drops_50%", "timeframe": "2-4 weeks before cancel"},
                {"signal": "key_feature_usage_stops", "timeframe": "1-3 weeks before cancel"},
                {"signal": "support_tickets_spike_then_stop", "timeframe": "1-2 weeks before cancel"},
                {"signal": "billing_page_visits_increase", "timeframe": "days before cancel"},
                {"signal": "data_export_initiated", "timeframe": "days before cancel - critical"},
            ],
            "medium_risk_signals": [
                {"signal": "email_open_rates_decline", "timeframe": "2-6 weeks before cancel"},
                {"signal": "team_seats_removed", "timeframe": "1-2 weeks before cancel"},
                {"signal": "nps_score_drops_below_6", "timeframe": "1-3 months before cancel"},
            ],
            "health_score_model": {
                "components": ["login_frequency", "feature_usage", "support_sentiment", "billing_health", "engagement"],
                "weights": [0.30, 0.25, 0.15, 0.15, 0.15],
                "status_ranges": [
                    {"range": "80-100", "status": "healthy", "action": "upsell_opportunities"},
                    {"range": "60-79", "status": "needs_attention", "action": "proactive_check_in"},
                    {"range": "40-59", "status": "at_risk", "action": "intervention_campaign"},
                    {"range": "0-39", "status": "critical", "action": "personal_outreach"},
                ],
            },
        },
        "recommendations": {
            "cancel_flow": {
                "priority": "critical",
                "recommended_flow": "Trigger -> Survey -> Dynamic Offer -> Confirmation",
                "quick_start": {
                    "step_1": "Add simple exit survey with 5-7 reason options",
                    "step_2": "Add one dynamic save offer based on reason",
                    "step_3": "Add clear confirmation page with billing end date",
                },
                "expected_impact": "10-15% of cancellations can be saved even with simple flow",
            },
            "dunning": {
                "priority": "high",
                "recommended_setup": [
                    "Enable smart retries in billing provider",
                    "Set up card updater service",
                    "Configure dunning email sequence (4 emails over 10 days)",
                    "Add pre-dunning: card expiry alerts at 30, 15, 7 days",
                ],
                "expected_recovery": "50-60% of soft declines, 20-30% of hard declines",
            },
            "proactive_retention": [
                {
                    "trigger": "usage_drop_50%",
                    "intervention": "Email: 'We noticed you haven't used [feature]. Need help?'",
                    "timing": "After 2 weeks of low usage",
                },
                {
                    "trigger": "14_days_no_login",
                    "intervention": "Re-engagement email with recent product updates",
                    "timing": "Day 14",
                },
                {
                    "trigger": "nps_detractor",
                    "intervention": "Personal follow-up within 24 hours",
                    "timing": "Immediate",
                },
                {
                    "trigger": "annual_renewal_30_days",
                    "intervention": "Value recap email + renewal confirmation",
                    "timing": "30 days before",
                },
            ],
            "metrics_to_track": [
                {"metric": "monthly_churn_rate", "target": "<5% B2C, <2% B2B"},
                {"metric": "revenue_churn_net", "target": "negative (net expansion)"},
                {"metric": "cancel_flow_save_rate", "target": "25-35%"},
                {"metric": "offer_acceptance_rate", "target": "15-25%"},
                {"metric": "pause_reactivation_rate", "target": "60-80%"},
                {"metric": "dunning_recovery_rate", "target": "50-60%"},
                {"metric": "time_to_cancel", "target": "track trend downward"},
            ],
            "tests_to_run": [
                {
                    "test": "discount_percentage",
                    "hypothesis": "25% discount saves more than 20%",
                    "metric": "save_rate",
                    "consideration": "LTV impact of deeper discount",
                },
                {
                    "test": "pause_duration",
                    "hypothesis": "3-month pause increases reactivation vs. 1-month",
                    "metric": "reactivation_rate",
                },
                {
                    "test": "survey_placement",
                    "hypothesis": "Survey-first personalizes offers and increases saves",
                    "metric": "save_rate",
                },
                {
                    "test": "offer_presentation",
                    "hypothesis": "Full page gets more attention than modal",
                    "metric": "save_rate",
                },
            ],
        },
    }

    output_file = output_path / "churn_prevention_analysis.json"
    output_file.write_text(json.dumps(analysis, indent=2))

    print(f"\nAnalysis saved to: {output_file}")
    print(f"\nProactive Retention Triggers: {len(analysis['recommendations']['proactive_retention'])}")
    print(f"Recommended Tests: {len(analysis['recommendations']['tests_to_run'])}")
