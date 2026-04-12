// Marketing psychology task - Apply psychological principles to marketing
// Based on marketingskills/marketing-psychology

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function run(options) {
  const { input, output } = options
  console.error('Running: psychology task')
  console.error('')

  // Psychology application categories
  const categories = [
    {
      id: 'foundational-thinking',
      title: 'Foundational Thinking Models',
      description: 'Models that sharpen strategy and help solve the right problems',
      models: [
        'First Principles',
        'Jobs to Be Done',
        'Circle of Competence',
        'Inversion',
        'Occam\'s Razor',
        'Pareto Principle (80/20 Rule)',
        'Local vs. Global Optima',
        'Theory of Constraints',
        'Opportunity Cost',
        'Law of Diminishing Returns',
        'Second-Order Thinking'
      ]
    },
    {
      id: 'understanding-buyers',
      title: 'Understanding Buyers & Human Psychology',
      description: 'Models that explain how customers think, decide, and behave',
      models: [
        'Fundamental Attribution Error',
        'Mere Exposure Effect',
        'Availability Heuristic',
        'Confirmation Bias',
        'The Lindy Effect',
        'Mimetic Desire',
        'Sunk Cost Fallacy',
        'Endowment Effect',
        'IKEA Effect',
        'Zero-Price Effect',
        'Hyperbolic Discounting / Present Bias',
        'Status-Quo Bias',
        'Default Effect',
        'Paradox of Choice',
        'Goal-Gradient Effect'
      ]
    },
    {
      id: 'influencing-behavior',
      title: 'Influencing Behavior & Persuasion',
      description: 'Models that help ethically influence customer decisions',
      models: [
        'Reciprocity Principle',
        'Commitment & Consistency',
        'Authority Bias',
        'Liking / Similarity Bias',
        'Unity Principle',
        'Scarcity / Urgency Heuristic',
        'Foot-in-the-Door Technique',
        'Door-in-the-Face Technique',
        'Loss Aversion / Prospect Theory',
        'Anchoring Effect',
        'Decoy Effect',
        'Framing Effect',
        'Contrast Effect'
      ]
    },
    {
      id: 'pricing-psychology',
      title: 'Pricing Psychology',
      description: 'Models that specifically address how people perceive prices',
      models: [
        'Charm Pricing / Left-Digit Effect',
        'Rounded-Price (Fluency) Effect',
        'Rule of 100',
        'Price Relativity / Good-Better-Best',
        'Mental Accounting (Pricing)'
      ]
    },
    {
      id: 'design-delivery',
      title: 'Design & Delivery Models',
      description: 'Models for designing effective marketing systems',
      models: [
        'Hick\'s Law',
        'AIDA Funnel',
        'Rule of 7',
        'Nudge Theory / Choice Architecture',
        'BJ Fogg Behavior Model',
        'EAST Framework',
        'COM-B Model',
        'Activation Energy'
      ]
    },
    {
      id: 'growth-scaling',
      title: 'Growth & Scaling Models',
      description: 'Models for understanding marketing compounding and growth',
      models: [
        'Feedback Loops',
        'Compounding',
        'Network Effects',
        'Flywheel Effect',
        'Switching Costs',
        'Exploration vs. Exploitation',
        'Critical Mass / Tipping Point',
        'Survivorship Bias'
      ]
    }
  ]

  // Check for existing context files
  const contextPaths = [
    join(process.cwd(), '.agents/marketing-psychology.md'),
    join(process.cwd(), '.claude/marketing-psychology.md'),
    join(process.cwd(), 'PSYCHOLOGY.md')
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
  let outputContent = '# Marketing Psychology Guide\n\n'
  outputContent += `*Last updated: ${timestamp}*\n\n`

  if (existingContext) {
    outputContent += `*Based on existing context at: ${existingContext.path}*\n\n`
  }

  if (inputFiles.length > 0) {
    outputContent += `*Source materials: ${inputFiles.join(', ')}*\n\n`
  }

  outputContent += '## Overview\n\n'
  outputContent += 'This guide applies 70+ psychological principles and mental models to marketing.\n'
  outputContent += 'Use these models to understand customer behavior, influence decisions, and design\n'
  outputContent += 'more effective campaigns.\n\n'

  // Add categories
  for (const category of categories) {
    outputContent += `## ${category.title}\n\n`
    outputContent += `${category.description}\n\n`
    outputContent += '**Mental Models:**\n'
    for (const model of category.models) {
      outputContent += `- ${model}\n`
    }
    outputContent += '\n'
    outputContent += '- [TODO: Review and apply relevant models to your situation]\n'
    outputContent += '- See SKILL.md for detailed explanations and marketing applications\n\n'
  }

  outputContent += '---\n\n'
  outputContent += '## Quick Application\n\n'
  outputContent += '### Task-Specific Questions\n\n'
  outputContent += '1. What specific behavior are you trying to influence?\n'
  outputContent += '2. What does your customer believe before encountering your marketing?\n'
  outputContent += '3. Where in the journey (awareness → consideration → decision) is this?\n'
  outputContent += '4. What\'s currently preventing the desired action?\n'
  outputContent += '5. Have you tested this with real customers?\n\n'

  outputContent += '### Related Skills\n\n'
  outputContent += '- **pricing-strategy**: For pricing psychology application\n'
  outputContent += '- **customer-research**: For understanding buyers deeply\n'
  outputContent += '- **position**: For messaging informed by psychology\n'

  // Write output
  const outputPath = join(output, 'marketing-psychology.md')
  await writeFile(outputPath, outputContent, 'utf-8')

  console.error(`Output written to: ${outputPath}`)
  console.error('')
  console.error('Next steps:')
  console.error('1. Review the psychological models relevant to your situation')
  console.error('2. Check SKILL.md for detailed explanations and applications')
  console.error('3. Apply selected models to your messaging and funnels')
  console.error('4. Test hypotheses with real customers')
}
