#!/usr/bin/env node
/**
 * Ads Manager
 * 
 * A comprehensive bundle for managing paid marketing campaigns across:
 * - Ads planning and strategy
 * - Creative asset generation
 * - Analytics and tracking configuration
 * 
 * Usage:
 *   node run.mjs --task <task-name> [options]
 * 
 * Available tasks:
 *   ads-plan      - Create and manage advertising campaigns
 *   creative      - Generate and optimize ad creative assets
 *   tracking      - Set up analytics and conversion tracking
 */

const args = process.argv.slice(2);
const options = {};

// Parse args: supports both `--task ads-plan` and positional first arg
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const next = args[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options[key] = next;
      i++;
    } else {
      options[key] = true;
    }
  } else if (i === 0) {
    options.task = args[i];
  }
}

const task = options.task;

const tasks = {
  'ads-plan': () => import('./scripts/tasks/ads-plan.mjs'),
  'creative': () => import('./scripts/tasks/creative.mjs'),
  'tracking': () => import('./scripts/tasks/tracking.mjs'),
};

if (!task || !tasks[task]) {
  console.log('Ads Manager');
  console.log('====================================');
  console.log('\nUsage: node run.mjs --task <task-name> [options]\n');
  console.log('Available tasks:');
  console.log('  ads-plan      - Create and manage advertising campaigns');
  console.log('  creative      - Generate and optimize ad creative assets');
  console.log('  tracking      - Set up analytics and conversion tracking');
  console.log('\nExamples:');
  console.log('  node run.mjs --task ads-plan --platform google-ads --budget 1000');
  console.log('  node run.mjs --task creative --format square --ai-enhance');
  console.log('  node run.mjs --task tracking --ga4-measurement-id G-XXXXXX');
  process.exit(1);
}

const module = await tasks[task]();
await module.main(options);
