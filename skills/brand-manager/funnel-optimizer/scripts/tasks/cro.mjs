import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function run({ inputDir, outputDir, outputFormat }) {
  const inputFiles = existsSync(inputDir) 
    ? readdirSync(inputDir).filter(f => f.endsWith('.md') || f.endsWith('.txt')) 
    : [];

  const brandContext = inputFiles.length > 0 
    ? `\nBased on input files: ${inputFiles.join(', ')}\n`
    : '';

  const output = `# Page Conversion Rate Optimization (CRO)${brandContext}

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
|---------|---------|------------|
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
`;

  return { output };
}
