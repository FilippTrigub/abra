import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

export async function runTask(taskName, options, rootDir) {
  const { outputFormat } = options;
  
  console.log(`Running task: ${taskName}`);
  console.log(`Output format: ${outputFormat}`);

  const taskPath = join(rootDir, 'scripts', 'tasks', `${taskName}.js`);
  
  if (!existsSync(taskPath)) {
    console.error(`Task not found: ${taskPath}`);
    process.exit(1);
  }
  
  const { run } = await import(taskPath);

  const inputDir = join(rootDir, 'input');
  const outputDir = join(rootDir, 'output');
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const inputFiles = [];
  if (existsSync(inputDir)) {
    const patterns = ['*', '*/*', '**/*'];
    for (const pattern of patterns) {
      const files = glob.sync(join(inputDir, pattern), { nodir: true });
      inputFiles.push(...files);
    }
  }
  
  if (inputFiles.length > 0) {
    console.log(`Found ${inputFiles.length} source file(s) in input/`);
  } else {
    console.log('No source files found in input/');
  }

  const result = await run({ inputDir, outputDir, outputFormat });

  if (result.output) {
    const outputPath = join(outputDir, `${taskName}.${outputFormat}`);
    writeFileSync(outputPath, result.output, 'utf-8');
    console.log(`Output written to: ${outputPath}`);
  }
  
  console.log(`Task ${taskName} completed successfully`);
  return result;
}
