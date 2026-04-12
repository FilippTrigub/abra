// Pricing strategy task - Design value-based pricing and packaging
// Based on marketingskills/pricing-strategy

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function run(options) {
  const { input, output } = options
  console.error('Running: pricing task')
  console.error('')

  // Pricing analysis framework
  const framework = [
    {
      id: 'business-context',
      title: 'Business Context',
      questions: [
        'What type of product? (SaaS, marketplace, e-commerce, service)',
        'What\'s your current pricing (if any)?',
        'What\'s your target market? (SMB, mid-market, enterprise)',
        'What\'s your go-to-market motion? (self-serve, sales-led, hybrid)'
      ]
    },
    {
      id: 'value-metric',
      title: 'Value Metric',
      description: 'What do you charge for? This should scale with value.',
      options: [
        'Per user/seat (Slack, Notion)',
        'Per usage (AWS, Twilio)',
        'Per feature (HubSpot add-ons)',
        'Per contact/record (Mailchimp)',
        'Per transaction (Stripe)',
        'Flat fee (Basecamp)'
      ],
      questions: [
        'What value metric aligns with customer value?',
        'Does price scale as customer grows?',
        'Is the metric easy to understand?',
        'Is the metric hard to game?'
      ]
    },
    {
      id: 'tier-structure',
      title: 'Tier Structure (Good-Better-Best)',
      description: 'Three-tier framework with clear differentiation',
      tiers: {
        good: {
          title: 'Good (Entry)',
          description: 'Core features, limited usage, low price'
        },
        better: {
          title: 'Better (Recommended)',
          description: 'Full features, reasonable limits, anchor price'
        },
        best: {
          title: 'Best (Premium)',
          description: 'Everything, advanced features, 2-3x Better price'
        }
      },
      questions: [
        'What differentiates each tier? (features, limits, support)',
        'Which tier is your primary target?',
        'How does each tier scale with customer value?'
      ]
    },
    {
      id: 'value-based-pricing',
      title: 'Value-Based Pricing',
      description: 'Price based on value delivered, not cost to serve',
      components: [
        'Customer\'s perceived value (ceiling)',
        'Next best alternative (floor)',
        'Your price (between alternative and value)',
        'Your cost to serve (baseline only)'
      ],
      questions: [
        'What is your customer\'s perceived value?',
        'What is the next best alternative?',
        'Where should your price fall between?'
      ]
    },
    {
      id: 'pricing-research',
      title: 'Pricing Research',
      description: 'Empirical methods to validate price points',
      methods: [
        'Van Westendorp: Ask about too expensive, too cheap, expensive but might consider, bargain',
        'MaxDiff: Identify which features customers value most'
      ],
      questions: [
        'Have you conducted willingness-to-pay research?',
        'What price intersections did you find?',
        'What features drive value perception?'
      ]
    },
    {
      id: 'pricing-psychology',
      title: 'Pricing Psychology',
      description: 'Tactics for optimizing price perception',
      tactics: [
        'Charm Pricing: Use .99 or .95 endings for value products',
        'Rounded Prices: Use round numbers for premium positioning',
        'Rule of 100: Under $100 use %, over $100 use absolute discount',
        'Anchoring: Show higher-priced option first',
        'Decoy Effect: Add inferior option to make preferred tier look better',
        'Framing: \"$1/day\" feels cheaper than \"$30/month\"'
      ],
      questions: [
        'What psychology tactics fit your positioning?',
        'How will you frame your price for maximum impact?'
      ]
    },
    {
      id: 'pricing-page',
      title: 'Pricing Page',
      description: 'Best practices for pricing page layout',
      elements: [
        'Clear tier comparison table above the fold',
        'Recommended tier highlighted',
        'Monthly/annual toggle',
        'Feature comparison table',
        'Customer logos/trust signals',
        'Money-back guarantee',
        'Annual discount callout (17-20%)'
      ],
      questions: [
        'Is your recommended tier clearly highlighted?',
        'Do you have social proof and trust signals?',
        'Is annual discount prominent?'
      ]
    },
    {
      id: 'price-increases',
      title: 'Price Increases',
      description: 'When and how to raise prices',
      triggers: [
        'Market: Competitors raised prices, prospects don\'t flinch',
        'Business: High conversion (>40%), low churn (<3%)',
        'Product: Significant value added since last pricing'
      ],
      strategies: [
        'Grandfather existing: New price for new customers only',
        'Delayed increase: Announce 3-6 months out',
        'Tied to value: Raise price but add features'
      ],
      questions: [
        'What signals indicate it\'s time to raise prices?',
        'What strategy will you use for increases?'
      ]
    },
    {
      id: 'performance-metrics',
      title: 'Performance Metrics',
      description: 'Key metrics to track',
      metrics: [
        'Conversion rate by tier',
        'ARPU (Average Revenue Per User)',
        'Churn rate',
        'Price elasticity',
        'Willingness to pay distribution'
      ],
      questions: [
        'What is your current conversion rate?',
        'What is your ARPU and churn rate?',
        'What feedback have you received on pricing?'
      ]
    }
  ]

  // Check for existing context files
  const contextPaths = [
    join(process.cwd(), '.agents/pricing-strategy.md'),
    join(process.cwd(), '.claude/pricing-strategy.md'),
    join(process.cwd(), 'PRICING.md')
  ]

  let existingContext = null
  for (const path of contextPaths) {
    try {
      const content = await readFile(path, 'utf-8')
      existingContext = { path, content }
      console.error(`Found existing context: ${path}`)
      break
    } catch {
      // File doesn't exist, continue
    }
  }

  // Check input directory for source material
  let inputFiles = []
  try {
    const files = await readdir(input)
    inputFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.txt') || f === 'package.json')
  } catch {
    // No input files
  }

  // Generate output
  const timestamp = new Date().toISOString().split('T')[0]
  let outputContent = '# Pricing Strategy Guide\n\n'
  outputContent += `*Last updated: ${timestamp}*\n\n`

  if (existingContext) {
    outputContent += `*Based on existing context at: ${existingContext.path}*\n\n`
  }

  if (inputFiles.length > 0) {
    outputContent += `*Source materials: ${inputFiles.join(', ')}*\n\n`
  }

  outputContent += '## Overview\n\n'
  outputContent += 'This guide helps design pricing, packaging, and monetization strategies that\n'
  outputContent += 'capture value and drive growth. Use proven frameworks: Good-Better-Best tiering,\n'
  outputContent += 'value-based pricing, and empirical research methods.\n\n'

  // Add framework sections
  for (const section of framework) {
    outputContent += `## ${section.title}\n\n`
    if (section.description) {
      outputContent += `${section.description}\n\n`
    }

    // Add options/examples if provided
    if (section.options) {
      outputContent += '**Options:**\n'
      for (const opt of section.options) {
        outputContent += `- ${opt}\n`
      }
      outputContent += '\n'
    }

    // Add tier info if provided
    if (section.tiers) {
      outputContent += '**Tier Definitions:**\n'
      for (const [tierKey, tierInfo] of Object.entries(section.tiers)) {
        outputContent += `- ${tierInfo.title}: ${tierInfo.description}\n`
      }
      outputContent += '\n'
    }

    // Add components if provided
    if (section.components) {
      outputContent += '**Components:**\n'
      for (const comp of section.components) {
        outputContent += `- ${comp}\n`
      }
      outputContent += '\n'
    }

    // Add methods if provided
    if (section.methods) {
      outputContent += '**Methods:**\n'
      for (const method of section.methods) {
        outputContent += `- ${method}\n`
      }
      outputContent += '\n'
    }

    // Add tactics if provided
    if (section.tactics) {
      outputContent += '**Tactics:**\n'
      for (const tactic of section.tactics) {
        outputContent += `- ${tactic}\n`
      }
      outputContent += '\n'
    }

    // Add triggers if provided
    if (section.triggers) {
      outputContent += '**Triggers:**\n'
      for (const trigger of section.triggers) {
        outputContent += `- ${trigger}\n`
      }
      outputContent += '\n'
    }

    // Add strategies if provided
    if (section.strategies) {
      outputContent += '**Strategies:**\n'
      for (const strategy of section.strategies) {
        outputContent += `- ${strategy}\n`
      }
      outputContent += '\n'
    }

    // Add elements if provided
    if (section.elements) {
      outputContent += '**Elements:**\n'
      for (const element of section.elements) {
        outputContent += `- ${element}\n`
      }
      outputContent += '\n'
    }

    // Add metrics if provided
    if (section.metrics) {
      outputContent += '**Metrics:**\n'
      for (const metric of section.metrics) {
        outputContent += `- ${metric}\n`
      }
      outputContent += '\n'
    }

    outputContent += '**Questions:**\n'
    for (const q of section.questions) {
      outputContent += `- ${q}\n`
    }
    outputContent += '\n'
  }

  outputContent += '---\n\n'
  outputContent += '## Task-Specific Questions\n\n'
  outputContent += '1. What pricing research have you done?\n'
  outputContent += '2. What\'s your current ARPU and conversion rate?\n'
  outputContent += '3. What\'s your primary value metric?\n'
  outputContent += '4. Who are your main pricing personas?\n'
  outputContent += '5. Are you self-serve, sales-led, or hybrid?\n'
  outputContent += '6. What pricing changes are you considering?\n\n'

  outputContent += '## Related Skills\n\n'
  outputContent += '- **marketing-psychology**: For pricing psychology principles\n'
  outputContent += '- **customer-research**: For willingness-to-pay research\n'
  outputContent += '- **position**: For messaging around price and value\n'

  // Write output
  const outputPath = join(output, 'pricing-strategy.md')
  await writeFile(outputPath, outputContent, 'utf-8')

  console.error(`Output written to: ${outputPath}`)
  console.error('')
  console.error('Next steps:')
  console.error('1. Review the pricing framework sections')
  console.error('2. Answer the questions for each section')
  console.error('3. Check SKILL.md for detailed frameworks (Van Westendorp, MaxDiff)')
  console.error('4. Apply value-based pricing principles to set price points')
  console.error('5. Test with customers before rollout')
}
