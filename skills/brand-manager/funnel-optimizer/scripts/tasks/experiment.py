from __future__ import annotations

import json
import math
from pathlib import Path


def _calculate_sample_size(baseline: float, mde: float) -> int:
    z = 1.96
    p = baseline
    q = 1 - p
    delta = baseline * mde
    if delta == 0:
        return 0
    n = 2 * (z + 0.5) ** 2 * p * q / (delta ** 2)
    return math.ceil(n)


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

    print("Designing A/B test with statistical rigor...")

    baseline = 0.01
    mde = 0.10
    sample_size = _calculate_sample_size(baseline, mde)

    analysis = {
        "summary": {
            "hypothesis": "not_provided",
            "baseline_conversion": baseline,
            "traffic_volume": None,
            "mde": mde,
            "test_type": None,
            "brand_context": brand_context,
        },
        "hypothesis_framework": {
            "structure": "Because [observation/data], we believe [change] will cause [expected outcome] for [audience]. We'll know this is true when [metrics].",
            "strong_hypothesis_example": {
                "observation": "Heatmaps show users miss the primary CTA",
                "change": "making the button larger with contrasting color",
                "expected_outcome": "increasing CTA clicks by 15%+",
                "audience": "new visitors",
                "metrics": "click-through rate from page view to signup start",
            },
        },
        "sample_size_calculation": {
            "baseline_conversion_rate": baseline,
            "minimum_detectable_effect": f"{round(mde * 100)}% lift",
            "sample_size_per_variant": sample_size,
            "total_sample_size": sample_size * 2,
            "estimated_duration": {
                "daily_traffic_required": sample_size / 7,
                "duration_at_current_traffic": "N/A (need traffic data)",
            },
            "reference_tables": {
                "1% baseline": {"10% lift": "150k/variant", "20% lift": "39k/variant", "50% lift": "6k/variant"},
                "3% baseline": {"10% lift": "47k/variant", "20% lift": "12k/variant", "50% lift": "2k/variant"},
                "5% baseline": {"10% lift": "27k/variant", "20% lift": "7k/variant", "50% lift": "1.2k/variant"},
                "10% baseline": {"10% lift": "12k/variant", "20% lift": "3k/variant", "50% lift": "550/variant"},
            },
        },
        "metrics_plan": {
            "primary_metric": {
                "required": True,
                "description": "Single metric that matters most, directly tied to hypothesis",
                "example": "CTA click-through rate",
            },
            "secondary_metrics": {
                "required": True,
                "description": "Support primary metric interpretation",
                "examples": ["time on page", "scroll depth", "navigation clicks"],
            },
            "guardrail_metrics": {
                "required": True,
                "description": "Things that shouldn't get worse",
                "examples": ["bounce rate", "support tickets", "page load time"],
            },
        },
        "variant_design": {
            "what_to_vary": ["headlines/copy", "visual_design", "cta_button", "content", "layout"],
            "best_practices": [
                "Single, meaningful change per test",
                "Bold enough to make a difference",
                "True to the hypothesis",
                "Don't test trivial changes",
            ],
        },
        "recommendations": {
            "design_recommendations": [
                {
                    "recommendation": "Focus on one primary variable",
                    "rationale": "Testing multiple changes confuses results",
                    "impact": "ensures clean interpretation",
                },
                {
                    "recommendation": "Ensure hypothesis is based on data, not gut",
                    "rationale": "Data-backed hypotheses have higher success rates",
                    "impact": "improved win rate",
                },
                {
                    "recommendation": "Pre-determine sample size and stick to it",
                    "rationale": "Avoids false positives from early stopping",
                    "impact": "statistical validity",
                },
            ],
            "implementation_recommendations": [
                {
                    "recommendation": "Verify tracking before launch",
                    "rationale": "Invalid tracking invalidates entire test",
                    "impact": "test credibility",
                },
                {
                    "recommendation": "Run for full business cycle",
                    "rationale": "Avoid weekend-only or weekday-only biases",
                    "impact": "representative results",
                },
                {
                    "recommendation": "Document everything",
                    "rationale": "Builds experimentation playbook over time",
                    "impact": "compounding learning",
                },
            ],
            "analysis_recommendations": [
                {
                    "recommendation": "Check for statistical significance before declaring winner",
                    "rationale": "p < 0.05 means <5% chance result is random",
                    "impact": "reliable decisions",
                },
                {
                    "recommendation": "Look at segment differences",
                    "rationale": "Winners may differ by device, segment, or cohort",
                    "impact": "deeper insights",
                },
                {
                    "recommendation": "Consider effect size, not just significance",
                    "rationale": "Statistically significant != business meaningful",
                    "impact": "better ROI decisions",
                },
            ],
            "common_pitfalls_to_avoid": [
                "Testing too small a change (undetectable)",
                "Testing too many things (can't isolate what worked)",
                "No clear hypothesis (just 'let's see what happens')",
                "Stopping early (peeking at results)",
                "Changing variants mid-test",
                "Not checking implementation correctness",
                "Ignoring confidence intervals",
                "Over-interpreting inconclusive results",
            ],
        },
    }

    output_file = output_path / "experiment_design.json"
    output_file.write_text(json.dumps(analysis, indent=2))

    print(f"\nAnalysis saved to: {output_file}")
    print(f"\nSample Size per Variant: {sample_size:,}")
    print(f"Total Sample Size: {sample_size * 2:,}")
