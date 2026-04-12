#!/usr/bin/env node

/**
 * Funnel Optimizer
 * Routes to tasks: CRO, Signup, Onboarding, Form, Experiment, Retention
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptsDir = join(__dirname, 'scripts');
const tasksDir = join(scriptsDir, 'tasks');

const tasks = {
  cro: { path: join(tasksDir, 'cro.mjs'), description: 'Page conversion rate optimization analysis' },
  signup: { path: join(tasksDir, 'signup.mjs'), description: 'Signup flow optimization analysis' },
  onboarding: { path: join(tasksDir, 'onboarding.mjs'), description: 'Post-signup onboarding optimization analysis' },
  form: { path: join(tasksDir, 'form.mjs'), description: 'Non-signup form optimization analysis' },
  experiment: { path: join(tasksDir, 'experiment.mjs'), description: 'A/B test setup and experiment design' },
  retention: { path: join(tasksDir, 'retention.mjs'), description: 'Churn prevention and retention strategy' }
};

const taskNames = Object.keys(tasks);
const currentArg = process.argv[2];

function printUsage() {
  console.log(`
Funnel Optimizer

Usage: uv run python scripts/run.mjs <task> [options]

Tasks:
${taskNames.map(name => `  ${name.padEnd(12)} - ${tasks[name].description}`).join('\n')}

Examples:
  uv run python scripts/run.mjs cro
  uv run python scripts/run.mjs signup --input ./input --output ./output
  uv run python scripts/run.mjs experiment --hypothesis "New CTA increases signups"
`);
}

if (!currentArg) {
  printUsage();
  process.exit(1);
}

if (currentArg === '--help' || currentArg === '-h') {
  printUsage();
  process.exit(0);
}

if (!taskNames.includes(currentArg)) {
  console.error(`Error: Unknown task "${currentArg}"`);
  console.error(`Available tasks: ${taskNames.join(', ')}`);
  process.exit(1);
}

const taskPath = tasks[currentArg].path;
const taskScript = `uv run python "${taskPath}"`;

console.log(`\n🚀 Running ${currentArg} task...`);
console.log(`   Command: ${taskScript}\n`);

const child = spawn('bash', ['-c', taskScript], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error(`Failed to start task: ${err.message}`);
  process.exit(1);
});
