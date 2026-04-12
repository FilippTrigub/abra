// Position task - Create/update product marketing context
// Based on marketingskills/skills/product-marketing-context

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function run(options) {
  const { input, output } = options
  console.error('Running: position task')
  console.error('')

  // Default sections for product marketing context
  const sections = [
    { id: 'product', title: 'Product Overview', questions: [
      'What is your one-line description?',
      'What does your product do (2-3 sentences)?',
      'What category does it belong to?',
      'What is your product type?',
      'What is your business model?'
    ]},
    { id: 'audience', title: 'Target Audience', questions: [
      'What is your target company type?',
      'Who are the decision-makers?',
      'What is the primary use case?',
      'What are the jobs to be done?'
    ]},
    { id: 'personas', title: 'Personas', questions: [
      'Who are the key personas?'
    ]},
    { id: 'problems', title: 'Problems & Pain Points', questions: [
      'What core challenge does this solve?',
      'What do current solutions fall short on?',
      'What does it cost them?',
      'What emotional tension exists?'
    ]},
    { id: 'competition', title: 'Competitive Landscape', questions: [
      'Who are direct competitors?',
      'Who are secondary competitors?',
      'Who are indirect competitors?'
    ]},
    { id: 'differentiation', title: 'Differentiation', questions: [
      'What are key differentiators?',
      'How do you solve it differently?',
      'Why is that better?'
    ]},
    { id: 'objections', title: 'Objections & Anti-Persona', questions: [
      'What are the top objections?',
      'Who is NOT a good fit?'
    ]},
    { id: 'language', title: 'Customer Language', questions: [
      'How do customers describe the problem?',
      'What words should we use?',
      'What words should we avoid?'
    ]},
    { id: 'voice', title: 'Brand Voice', questions: [
      'What is your tone?',
      'What is your communication style?',
      'What adjectives describe your brand?'
    ]},
    { id: 'proof', title: 'Proof Points', questions: [
      'What metrics can you cite?',
      'What notable customers?',
      'What testimonials?'
    ]},
    { id: 'goals', title: 'Goals', questions: [
      'What is the primary business goal?',
      'What is the key conversion action?'
    ]}
  ]

  // Check for existing context files
  const contextPaths = [
    join(process.cwd(), '.agents/product-marketing-context.md'),
    join(process.cwd(), '.claude/product-marketing-context.md'),
    join(process.cwd(), 'BRAND.md')
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
  let outputContent = '# Product Marketing Context\n\n'
  outputContent += `*Last updated: ${timestamp}*\n\n`

  if (existingContext) {
    outputContent += `*Based on existing context at: ${existingContext.path}*\n\n`
  }

  // Add sections
  for (const section of sections) {
    outputContent += `## ${section.title}\n\n`
    outputContent += '- [TODO: Complete based on questions below]\n\n'
    outputContent += '**Questions:**\n'
    for (const q of section.questions) {
      outputContent += `- ${q}\n`
    }
    outputContent += '\n'
  }

  outputContent += '---\n\n'
  outputContent += '## Usage\n\n'
  outputContent += 'This document is the foundation for all marketing activities.\n'
  outputContent += 'Other marketing skills will reference this context.\n'

  // Write output
  const outputPath = join(output, 'product-marketing-context.md')
  await writeFile(outputPath, outputContent, 'utf-8')

  console.error(`Output written to: ${outputPath}`)
  console.error('')
  console.error('Next steps:')
  console.error('1. Review and complete the sections')
  console.error('2. Save to .agents/product-marketing-context.md')
  console.error('3. Use this context in other marketing skills')

  return { success: true, output: outputPath, sections: sections.length }
}
