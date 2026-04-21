# svg-power-opt

**svg-power-opt** is a powerful and extensible SVG optimizer that compresses SVG files without sacrificing visual quality. It wraps [SVGO](https://github.com/svg/svgo) with a curated set of safe plugins, provides advanced CLI reporting, supports aggressive optimization modes, allows custom plugin configuration, and can export high-quality PNG thumbnails using [sharp](https://www.npmjs.com/package/sharp).
The tool supports both programmatic usage and Webpack integration — making it suitable for build pipelines, design systems, and automation tasks.

---

## ✨ Features

- 🔧 **Safe default optimizations** (zero visual loss)
- ⚡ **Aggressive mode** for maximum compression
- 🧵 **True parallelism via `worker_threads`** (`--workers` / `optimizeSVGBatch`) — up to ~3x faster on multi-core machines
- 📁 Supports **recursive folders** and glob patterns
- 📊 **Before/after size reporting** per file
- ⚠️ Warns on excessive reductions (>10%)
- ✅ Usable from **CLI, Node.js API, or Webpack**
- 📦 Handles **buffers, streams, files, and URLs**
- 🖼️ Optional **PNG thumbnail export**
- 🔌 Supports **custom SVGO plugins**
- 🔄 Configurable **concurrency for bulk ops**

---

## 📦 Installation

```bash
npm install -g svg-power-opt
```

Or use via NPX:

```bash
npx svg-power-opt icons/*.svg
```

---

## 🚀 CLI Usage

```bash
svg-power-opt <input> [options]
```

### Arguments:

- `<input>`: File path or glob pattern (e.g., `icons/**/*.svg`)

### Options:

- `-o, --out <dir>`: Output directory (default: `optimized`)
- `--aggressive`: Enable aggressive mode (default: `false`)
- `--dry-run`: Preview changes without writing files
- `--export-png`: Also export PNG thumbnail (requires sharp)
- `--concurrency <number>`: Event-loop concurrency for bulk ops (default: CPU count). Note: SVGO is synchronous and blocks the main thread, so this mostly helps overlap I/O — for true CPU parallelism use `--workers`.
- `--workers [n]`: Run SVGO in a `worker_threads` pool for true multi-core parallelism. If `n` is omitted, the pool is sized to `max(2, cpus/2)` and capped at the batch size (to avoid worker-startup cost dominating tiny batches).
- `--strict-validate`: Re-parse each optimized output with SVGO to validate it (slower). By default a cheap structural check is used.
- `--plugin <plugin>`: Add a custom SVGO plugin (JSON string)

### Example:

```bash
npx svg-power-opt icons/**/*.svg --out optimized/
npx svg-power-opt icons/**/*.svg --aggressive --export-png --out dist/icons

# Multi-core optimization (recommended for large batches):
npx svg-power-opt "icons/**/*.svg" --workers --out optimized/

# Pin the pool size to 4 worker threads:
npx svg-power-opt "icons/**/*.svg" --workers 4 --out optimized/
```

### When to use `--workers`

SVGO's `optimize()` is synchronous and blocks the Node event loop, so the
classic `--concurrency` flag cannot actually parallelize CPU work. The
`--workers` path off-loads optimization to real OS threads. In internal
benchmarks on an 8-core Windows machine (245-file / ~5 MB corpus, Node
22.15.1), the end-to-end CLI went from **~16 s** (`--concurrency 8`) to
**~5.2 s** at `--workers 4` — roughly **3x**. Output is byte-identical to
the non-worker path.

For small batches (a handful of files) the default async path is usually
faster, because worker-thread startup (~300–500 ms on Windows) outweighs the
per-file CPU savings.

---

## 📊 CLI Reporting

If any input file fails to optimize, the process exits with code **1** (useful in CI).

For each file, `svg-power-opt` shows:

- Original size
- Optimized size
- Compression %
- Warning if drop >10% in aggressive mode

```
✔ Optimized: icons/logo.svg → optimized/logo.svg (84.1KB → 66.7KB, ↓20.69%) ⚠️ (Aggressive)
```

---

## ⚙️ API Functions & Usage

| Function Name                                    | Description                                            | Parameters                                                                                                                                                                      | Returns / Output                                           |
| ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `optimizeSVG(svgString, options)`                | Optimizes an SVG string with given options             | `svgString` (string): raw SVG content<br>`options` (object): optimization settings (see below)                                                                                  | Optimized SVG result object with `.data` property (string) |
| `optimizeSVGFromFile(filePath, options)`         | Reads an SVG file, optimizes it, returns result        | `filePath` (string): path to SVG/SVGZ file<br>`options` (object): optimization settings. Set `options.withSizes = true` to get sizes back in the same call (avoids re-reading the input). | Promise resolving to optimized SVG **string** (`result.data`), or `{ data, originalSize, optimizedSize }` when `withSizes` is `true` |
| `optimizeSVGFromBuffer(buffer, options)`         | Optimizes SVG from a Buffer                            | `buffer` (Buffer): SVG data buffer<br>`options` (object): optimization settings                                                                                                 | Optimized SVG **string** (`result.data`)                     |
| `optimizeSVGFromURL(url, options)`               | Downloads an SVG from a URL and optimizes it           | `url` (string): remote SVG URL<br>`options` (object): optimization settings                                                                                                     | Promise resolving to optimized SVG **string** (uses global `fetch`, Node 18+) |
| `optimizeSVGStream(readableStream, options)`     | Optimizes SVG data from a readable stream              | `readableStream` (Readable): input stream<br>`options` (object): optimization settings                                                                                          | Promise resolving to optimized SVG **string**              |
| `optimizeSVGBatch(items, poolOptions)`           | Optimizes many SVG strings in parallel using a `worker_threads` pool | `items` (`Array<string>` **or** `Array<{content, options}>`): SVG payloads<br>`poolOptions` (object, optional): `{ concurrency, defaults }` — `concurrency` defaults to `os.cpus().length`; `defaults` are merged into each item's `options` | Promise resolving to `string[]` of optimized SVGs in the same order as input |
| `new WorkerPool(size, defaults)`                 | Long-lived worker pool for repeated batch optimization (e.g. servers, watchers) | `size` (number): pool size<br>`defaults` (object): default optimization options for every task. Use `pool.run(content, options)` to submit work and `pool.terminate()` when done. | `WorkerPool` instance |
| `exportPNGThumbnail(input, outputPath, options)` | Converts an SVG file or inline SVG markup to PNG       | `input` (string): SVG **file path** or raw markup string starting with `<svg`<br>`outputPath` (string): PNG output path<br>`options` (object): PNG export settings (width, height, density, quality) | Promise resolving when PNG file is saved                   |
| `validateSVG(svgString, options)`                | Validates if the string is a well-formed SVG           | `svgString` (string): raw SVG content<br>`options` (object, optional): `{ strict: true }` runs the full SVGO parser (slower); by default a fast structural check is used. | Boolean `true` if valid, `false` if invalid                |

---

## ⚙️ Configuration Options

### SVG Optimization

| Option             | Type    | Description                      | Default |
| ------------------ | ------- | -------------------------------- | ------- |
| `aggressive`       | Boolean | Enables deeper optimization      | `false` |
| `multipass`        | Boolean | Run multiple optimization passes | `true`  |
| `plugins`          | Array   | Custom SVGO plugins              | `[]`    |
| `preserveViewBox`  | Boolean | Prevents viewBox removal         | `true`  |
| `removeDimensions` | Boolean | Removes width/height attributes  | `true`  |

### PNG Export Options

| Option    | Type   | Description                     | Default |
| --------- | ------ | ------------------------------- | ------- |
| `width`   | Number | Output width in pixels          | `512`   |
| `height`  | Number | Output height in pixels         | `512`   |
| `density` | Number | SVG render density (DPI)        | `120`   |
| `quality` | Number | PNG compression quality (0–100) | `90`    |

---

## 🧑‍💻 Programmatic Usage

```js
// minimal working example
// create example.js
import fs from "fs";
import { optimizeSVGFromFile } from "svg-power-opt";

const run = async () => {
  const result = await optimizeSVGFromFile("icons/logo.svg", {
    aggressive: false,
  });
  // Write the optimized SVG to a new file
  await fs.promises.writeFile("icons/logo.optimized.svg", result, "utf-8");
  console.log("Optimized SVG saved to output/logo.optimized.svg");
};

run();

//execute
//node example.js

// Full API usage example:

import {
  optimizeSVG,
  optimizeSVGFromFile,
  optimizeSVGFromBuffer,
  optimizeSVGFromURL,
  optimizeSVGStream,
  exportPNGThumbnail,
  validateSVG,
} from "svg-power-opt";
import fs from "fs";

// Optimize from file
const optimized = await optimizeSVGFromFile("logo.svg", { aggressive: true });
console.log(optimized);

// Optimize from string
const rawSvg = await fs.promises.readFile("./logo.svg", "utf-8");
const result = optimizeSVG(rawSvg, {
  aggressive: true,
  preserveViewBox: false,
  removeDimensions: true,
});
console.log(result.data);

// Optimize from buffer
const buffer = fs.readFileSync("logo.svg");
const resultFromBuffer = optimizeSVGFromBuffer(buffer);
console.log(resultFromBuffer);

// Optimize from URL
const optimizedFromURL = await optimizeSVGFromURL(
  "https://example.com/image.svg"
);

// Optimize from readable stream (e.g., upload)
const optimizedFromStream = await optimizeSVGStream(req);

// Export PNG thumbnail
// PNG export preserves original SVG transparency and background by default.
await exportPNGThumbnail("icons/logo.svg", "output/logo.png", {
  width: 1024,
  height: 1024,
  density: 150,
  quality: 95,
});
```

### Parallel batch optimization (worker pool)

For large batches, `optimizeSVGBatch` spins up a short-lived `worker_threads`
pool and returns all optimized SVGs in order.

```js
import fs from "fs/promises";
import { optimizeSVGBatch } from "svg-power-opt";

const files = ["a.svg", "b.svg", "c.svg", /* ...hundreds more */];
const contents = await Promise.all(files.map((f) => fs.readFile(f, "utf-8")));

const optimized = await optimizeSVGBatch(contents, {
  concurrency: 4, // defaults to os.cpus().length
  defaults: { aggressive: true },
});

await Promise.all(
  files.map((f, i) => fs.writeFile(`optimized/${f}`, optimized[i]))
);
```

For long-lived processes (dev servers, file watchers) keep the pool around
and reuse it:

```js
import { WorkerPool } from "svg-power-opt";
import os from "os";

const pool = new WorkerPool(Math.max(2, Math.floor(os.cpus().length / 2)), {
  aggressive: false,
});

// ...whenever an SVG arrives:
const optimized = await pool.run(svgString, { aggressive: true });

// on shutdown:
await pool.terminate();
```

### Getting original/optimized sizes in one read

Pass `withSizes: true` to skip the extra file read you'd otherwise need for
reporting compression ratios:

```js
import { optimizeSVGFromFile } from "svg-power-opt";

const { data, originalSize, optimizedSize } = await optimizeSVGFromFile(
  "icons/logo.svg",
  { aggressive: true, withSizes: true }
);
console.log(`${originalSize} → ${optimizedSize} bytes`);
```

---

## ⚙️ Optimization Strategy

- **Safe Mode**: Removes metadata, comments, hidden elements, etc.
- **Aggressive Mode**: Also removes attributes, sorts keys, strips non-inheritable styles.

---

## 🚀 Performance Tips

- Use **`--workers`** for large batches — on an 8-core Windows machine and a
  245-file / ~5 MB corpus, the CLI went from ~16 s (`--concurrency 8`) to
  ~5.2 s (`--workers 4`), a ~3x speedup. Output is byte-identical.
- `--concurrency` only overlaps I/O and async work on the main thread; it
  cannot parallelize SVGO itself. Prefer `--workers` whenever the batch has
  more than a handful of files.
- Keep the default fast `validateSVG`. Use `--strict-validate` (or
  `validateSVG(svg, { strict: true })`) only when you specifically need a
  full SVGO re-parse.
- Use `withSizes: true` on `optimizeSVGFromFile` if you need original/
  optimized byte counts — it avoids a second disk read.

Reproduce the numbers locally:

```bash
node bench/make-corpus.js          # generate ~5 MB of synthetic SVGs
node bench/bench.js                # compare async vs --workers
node bench/bench-workers-sweep.js  # sweep pool size on your machine
```

---

## 🔧 Requirements

- **Node.js Version**: Node.js v18.17.0 or higher

---

## 📄 License

MIT © 2025

---
