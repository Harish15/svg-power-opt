# svg-power-opt

**svg-power-opt** is a powerful and extensible SVG optimizer that reduces file size while preserving visual quality. It wraps [SVGO](https://github.com/svg/svgo) with a curated plugin set, adds CLI reporting, and offers full programmatic and Webpack integration.

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
svg-power-opt icons/**/*.svg --out optimized/
svg-power-opt icons/**/*.svg --aggressive --export-png --out dist/icons
```

---

## 📊 CLI Reporting

For each file, `svg-power-opt` shows:

- Original size
- Optimized size
- Compression %
- Warning if drop >10% in aggressive mode

```
✔ Optimized: icons/logo.svg → optimized/logo.svg (84.1KB → 66.7KB, ↓20.69%) ⚠️
```

---

## 🧑‍💻 Programmatic Usage

```js
import {
  optimizeSVG,
  optimizeSVGFromFile,
  optimizeSVGFromBuffer,
  optimizeSVGFromURL,
  optimizeSVGStream,
  exportPNGThumbnail,
  validateSVG,
} from 'svg-power-opt';

// Optimize from file
const optimized = await optimizeSVGFromFile('logo.svg', { aggressive: true });
console.log(optimized);

// Optimize from string
const rawSVG = '<svg>...</svg>';
const result = optimizeSVG(rawSVG);
console.log(result.data);

// Optimize from buffer
const buffer = fs.readFileSync('logo.svg');
const resultFromBuffer = optimizeSVGFromBuffer(buffer);
console.log(resultFromBuffer);

// Optimize from URL
const optimizedFromURL = await optimizeSVGFromURL('https://example.com/image.svg');

// Optimize from readable stream (e.g., upload)
const optimizedFromStream = await optimizeSVGStream(req);

// Export PNG thumbnail
await exportPNGThumbnail(rawSVG, 'output/preview.png');
```

---

## ⚙️ Optimization Strategy

- **Safe Mode**: Removes metadata, comments, hidden elements, etc.
- **Aggressive Mode**: Also removes attributes, sorts keys, strips non-inheritable styles.

---

## 📄 License

MIT © 2025

---
