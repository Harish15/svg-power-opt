
# svg-power-opt

**svg-power-opt** is a powerful and extensible SVG optimizer that reduces file size while preserving visual quality. It wraps [SVGO](https://github.com/svg/svgo) with a curated plugin set, adds CLI previews, reporting, config support, and more.

---

## ✨ Features

- 🔧 **Safe default optimizations** (zero visual loss)
- ⚡ **Aggressive mode** for maximum compression
- 📁 Supports **recursive folders**, glob patterns
- 🖼️ Generates **HTML preview reports**
- 📊 **Before/after size reporting** per file
- 🔍 Warns on excessive reductions (>10%)
- 🧾 Configurable via `svg-power-opt.config.js`
- ✅ Usable from **CLI or Node.js API**

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
- `--preview`: Generate HTML preview report
- `--config <file>`: Use a custom config file

### Example:

```bash
svg-power-opt icons/**/*.svg --out optimized/
svg-power-opt logo.svg --aggressive --preview
```

---

## 🧾 Config File Support

You can create a `svg-power-opt.config.js` file in your project:

```js
export default {
  aggressive: true,
  outputDir: 'dist/icons',
  plugins: [
    'cleanupAttrs',
    'removeComments',
    'removeUselessDefs',
  ],
};
```

Then run without passing options explicitly:

```bash
svg-power-opt icons/**/*.svg
```

---

## 🖼️ Preview Report

If you enable `--preview`, it will generate a `preview.html` in your output folder with before/after comparisons:

```
📁 optimized/preview.html

[ Original SVG ]      →      [ Optimized SVG ]
```

Use it to validate visual quality quickly.

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
import { optimizeSVG, optimizeSVGFromFile } from 'svg-power-opt';

// From file
const optimized = await optimizeSVGFromFile('logo.svg', { aggressive: true });
console.log(optimized);

// From string
const rawSVG = '<svg>...</svg>';
const result = optimizeSVG(rawSVG, { aggressive: false });
console.log(result.data);
```

---

## ⚙️ Optimization Strategy

- **Safe Mode**: Removes metadata, comments, hidden elements, etc.
- **Aggressive Mode**: Also removes attributes, sorts keys, strips non-inheritable styles.

---

## 📄 License

MIT © 2025

---
