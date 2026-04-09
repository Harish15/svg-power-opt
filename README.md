# svg-power-opt

**svg-power-opt** is a powerful and extensible SVG optimizer that compresses SVG files without sacrificing visual quality. It wraps [SVGO](https://github.com/svg/svgo) with a curated set of safe plugins, provides advanced CLI reporting, supports aggressive optimization modes, allows custom plugin configuration, and can export high-quality PNG thumbnails using [sharp](https://www.npmjs.com/package/sharp).
The tool supports both programmatic usage and Webpack integration — making it suitable for build pipelines, design systems, and automation tasks.

---

## ✨ Features

- 🔧 **Safe default optimizations** (zero visual loss)
- ⚡ **Aggressive mode** for maximum compression
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
- `--concurrency <number>`: Number of files to process in parallel (default: CPU count)
- `--plugin <plugin>`: Add a custom SVGO plugin (JSON string)

### Example:

```bash
npx svg-power-opt icons/**/*.svg --out optimized/
npx svg-power-opt icons/**/*.svg --aggressive --export-png --out dist/icons
```

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
| `optimizeSVGFromFile(filePath, options)`         | Reads an SVG file, optimizes it, returns result        | `filePath` (string): path to SVG file<br>`options` (object): optimization settings                                                                                              | Promise resolving to optimized SVG **string** (`result.data`) |
| `optimizeSVGFromBuffer(buffer, options)`         | Optimizes SVG from a Buffer                            | `buffer` (Buffer): SVG data buffer<br>`options` (object): optimization settings                                                                                                 | Optimized SVG **string** (`result.data`)                     |
| `optimizeSVGFromURL(url, options)`               | Downloads an SVG from a URL and optimizes it           | `url` (string): remote SVG URL<br>`options` (object): optimization settings                                                                                                     | Promise resolving to optimized SVG **string** (uses global `fetch`, Node 18+) |
| `optimizeSVGStream(readableStream, options)`     | Optimizes SVG data from a readable stream              | `readableStream` (Readable): input stream<br>`options` (object): optimization settings                                                                                          | Promise resolving to optimized SVG **string**              |
| `exportPNGThumbnail(input, outputPath, options)` | Converts an SVG file or inline SVG markup to PNG       | `input` (string): SVG **file path** or raw markup string starting with `<svg`<br>`outputPath` (string): PNG output path<br>`options` (object): PNG export settings (width, height, density, quality) | Promise resolving when PNG file is saved                   |
| `validateSVG(svgString)`                         | Validates if the string is a well-formed SVG           | `svgString` (string): raw SVG content                                                                                                                                           | Boolean `true` if valid, `false` if invalid                |

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

---

## ⚙️ Optimization Strategy

- **Safe Mode**: Removes metadata, comments, hidden elements, etc.
- **Aggressive Mode**: Also removes attributes, sorts keys, strips non-inheritable styles.

---

## 🔧 Requirements

- **Node.js Version**: Node.js v18.17.0 or higher

---

## 📄 License

MIT © 2025

---
