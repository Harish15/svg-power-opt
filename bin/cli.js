#!/usr/bin/env node
import chalk from "chalk"; // For colorful console output
import { Command } from "commander"; // CLI command parser
import fg from "fast-glob"; // Glob file matching utility
import fs from "fs-extra"; // File system utilities with promises
import path from "path"; // Path utilities
import {
  optimizeSVGFromFile,
  exportPNGThumbnail,
  validateSVG,
  WorkerPool,
} from "../lib/index.js"; // SVG optimization library functions
import { statSync } from "fs"; // File system sync stat for checking file info
import os from "os"; // OS utilities (e.g., CPU count)
import zlib from "zlib";
import { promisify } from "util";
const gunzipAsync = promisify(zlib.gunzip);

/**
 * Helper function to check if a given path is a directory.
 * Returns true if directory, false otherwise or on error.
 * @param {string} pathStr - Path to check
 * @returns {boolean}
 */
function isDirectory(pathStr) {
  try {
    return statSync(pathStr).isDirectory();
  } catch {
    return false; // If stat fails (e.g., file doesn't exist), treat as not directory
  }
}

const program = new Command(); // Create new CLI program instance

// Define the CLI interface and options
program
  .name("svg-power-opt") // CLI command name
  .description("Powerful SVG optimizer without quality loss") // Description shown in help
  .argument("<input>", "Input file or glob pattern") // Required input argument
  .option("-o, --out <dir>", "Output directory", "optimized") // Output folder option with default
  .option("--aggressive", "Enable aggressive optimization", false) // Flag for aggressive mode (default false)
  .option("--dry-run", "Preview changes without writing files") // Flag to skip writing output
  .option(
    "--export-png",
    "Export PNG thumbnails alongside optimized SVGs",
    false
  ) // Flag to export PNG thumbnails (default false)
  .option(
    "--concurrency <number>",
    "Number of parallel optimizations",
    parseInt,
    os.cpus().length // Default concurrency equals number of CPU cores
  )
  .option(
    "--strict-validate",
    "Run full SVGO re-parse to validate each optimized output (slower)",
    false
  )
  .option(
    "--workers [n]",
    "Use worker_threads pool for true parallel optimization (default: CPU count)",
    (val) => (val === undefined ? true : Number(val))
  )
  .option(
    "--plugin <plugin>",
    "Custom SVGO plugin JSON string",
    (val, memo) => {
      // Parse and accumulate multiple --plugin JSON strings into array
      memo.push(JSON.parse(val));
      return memo;
    },
    []
  )
  .action(async (input, options) => {
    let files = [];

    // If input is a directory, use fast-glob to find all SVG/SVGZ files recursively
    if (isDirectory(input)) {
      files = await fg(["**/*.{svg,svgz}"], { cwd: input, absolute: true });
    } else {
      // Otherwise treat input as a glob pattern or single file path
      files = await fg([input], { absolute: true });
    }

    // Ensure output directory exists unless dry-run mode is enabled
    if (!options.dryRun) await fs.ensureDir(options.out);

    // Determine concurrency; ensure at least 1 to avoid zero concurrency
    const concurrency = options.concurrency > 0 ? options.concurrency : 1;

    const outcomes = [];
    let index = 0; // Current file index for concurrency control

    /**
     * Processes a single SVG file: optimize, validate, write output, export PNG if needed.
     * @param {string} file - Full path to SVG file
     * @returns {Promise<{file:string,success:boolean,error?:Error}>}
     */
    async function processFile(file) {
      try {
        // Optimize SVG and get original/optimized sizes in a single pass; this
        // avoids re-reading (and re-decompressing) the source file just to
        // compute the original size for reporting.
        const { data: optimizedSVG, originalSize, optimizedSize } =
          await optimizeSVGFromFile(file, {
            aggressive: options.aggressive,
            plugins: options.plugin,
            withSizes: true,
          });

        // Cheap structural validation of the optimized output. Strict SVGO
        // re-parsing is opt-in via --strict-validate for users who need it.
        if (!validateSVG(optimizedSVG, { strict: options.strictValidate })) {
          console.warn(
            chalk.red(`⚠ Warning: Optimized SVG invalid for file ${file}`)
          );
        }

        const percentReducedNum =
          originalSize > 0
            ? ((originalSize - optimizedSize) / originalSize) * 100
            : 0;
        const percentReduced = percentReducedNum.toFixed(2);

        // Determine output file path (same filename inside output directory)
        const outPath = path.join(options.out, path.basename(file));

        // If not dry run, write optimized SVG to disk
        if (!options.dryRun) {
          await fs.writeFile(outPath, optimizedSVG);

          // If PNG export option is enabled, generate PNG thumbnail alongside SVG
          if (options.exportPng) {
            // Replace .svg or .svgz extension with .png
            const pngPath = outPath.replace(/\.(svg|svgz)$/i, ".png");
            await exportPNGThumbnail(optimizedSVG, pngPath);
          }
        }

        // Log success message with original and optimized sizes
        console.log(
          `${chalk.green("✔ Optimized:")} ${file} → ${
            options.dryRun ? "(dry-run, no write)" : outPath
          } ` +
            `${chalk.gray(
              `(${(originalSize / 1024).toFixed(1)}KB → ${(
                optimizedSize / 1024
              ).toFixed(1)}KB, ↓${percentReduced}%)`
            )}`
        );

        // Warn user if aggressive mode reduced size more than 10% to check visuals
        if (options.aggressive && originalSize > 0 && percentReducedNum > 10) {
          console.warn(
            chalk.yellowBright(
              `⚠ Aggressive mode reduced more than 10% — please verify visual integrity of: ${file}`
            )
          );
        }

        return { file, success: true };
      } catch (e) {
        // Log error if optimization fails for a file
        console.error(chalk.red(`✖ Failed to optimize ${file}: ${e.message}`));
        return { file, success: false, error: e };
      }
    }

    /**
     * Runs multiple concurrent optimization tasks to utilize CPU cores.
     * Limits concurrency using an index and loops through all files.
     */
    async function runConcurrent() {
      // Create an array of "concurrency" promises, each runs a loop grabbing files until done
      const promises = new Array(concurrency).fill(null).map(async () => {
        while (index < files.length) {
          const file = files[index++]; // Get next file to process
          outcomes.push(await processFile(file));
        }
      });
      // Wait for all concurrent tasks to complete
      await Promise.all(promises);
    }

    // --workers enables a real thread pool. It offloads SVGO (CPU-bound and
    // blocking) to worker_threads and handles all file I/O here on the main
    // thread. For large batches this is the biggest win available.
    async function runWithWorkers() {
      // Default pool size: half of logical CPUs, capped to the batch size.
      // Spinning up one worker per core is wasteful on small batches (worker
      // startup on Windows is ~300-500ms each) and tends to overshoot the
      // sweet spot on 8+ core machines according to the benchmark sweep.
      const requested = typeof options.workers === "number" && options.workers > 0
        ? options.workers
        : Math.max(2, Math.floor(os.cpus().length / 2));
      const size = Math.max(1, Math.min(requested, files.length));
      const pool = new WorkerPool(size, {
        aggressive: options.aggressive,
      });
      try {
        let inflight = 0;
        let done = 0;
        let fileIdx = 0;
        await new Promise((resolve, reject) => {
          const kick = () => {
            while (inflight < size && fileIdx < files.length) {
              const file = files[fileIdx++];
              inflight++;
              (async () => {
                try {
                  let content;
                  if (file.endsWith(".svgz")) {
                    content = (await gunzipAsync(await fs.readFile(file))).toString("utf-8");
                  } else {
                    content = await fs.readFile(file, "utf-8");
                  }
                  const originalSize = Buffer.byteLength(content, "utf-8");
                  const optimizedSVG = await pool.run(content, {
                    aggressive: options.aggressive,
                  });
                  const optimizedSize = Buffer.byteLength(optimizedSVG, "utf-8");
                  if (!validateSVG(optimizedSVG, { strict: options.strictValidate })) {
                    console.warn(chalk.red(`⚠ Warning: Optimized SVG invalid for file ${file}`));
                  }
                  const percentReducedNum =
                    originalSize > 0
                      ? ((originalSize - optimizedSize) / originalSize) * 100
                      : 0;
                  const outPath = path.join(options.out, path.basename(file));
                  if (!options.dryRun) {
                    await fs.writeFile(outPath, optimizedSVG);
                    if (options.exportPng) {
                      const pngPath = outPath.replace(/\.(svg|svgz)$/i, ".png");
                      await exportPNGThumbnail(optimizedSVG, pngPath);
                    }
                  }
                  console.log(
                    `${chalk.green("✔ Optimized:")} ${file} → ${
                      options.dryRun ? "(dry-run, no write)" : outPath
                    } ` +
                      `${chalk.gray(
                        `(${(originalSize / 1024).toFixed(1)}KB → ${(
                          optimizedSize / 1024
                        ).toFixed(1)}KB, ↓${percentReducedNum.toFixed(2)}%)`
                      )}`
                  );
                  if (options.aggressive && percentReducedNum > 10) {
                    console.warn(
                      chalk.yellowBright(
                        `⚠ Aggressive mode reduced more than 10% — please verify visual integrity of: ${file}`
                      )
                    );
                  }
                  outcomes.push({ file, success: true });
                } catch (e) {
                  console.error(chalk.red(`✖ Failed to optimize ${file}: ${e.message}`));
                  outcomes.push({ file, success: false, error: e });
                } finally {
                  inflight--;
                  done++;
                  if (done === files.length) resolve();
                  else kick();
                }
              })();
            }
          };
          if (files.length === 0) resolve();
          else kick();
        });
      } finally {
        await pool.terminate();
      }
    }

    if (options.workers) {
      await runWithWorkers();
    } else {
      await runConcurrent();
    }

    const failed = outcomes.filter((o) => !o.success).length;
    if (failed > 0) process.exit(1);
  });

// Parse CLI arguments and execute
program.parse();
