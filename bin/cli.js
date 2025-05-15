#!/usr/bin/env node
import chalk from "chalk";
import { Command } from "commander";
import fg from "fast-glob";
import fs from "fs-extra";
import path from "path";
import { optimizeSVGFromFile } from "../lib/index.js";
import { statSync } from "fs";

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
  .option("--aggressive", "Enable aggressive optimization", true)
  .action(async (input, options) => {
    let files = [];

    if (isDirectory(input)) {
      // Recursively get all .svg files in the directory
      files = await fg(["**/*.svg"], { cwd: input, absolute: true });
    } else {
      // Handle glob patterns or single files
      files = await fg([input], { absolute: true });
    }

    await fs.ensureDir(options.out);

    for (const file of files) {
      const original = await fs.readFile(file, "utf-8");
      const originalSize = Buffer.byteLength(original, "utf-8");

      const optimized = await optimizeSVGFromFile(file, {
        aggressive: options.aggressive,
      });
      const optimizedSize = Buffer.byteLength(optimized, "utf-8");

      const percentReduced = (
        ((originalSize - optimizedSize) / originalSize) *
        100
      ).toFixed(2);

      const outPath = path.join(options.out, path.basename(file));
      await fs.writeFile(outPath, optimized);

      console.log(
        `${chalk.green("✔ Optimized:")} ${file} → ${outPath} ` +
          `${chalk.gray(
            `(${(originalSize / 1024).toFixed(1)}KB → ${(
              optimizedSize / 1024
            ).toFixed(1)}KB, ↓${percentReduced}%)`
          )}`
      );

      if (options.aggressive && percentReduced > 10) {
        console.warn(
          chalk.yellowBright(
            `⚠ Aggressive mode reduced more than 10% — please verify visual integrity of: ${file}`
          )
        );
      }
    }
  });

program.parse();
