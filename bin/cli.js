import chalk from 'chalk';
import { Command } from 'commander';
import fg from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';
import { optimizeSVGFromFile } from '../lib/index.js';

const program = new Command();

program
  .name('svg-power-opt')
  .description('Powerful SVG optimizer without quality loss')
  .argument('<input>', 'Input file or glob pattern')
  .option('-o, --out <dir>', 'Output directory', 'optimized')
  .option('--aggressive', 'Enable aggressive optimization', true) // Default to aggressive optimization
  .action(async (input, options) => {
    const files = await fg([input]);
    await fs.ensureDir(options.out);
    for (const file of files) {
      const optimized = await optimizeSVGFromFile(file, { aggressive: options.aggressive });
      const outPath = path.join(options.out, path.basename(file));
      await fs.writeFile(outPath, optimized);
      console.log(chalk.green(`Optimized: ${file} → ${outPath}`));
    }
  });

program.parse();
