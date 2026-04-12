#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { runTask } from './task-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = dirname(__dirname);

// Load config
const configPath = join(rootDir, 'config.json');
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf-8')) : {};

// Parse CLI arguments
const args = process.argv.slice(2);
let task = config.default_task || 'email';
let outputFormat = config.output_format || 'markdown';
let enabledTasks = config.enabled_tasks || ['email'];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--task' && args[i + 1]) {
    task = args[++i];
  } else if (args[i] === '--output' && args[i + 1]) {
    outputFormat = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    printHelp();
    process.exit(0);
  }
}

// Validate task
if (!enabledTasks.includes(task)) {
  console.error(`Unknown task: ${task}`);
  console.error(`Enabled tasks: ${enabledTasks.join(', ')}`);
  process.exit(1);
}

// Run the task
await runTask(task, { outputFormat }, rootDir);

function printHelp() {
  console.log(`
Email Campaigner

Usage:
  uv run python scripts/run.mjs --task <task-name> [options]

Available Tasks:
  email             - Create email campaigns and sequences

Options:
  --task <name>     Task to run (default: email)
  --output <format> Output format (default: markdown)
  --help, -h        Show this help message

Examples:
  uv run python scripts/run.mjs --task email
  uv run python scripts/run.mjs --task email --output json
`);
}
