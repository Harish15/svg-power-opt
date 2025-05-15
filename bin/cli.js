#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import fg from "fast-glob";
import fs from "fs-extra";
import path from "path";
import {
  optimizeSVGFromFile,
  exportPNGThumbnail,
  validateSVG,
} from "../lib/index.js";
import { statSync } from "fs";
import os from "os";

function isDirectory(pathStr) {
  try {
    return statSync(pathStr).isDirectory();
  } catch {
    return false;
  }
}

const program = new Command();

program
  .name("svg-power-opt")
  .description("Powerful SVG optimizer without quality loss")
  .argument("<input>", "Input file or glob pattern")
  .option("-o, --out <dir>", "Output directory", "optimized")
  .option("--aggressive", "Enable aggressive optimization", false)
  .option("--dry-run", "Preview changes without writing files")
  .option(
    "--export-png",
    "Export PNG thumbnails alongside optimized SVGs",
    false
  )
  .option(
    "--concurrency <number>",
    "Number of parallel optimizations",
    parseInt,
    os.cpus().length
  )
  .option("--plugin <plugin>", "Custom SVGO plugin JSON string", (val, memo) => {
    memo.push(JSON.parse(val));
    return memo;
  }, [])
  .action(async (input, options) => {
    let files = [];

    if (isDirectory(input)) {
      files = await fg(["**/*.{svg,svgz}"], { cwd: input, absolute: true });
    } else {
      files = await fg([input], { absolute: true });
    }

    if (!options.dryRun) await fs.ensureDir(options.out);

    // Limit concurrency for parallel processing
    const concurrency = options.concurrency > 0 ? options.concurrency : 1;

    // Process files in batches
    const results = [];
    let active = 0;
    let index = 0;

    async function processFile(file) {
      try {
        const optimizedSVG = await optimizeSVGFromFile(file, {
          aggressive: options.aggressive,
          plugins: options.plugin,
        });

        // Validate SVG output
        if (!validateSVG(optimizedSVG)) {
          console.warn(chalk.red(`⚠ Warning: Optimized SVG invalid for file ${file}`));
        }

        const original = await fs.readFile(file, "utf-8");
        const originalSize = Buffer.byteLength(original, "utf-8");
        const optimizedSize = Buffer.byteLength(optimizedSVG, "utf-8");
        const percentReduced = (((originalSize - optimizedSize) / originalSize) * 100).toFixed(2);
        const outPath = path.join(options.out, path.basename(file));

        if (!options.dryRun) {
          await fs.writeFile(outPath, optimizedSVG);
          if (options.exportPng) {
            const pngPath = outPath.replace(/\.(svg|svgz)$/i, ".png");
            await exportPNGThumbnail(optimizedSVG, pngPath);
          }
        }

        console.log(
          `${chalk.green("✔ Optimized:")} ${file} → ${options.dryRun ? "(dry-run, no write)" : outPath} ` +
            `${chalk.gray(
              `(${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB, ↓${percentReduced}%)`
            )}`
        );

        if (options.aggressive && percentReduced > 10) {
          console.warn(
            chalk.yellowBright(
              `⚠ Aggressive mode reduced more than 10% — please verify visual integrity of: ${file}`
            )
          );
        }

        return { file, success: true };
      } catch (e) {
        console.error(chalk.red(`✖ Failed to optimize ${file}: ${e.message}`));
        return { file, success: false, error: e };
      }
    }

    // Simple concurrency limiter
    async function runConcurrent() {
      const promises = new Array(concurrency).fill(null).map(async () => {
        while (index < files.length) {
          const file = files[index++];
          await processFile(file);
        }
      });
      await Promise.all(promises);
    }

    await runConcurrent();
  });

program.parse();
