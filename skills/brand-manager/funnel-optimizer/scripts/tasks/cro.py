from __future__ import annotations

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

    print("Analyzing page for conversion opportunities...")

    content = f"""# Page Conversion Rate Optimization (CRO){brand_context}

Generated using funnel-optimizer

## Analysis Framework

### Value Proposition Clarity
- Can visitor understand what this is within 5 seconds?
- Is the core benefit immediately clear?

### Headlines
Patterns to test:
- Outcome-focused: "Get [desired outcome] without [pain point]"
- Specificity: Include numbers, timeframes, or concrete details
- Social proof: "Join 10,000+ teams who..."

### CTA Analysis
- Primary CTA visible above fold?
- CTA copy value-focused?
- CTA hierarchy clear?

### Visual Hierarchy
- Scannable layout?
- Adequate white space?
- Images support the message?

### Trust Signals
- Customer logos present?
- Testimonials included?
- Social proof near CTAs?

### Objection Handling
- Price concerns addressed?
- "Will it work for me?" answered?
- Implementation clarity provided?
- Guarantee present?

## Quick Wins

| Action | Impact | Effort |
|--------|--------|--------|
| Make value proposition more specific | medium | low |
| Add trust signals near primary CTAs | high | low |
| Improve CTA copy to be value-focused | medium | low |

## High-Impact Recommendations

| Action | Rationale |
|--------|-----------|
| Reframe headline around customer outcome | Outcome-focused messaging resonates better |
| Add social proof at decision points | Increases trust at conversion moment |
| Reduce form fields to essential only | Lower friction = higher conversion |

## Copy Alternatives

### Headlines
| Variant | Example | Rationale |
|---------|---------|-----------|
| Outcome + Social Proof | "Save 10+ Hours/Week — Join 5,000+ Teams" | Specific outcome + validation |
| Pain Point + Solution | "Stop Wasting Time on Manual Reports" | Addresses frustration directly |
| Time-Bound | "Cut Your Reporting Time in Half" | Time specificity increases credibility |

### CTAs
| Weak | Strong | Rationale |
|------|--------|-----------|
| Submit | Start My Free Trial | Value-focused |
| Learn More | See How It Works | Reduces perceived commitment |
| Sign Up | Get My Free Report | Specific deliverable |

## Next Steps
1. Review analysis with stakeholders
2. Prioritize recommendations by impact/effort
3. Create A/B test variants
4. Implement quick wins first
"""

    output_file = output_path / "cro_analysis.md"
    output_file.write_text(content)
    print(f"\nAnalysis saved to: {output_file}")
