# svg-power-opt

**svg-power-opt** is a powerful SVG optimizer that ensures minimal file size without compromising visual quality. It wraps [SVGO](https://github.com/svg/svgo) with a carefully curated set of plugins and provides both a CLI and programmatic API.

---

## ✨ Features

- 🔧 Safe default optimization (no visual loss)
- ⚡ Optional aggressive mode for maximum reduction
- 📁 Supports single files, folders, or glob patterns
- 🧰 Easy to use via CLI or Node.js API

---

## 📦 Installation

```bash
npm install -g svg-power-opt
```

Or clone locally:

```bash
git clone https://github.com/yourname/svg-power-opt.git
cd svg-power-opt
npm install
```

---

## 🚀 CLI Usage

```bash
svg-power-opt <input> [options]
```

### Arguments:
- `<input>`: File path or glob pattern (`icons/*.svg`)

### Options:
- `-o, --out <dir>`: Output directory (default: `optimized`)
- `--aggressive`: Enable aggressive optimization (default: `false`)

### Example:

```bash
svg-power-opt icons/**/*.svg --out optimized/
svg-power-opt logo.svg --out optimized/ --aggressive
```

---

## 🧑‍💻 Programmatic Usage

```js
const { optimizeSVG, optimizeSVGFromFile } = require('svg-power-opt');

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

- **Safe Mode**: Only essential cleanup and compression plugins.
- **Aggressive Mode**: Adds more drastic optimization plugins like `sortAttrs`, `removeAttrs` (can remove unused data).

---

## 📄 License

MIT © 2025 Your Name
