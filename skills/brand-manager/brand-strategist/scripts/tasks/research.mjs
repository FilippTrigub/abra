// Customer research task - Gather and analyze customer insights
// Based on marketingskills/customer-research

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function run(options) {
  const { input, output } = options
  console.error('Running: research task')
  console.error('')

  // Research categories for customer insights
  const categories = [
    {
      id: 'target-market',
      title: 'Target Market',
      questions: [
        'Who is your primary customer segment?',
        'What industries or verticals do you serve?',
        'What is the company size or user profile?',
        'What geographic markets are you in?'
      ]
    },
    {
      id: 'customer-personas',
      title: 'Customer Personas',
      questions: [
        'Who are the key decision-makers?',
        'What are their job titles and responsibilities?',
        'What are their goals and aspirations?',
        'What constraints do they face?'
      ]
    },
    {
      id: 'pain-points',
      title: 'Pain Points & Problems',
      questions: [
        'What problems keep them up at night?',
        'What current solutions are they using?',
        'What frustrates them about current solutions?',
        'What is the cost of not solving this?'
      ]
    },
    {
      id: 'goals-desires',
      title: 'Goals & Desires',
      questions: [
        'What outcomes do they want to achieve?',
        'What metrics matter most to them?',
        'What would success look like?',
        'What are they trying to prove or avoid?'
      ]
    },
    {
      id: 'buying-behavior',
      title: 'Buying Behavior',
      questions: [
        'What is their buying process?',
        'Who influences the decision?',
        'What is their typical budget?',
        'What sales cycle length do they expect?'
      ]
    },
    {
      id: 'objections',
      title: 'Objections & Barriers',
      questions: [
        'What prevents them from buying?',
        'What fears or risks do they have?',
        'What competitive alternatives are they considering?',
        'What information do they need to feel safe?'
      ]
    },
    {
      id: 'language',
      title: 'Customer Language',
      questions: [
        'What words do they use to describe the problem?',
        'What terminology is common in their field?',
        'What words should we avoid?',
        'What analogies resonate with them?'
      ]
    }
  ]

  // Check for existing context files
  const contextPaths = [
    join(process.cwd(), '.agents/customer-research.md'),
    join(process.cwd(), '.claude/customer-research.md'),
    join(process.cwd(), 'CUSTOMER-RESEARCH.md')
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
  let outputContent = '# Customer Research\n\n'
  outputContent += `*Last updated: ${timestamp}*\n\n`

  if (existingContext) {
    outputContent += `*Based on existing context at: ${existingContext.path}*\n\n`
  }

  if (inputFiles.length > 0) {
    outputContent += `*Source materials: ${inputFiles.join(', ')}*\n\n`
  }

  // Add categories
  for (const category of categories) {
    outputContent += `## ${category.title}\n\n`
    outputContent += '- [TODO: Complete based on questions below]\n\n'
    outputContent += '**Questions:**\n'
    for (const q of category.questions) {
      outputContent += `- ${q}\n`
    }
    outputContent += '\n'
  }

  outputContent += '---\n\n'
  outputContent += '## Usage\n\n'
  outputContent += 'This document captures customer insights for marketing decisions.\n'
  outputContent += 'Reference this when creating messaging, positioning, and campaigns.\n'

  // Write output
  const outputPath = join(output, 'customer-research.md')
  await writeFile(outputPath, outputContent, 'utf-8')

  console.error(`Output written to: ${outputPath}`)
  console.error('')
  console.error('Next steps:')
  console.error('1. Review and complete the research sections')
  console.error('2. Save to .agents/customer-research.md for reuse')
  console.error('3. This research informs product-marketing-context and other skills')
}
