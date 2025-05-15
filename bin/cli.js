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
} from "../lib/index.js"; // SVG optimization library functions
import { statSync } from "fs"; // File system sync stat for checking file info
import os from "os"; // OS utilities (e.g., CPU count)

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

    // Array to store results (currently unused but can be extended)
    const results = [];
    let active = 0; // Count of active concurrent tasks (optional)
    let index = 0; // Current file index for concurrency control

    /**
     * Processes a single SVG file: optimize, validate, write output, export PNG if needed.
     * @param {string} file - Full path to SVG file
     * @returns {Promise<{file:string,success:boolean,error?:Error}>}
     */
    async function processFile(file) {
      try {
        // Optimize SVG with options from CLI flags (aggressive mode and plugins)
        const optimizedSVG = await optimizeSVGFromFile(file, {
          aggressive: options.aggressive,
          plugins: options.plugin,
        });

        // Validate the optimized SVG to catch any potential issues
        if (!validateSVG(optimizedSVG)) {
          console.warn(
            chalk.red(`⚠ Warning: Optimized SVG invalid for file ${file}`)
          );
        }

        // Read original file to get size info for reporting
        const original = await fs.readFile(file, "utf-8");
        const originalSize = Buffer.byteLength(original, "utf-8");
        const optimizedSize = Buffer.byteLength(optimizedSVG, "utf-8");

        // Calculate percent size reduction
        const percentReduced = (
          ((originalSize - optimizedSize) / originalSize) *
          100
        ).toFixed(2);

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
        if (options.aggressive && percentReduced > 10) {
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
          await processFile(file);
        }
      });
      // Wait for all concurrent tasks to complete
      await Promise.all(promises);
    }

    // Start the concurrent processing of files
    await runConcurrent();
  });

// Parse CLI arguments and execute
program.parse();
