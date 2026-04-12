#!/usr/bin/env node
// Brand Strategist - Main entrypoint
// Skill for foundational brand and product positioning

import { parseArgs } from 'node:util'
import { existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function parseCLI(args) {
  const result = { input: './input', output: './output', task: null, format: 'markdown' }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--input' && args[i + 1]) result.input = args[++i]
    else if (arg === '--output' && args[i + 1]) result.output = args[++i]
    else if (arg === '--task' && args[i + 1]) result.task = args[++i]
    else if (arg === '--format' && args[i + 1]) result.format = args[++i]
  }
  return result
}

const args = parseCLI(process.argv.slice(2))

// Ensure directories exist
if (!existsSync(args.input)) mkdirSync(args.input, { recursive: true })
if (!existsSync(args.output)) mkdirSync(args.output, { recursive: true })

console.error('# Brand Strategist')
console.error('')
console.error('Available tasks:')
console.error('  position   - Create/update product positioning')
console.error('  research  - Customer research and persona development')
console.error('  psychology - Marketing psychology application')
console.error('  pricing   - Pricing strategy and tier structure')
console.error('')
console.error('Usage:')
console.error('  node scripts/run.mjs --task <task> --input ./input --output ./output')
console.error('')

if (!args.task) {
  console.log('No task specified. Running default: position')
  args.task = 'position'
}

// Route to task
const taskMap = {
  position: () => import('./tasks/position.mjs').then(m => m.run(args)),
  research: () => import('./tasks/research.mjs').then(m => m.run(args)),
  psychology: () => import('./tasks/psychology.mjs').then(m => m.run(args)),
  pricing: () => import('./tasks/pricing.mjs').then(m => m.run(args)),
}

const task = taskMap[args.task]
if (task) {
  task().catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
} else {
  console.error(`Unknown task: ${args.task}`)
  process.exit(1)
}
