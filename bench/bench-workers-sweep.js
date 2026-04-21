// Sweep worker-pool size to find the optimum for this machine.
// Runs the full 245-file corpus (safe mode) at several --workers values.
import fs from "fs-extra";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { performance } from "perf_hooks";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(__dirname, "corpus");
const CLI = path.join(__dirname, "..", "bin", "cli.js");
const glob = path.join(CORPUS, "*.svg").replace(/\\/g, "/");

async function runCli(args) {
  const t0 = performance.now();
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], { stdio: "ignore" });
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
  });
  return performance.now() - t0;
}

const outDir = path.join(__dirname, "output", "sweep");
const configs = [
  { label: "async (no workers)", args: [] },
  { label: "workers=1", args: ["--workers", "1"] },
  { label: "workers=2", args: ["--workers", "2"] },
  { label: "workers=4", args: ["--workers", "4"] },
  { label: "workers=6", args: ["--workers", "6"] },
  { label: "workers=8", args: ["--workers", "8"] },
];

const rows = [];
for (const c of configs) {
  const times = [];
  for (let i = 0; i < 3; i++) {
    await fs.emptyDir(outDir);
    times.push(await runCli([glob, "--out", outDir, ...c.args]));
  }
  times.sort((a, b) => a - b);
  const best = times[0];
  const median = times[1];
  rows.push({
    config: c.label,
    best_ms: +best.toFixed(1),
    median_ms: +median.toFixed(1),
    filesPerSec: +(245 / (median / 1000)).toFixed(2),
  });
  console.log(`${c.label}: median=${median.toFixed(0)}ms best=${best.toFixed(0)}ms`);
}

console.log(`\nCPUs=${os.cpus().length}`);
console.table(rows);
