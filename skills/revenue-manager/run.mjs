#!/usr/bin/env node
/**
 * Revenue Manager - Bundle with tasks: revops, crm
 * 
 * Source skills from: marketingskills (revops, community-marketing)
 */

import { config } from 'dotenv';
config({ path: '.env' });

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  console.log(`
Revenue Manager
============================

Usage: uv run run.mjs <command> [options]

Commands:
  revops     Revenue operations task - lead lifecycle, scoring, routing, pipeline
  crm        CRM configuration task - community marketing and CRM integration

Options:
  --input <dir>    Input directory (default: ./input)
  --output <dir>   Output directory (default: ./output)
  --device <type>  Processing device: auto, cpu, cuda (default: auto)

Examples:
  uv run run.mjs revops --input ./input --output ./output
  uv run run.mjs crm --input ./input --output ./output
`);
  process.exit(0);
}

// Task runners
async function runRevops() {
  const { revopsTask } = await import('./scripts/tasks/revops.mjs');
  const config = readConfig();
  await revopsTask(config);
}

async function runCrm() {
  const { crmTask } = await import('./scripts/tasks/crm.mjs');
  const config = readConfig();
  await crmTask(config);
}

function readConfig() {
  const fs = require('fs');
  const path = require('path');
  
  const configPath = path.join(process.cwd(), 'config.json');
  const defaults = fs.existsSync(configPath) 
    ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    : {
        input_dir: './input',
        output_dir: './output',
        device: 'auto'
      };

  const overrides = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      overrides.input_dir = args[++i];
    } else if (args[i] === '--output' && args[i + 1]) {
      overrides.output_dir = args[++i];
    } else if (args[i] === '--device' && args[i + 1]) {
      overrides.device = args[++i];
    }
  }

  return { ...defaults, ...overrides };
}

const tasks = {
  revops: runRevops,
  crm: runCrm,
};

if (tasks[command]) {
  try {
    await tasks[command]();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
} else {
  console.error(`Unknown command: ${command}`);
  console.error('Run "uv run run.mjs --help" for usage.');
  process.exit(1);
}
