// Quick proof that the current CLI "concurrency" flag doesn't actually
// parallelize CPU-bound SVGO work on a single Node thread. Runs the same
// corpus with concurrency=1 and concurrency=8 and compares wall time.
import fs from "fs-extra";
import path from "path";
import os from "os";
import { performance } from "perf_hooks";
import { fileURLToPath } from "url";
import { optimizeSVGFromFile } from "../lib/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(__dirname, "corpus");
const files = (await fs.readdir(CORPUS)).map((f) => path.join(CORPUS, f));

async function run(conc) {
  let idx = 0;
  const workers = new Array(conc).fill(null).map(async () => {
    while (idx < files.length) {
      const f = files[idx++];
      await optimizeSVGFromFile(f, { aggressive: false });
    }
  });
  const t0 = performance.now();
  await Promise.all(workers);
  return performance.now() - t0;
}

// warm up
for (let i = 0; i < 2; i++) await run(1);

const rows = [];
for (const c of [1, 2, 4, 8]) {
  const ms = await run(c);
  rows.push({ concurrency: c, ms: +ms.toFixed(1), filesPerSec: +(files.length / (ms/1000)).toFixed(2) });
}
console.log(`CPUs=${os.cpus().length}, files=${files.length}`);
console.table(rows);
