#!/usr/bin/env node

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI argument parser
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      parsed[key] = value;
      i++;
    }
  }
  
  return parsed;
}

const args = parseArgs();

// Supported tasks mapped to marketingSkills names
const TASKS = {
  'audit': 'seo-audit',
  'aiseo': 'ai-seo',
  'pseo': 'programmatic-seo',
  'clusters': 'site-architecture',
  'competitors': 'competitor-alternatives'
};

const TASKS_LIST = Object.keys(TASKS).join(', ');
const MARKETINGSKILLS_NAMES = Object.values(TASKS).join(', ');

// Check for --task flag
if (!args.task) {
  console.log('SEO Researcher');
  console.log('================================');
  console.log('');
  console.log('Usage: uv run python scripts/run.mjs --task <task-name> [options]');
  console.log('');
  console.log('Available tasks:');
  for (const [key, value] of Object.entries(TASKS)) {
    console.log(`  --task ${key.padEnd(12)}  ${value}`);
  }
  console.log('');
  console.log(`Task names correspond to marketingSkills: ${MARKETINGSKILLS_NAMES}`);
  console.log('');
  console.log('Example:');
  console.log('  uv run python scripts/run.mjs --task audit --domain example.com');
  process.exit(1);
}

const taskName = args.task.toLowerCase();

if (!TASKS.hasOwnProperty(taskName)) {
  console.error(`Error: Unknown task "${taskName}"`);
  console.error('');
  console.log('Available tasks:');
  for (const key of Object.keys(TASKS)) {
    console.log(`  --task ${key}`);
  }
  process.exit(1);
}

// Map to marketingSkills name
const marketingSkillName = TASKS[taskName];

// Import and run the task
const taskPath = join(__dirname, 'tasks', `${taskName}.mjs`);

if (!existsSync(taskPath)) {
  console.error(`Error: Task file not found: ${taskPath}`);
  process.exit(1);
}

try {
  const taskModule = await import(taskPath);
  const taskFn = taskModule.default || taskModule;
  
  await taskFn(args);
  console.log(`\n✅ Task "${marketingSkillName}" completed successfully`);
} catch (error) {
  console.error(`Error running task "${marketingSkillName}":`, error.message);
  process.exit(1);
}
