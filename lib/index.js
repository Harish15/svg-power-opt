import fs from "fs-extra";
import { optimize } from "svgo";
import zlib from "zlib";
import { promisify } from "util";
import sharp from "sharp";

export { optimizeSVGBatch, WorkerPool } from "./pool.js";

const gunzipAsync = promisify(zlib.gunzip);

// Safe, default SVGO plugins that optimize SVGs without removing critical info.
const safePlugins = [
  "cleanupAttrs",
  "removeDoctype",
  "removeXMLProcInst",
  "removeComments",
  "removeMetadata",
  "removeTitle",
  "removeDesc",
  "removeUselessDefs",
  "removeEditorsNSData",
  "removeEmptyAttrs",
  "removeHiddenElems",
  "removeEmptyText",
  "removeEmptyContainers",
  "cleanupEnableBackground",
  "convertStyleToAttrs",
  "convertColors",
  "convertPathData",
  "convertTransform",
  "removeUnknownsAndDefaults",
  "removeNonInheritableGroupAttrs",
  "removeUselessStrokeAndFill",
  "mergePaths",
  "removeDimensions",
];

// Additional plugins for aggressive optimization (may remove attributes like class or data-name).
const aggressivePlugins = [
  "sortAttrs",
  {
    name: "removeAttrs",
    params: { attrs: "(class|data-name)" },
  },
];

// Pre-built, frozen plugin configs for the common cases. The same object is
// re-used across every optimize() call, avoiding per-file allocation of
// identical plugin structures.
function buildBase(aggressive) {
  const all = aggressive ? [...safePlugins, ...aggressivePlugins] : safePlugins;
  return Object.freeze(
    all.map((p) => (typeof p === "string" ? Object.freeze({ name: p }) : p))
  );
}

const BASE_SAFE = buildBase(false);
const BASE_AGGRESSIVE = buildBase(true);

// Cache final plugin configs keyed on the combination of toggles. Custom
// plugins bypass the cache (they're reference-identity sensitive) but still
// reuse the frozen base array.
const configCache = new Map();

/**
 * Compose the SVGO plugin config. Returns a cached array when no custom
 * plugins are supplied so repeated calls don't re-allocate.
 */
function getPluginConfig(aggressive, customPlugins, preserveViewBox, removeDimensions) {
  if (customPlugins && customPlugins.length > 0) {
    return composePluginConfig(aggressive, customPlugins, preserveViewBox, removeDimensions);
  }
  const key = (aggressive ? 1 : 0) | (preserveViewBox ? 2 : 0) | (removeDimensions ? 4 : 0);
  let cfg = configCache.get(key);
  if (!cfg) {
    cfg = composePluginConfig(aggressive, [], preserveViewBox, removeDimensions);
    configCache.set(key, cfg);
  }
  return cfg;
}

function composePluginConfig(aggressive, customPlugins, preserveViewBox, removeDimensions) {
  const base = aggressive ? BASE_AGGRESSIVE : BASE_SAFE;
  let plugins;
  if (removeDimensions) {
    plugins = base.slice();
  } else {
    // Drop the removeDimensions entry; this is a one-time linear pass cached per key.
    plugins = base.filter((p) => p.name !== "removeDimensions");
  }
  if (preserveViewBox) {
    // Note: removeViewBox isn't in our enabled plugin list, so this is only
    // defensive in case a caller adds presetDefault via custom plugins.
    plugins.push({ name: "removeViewBox", active: false });
  }
  if (customPlugins && customPlugins.length > 0) {
    plugins.push(...customPlugins);
  }
  return plugins;
}

/**
 * Optimize SVG content string with SVGO.
 */
export function optimizeSVG(svgContent, options = {}) {
  const {
    aggressive = false,
    multipass = true,
    plugins = [],
    preserveViewBox = true,
    removeDimensions = true,
  } = options;

  const pluginConfig = getPluginConfig(aggressive, plugins, preserveViewBox, removeDimensions);

  try {
    return optimize(svgContent, { multipass, plugins: pluginConfig });
  } catch (e) {
    throw new Error(`SVGO optimization failed: ${e.message}`);
  }
}

async function readSvgFile(filePath) {
  if (filePath.endsWith(".svgz")) {
    const gzipped = await fs.readFile(filePath);
    const buf = await gunzipAsync(gzipped);
    return buf.toString("utf-8");
  }
  return fs.readFile(filePath, "utf-8");
}

/**
 * Optimize SVG from a file path. Handles both .svg and compressed .svgz files.
 * When `options.withSizes` is true, returns `{ data, originalSize, optimizedSize }`
 * so callers (like the CLI) can avoid a second read of the input file.
 */
export async function optimizeSVGFromFile(filePath, options = {}) {
  const content = await readSvgFile(filePath);
  const result = optimizeSVG(content, options);
  if (options.withSizes) {
    return {
      data: result.data,
      originalSize: Buffer.byteLength(content, "utf-8"),
      optimizedSize: Buffer.byteLength(result.data, "utf-8"),
    };
  }
  return result.data;
}

/**
 * Optimize SVG content from a Buffer.
 */
export function optimizeSVGFromBuffer(buffer, options = {}) {
  const content = buffer.toString("utf-8");
  const result = optimizeSVG(content, options);
  return result.data;
}

/**
 * Fetch SVG from a URL and optimize it.
 */
export async function optimizeSVGFromURL(url, options = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch SVG from URL: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return optimizeSVGFromBuffer(buffer, options);
}

/**
 * Optimize SVG content from a readable stream.
 */
export async function optimizeSVGStream(readableStream, options = {}) {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  return optimizeSVGFromBuffer(buffer, options);
}

/**
 * Export a PNG thumbnail image from SVG content or file.
 */
export async function exportPNGThumbnail(input, outputPath, options = {}) {
  let svgString;

  if (typeof input === "string" && input.trim().startsWith("<svg")) {
    svgString = input;
  } else if (typeof input === "string") {
    svgString = input.endsWith(".svgz")
      ? (await gunzipAsync(await fs.readFile(input))).toString("utf-8")
      : await fs.readFile(input, "utf-8");
  } else {
    throw new Error("Invalid input for PNG thumbnail");
  }

  const { width = 512, height = 512, density = 120, quality = 90 } = options;

  await sharp(Buffer.from(svgString), { density })
    .resize(width, height)
    .png({ quality })
    .toFile(outputPath);
}

// Cheap well-formedness check: looks for an <svg ...> open tag and matching </svg>
// close tag. Avoids running the full SVGO parser on already-optimized output,
// which was the single biggest per-file overhead in the hot CLI path.
const SVG_OPEN = /<svg[\s>]/i;
const SVG_CLOSE = /<\/svg\s*>\s*$/i;

/**
 * Validate SVG content. Returns true for well-formed SVG markup.
 *
 * Fast path: a structural regex check. Pass `{ strict: true }` to run the full
 * SVGO parser (same behavior as before).
 */
export function validateSVG(svgContent, options = {}) {
  if (typeof svgContent !== "string" || svgContent.length === 0) return false;
  if (options.strict) {
    try {
      optimize(svgContent, { multipass: false, plugins: [] });
      return true;
    } catch {
      return false;
    }
  }
  return SVG_OPEN.test(svgContent) && SVG_CLOSE.test(svgContent);
}
