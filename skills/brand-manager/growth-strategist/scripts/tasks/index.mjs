/**
 * Growth Strategist - Task Executor
 * 
 * Central registry and execution hub for all tasks in the bundle.
 */

import { executeIdeasTask } from './ideas.mjs';
import { executeFreetoolsTask } from './freetools.mjs';

/**
 * Task registry mapping task names to executor functions
 */
const TASK_REGISTRY = {
  'ideas': executeIdeasTask,
  'marketing-ideas': executeIdeasTask,
  'freetools': executeFreetoolsTask,
  'free-tool-strategy': executeFreetoolsTask
};

/**
 * List all available tasks
 */
export function listTasks() {
  return Object.keys(TASK_REGISTRY).map(task => ({
    name: task,
    aliases: getAliases(task)
  }));
}

/**
 * Get aliases for a task
 */
function getAliases(task) {
  return Object.entries(TASK_REGISTRY)
    .filter(([name]) => name !== task && TASK_REGISTRY[name] === TASK_REGISTRY[task])
    .map(([name]) => name);
}

/**
 * Execute a task by name with configuration
 */
export async function executeTask(taskName, config = {}) {
  const executor = TASK_REGISTRY[taskName];
  
  if (!executor) {
    return {
      success: false,
      error: `Unknown task: ${taskName}\n\nAvailable tasks:\n${listTasks().map(t => `  - ${t.name} (aliases: ${t.aliases.join(', ')})`).join('\n')}`
    };
  }

  try {
    return await executor(config);
  } catch (error) {
    return {
      success: false,
      error: `Task execution failed: ${error.message}`
    };
  }
}

/**
 * Print available tasks to console
 */
export function printAvailableTasks() {
  console.log('Growth Strategist - Available Tasks\n');
  console.log('='.repeat(50));
  
  listTasks().forEach(({ name, aliases }) => {
    console.log(`\n${name}`);
    if (aliases.length > 0) {
      console.log(`  Aliases: ${aliases.join(', ')}`);
    }
  });
  
  console.log('\n');
}

export default {
  TASK_REGISTRY,
  executeTask,
  listTasks,
  printAvailableTasks
};
