#!/usr/bin/env node
/**
 * Growth Strategist - Run Entry Point
 * 
 * A strategy bundle for generating growth ideas
 * and discovering free tools to support growth work.
 */

import { executeTask } from './scripts/tasks/index.mjs';

// Parse CLI arguments
const args = process.argv.slice(2);
const taskName = args.find(arg => !arg.startsWith('--'));
const config = {};

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, ...valueParts] = arg.slice(2).split('=');
    const value = valueParts.join('=') || true;
    config[key] = value === 'true' || value === 'false' ? JSON.parse(value) : value;
  }
});

// Map task aliases
const taskMap = {
  'ideas': 'marketing-ideas',
  'freetools': 'free-tool-strategy',
};

const resolvedTask = taskMap[taskName] || taskName;

if (!resolvedTask) {
  console.error('Usage: uv run python scripts/<script>.py --task <ideas|freetools> [options]');
  console.error('');
  console.error('Available tasks:');
  console.error('  ideas      - Generate marketing campaign ideas');
  console.error('  freetools  - Discover free marketing tools');
  process.exit(1);
}

try {
  const result = await executeTask(resolvedTask, config);
  
  if (result.success) {
    console.log('✓ Task completed successfully');
    if (result.output) {
      console.log('\nOutput:');
      console.log(result.output);
    }
    process.exit(0);
  } else {
    console.error('✗ Task failed:', result.error);
    process.exit(1);
  }
} catch (error) {
  console.error('✗ Unexpected error:', error.message);
  process.exit(1);
}
