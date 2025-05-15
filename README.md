
# svg-power-opt

**svg-power-opt** is a powerful and extensible SVG optimizer that reduces file size while preserving visual quality. It wraps [SVGO](https://github.com/svg/svgo) with a curated plugin set, adds CLI reporting, and programmatic support.

---

## ✨ Features

- 🔧 **Safe default optimizations** (zero visual loss)
- ⚡ **Aggressive mode** for maximum compression
- 📁 Supports **recursive folders** and glob patterns
- 📊 **Before/after size reporting** per file
- 🔍 Warns on excessive reductions (>10%)
- ✅ Usable from **CLI or Node.js API**
- 📦 Supports **buffers, strings, and file input**

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
### Example:

```bash
svg-power-opt icons/**/*.svg --out optimized/
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
} from 'svg-power-opt';

// From file
const optimized = await optimizeSVGFromFile('logo.svg', { aggressive: true });
console.log(optimized);

// From string
const rawSVG = '<svg>...</svg>';
const result = optimizeSVG(rawSVG, { aggressive: false });
console.log(result.data);

// From buffer (e.g., file upload, S3, etc.)
const buffer = fs.readFileSync('logo.svg');
const resultFromBuffer = optimizeSVGFromBuffer(buffer, { aggressive: true });
console.log(resultFromBuffer.data);
```

---

## ⚙️ Optimization Strategy

- **Safe Mode**: Removes metadata, comments, hidden elements, etc.
- **Aggressive Mode**: Also removes attributes, sorts keys, strips non-inheritable styles.

---

## 📄 License

MIT © 2025

---
