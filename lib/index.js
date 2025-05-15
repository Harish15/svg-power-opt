import fs from "fs-extra";           // File system utilities with Promise support and extra features
import { optimize } from "svgo";    // SVGO: SVG optimizer library
import zlib from "zlib";            // Node.js compression utilities for gzip and gunzip
import fetch from "node-fetch";     // Fetch API for Node.js (version 2 for CommonJS compatibility)
import sharp from "sharp";          // Image processing library to convert SVG to PNG thumbnails

// List of safe, default SVGO plugins that optimize SVGs without removing critical info
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

// Additional plugins for more aggressive optimization (may remove attributes like class or data-name)
const aggressivePlugins = [
  "sortAttrs", // Sort attributes alphabetically for better compression
  {
    name: "removeAttrs",
    params: {
      attrs: "(class|data-name)", // Remove class and data-name attributes
    },
  },
];

/**
 * Compose the final SVGO plugin config, merging safe, aggressive, and user custom plugins.
 * @param {boolean} aggressive - Whether to include aggressive plugins.
 * @param {Array} customPlugins - Array of custom plugin config objects.
 * @returns {Array} Array of SVGO plugin config objects.
 */
function getPluginConfig(aggressive = false, customPlugins = []) {
  // Start with safe plugins
  const all = [...safePlugins];
  if (aggressive) all.push(...aggressivePlugins); // Append aggressive plugins if enabled

  // Convert string plugin names to objects with { name } format, then append user plugins
  return [
    ...all.map((p) => (typeof p === "string" ? { name: p } : p)),
    ...customPlugins,
  ];
}

/**
 * Optimize SVG content string with SVGO.
 * @param {string} svgContent - Raw SVG markup as string.
 * @param {object} options - Optimization options.
 * @param {boolean} options.aggressive - Enables aggressive optimization plugins.
 * @param {boolean} options.multipass - Run optimization multiple times for better results.
 * @param {Array} options.plugins - User-provided custom SVGO plugins.
 * @param {boolean} options.preserveViewBox - Whether to preserve the viewBox attribute.
 * @param {boolean} options.removeDimensions - Whether to remove width/height attributes.
 * @returns {object} SVGO optimization result object, including optimized SVG string in `data`.
 */
export function optimizeSVG(svgContent, options = {}) {
  const {
    aggressive = false,
    multipass = true,
    plugins = [],
    preserveViewBox = true,
    removeDimensions = true,
  } = options;

  // Get base plugin config based on aggressive flag and custom plugins
  const pluginConfig = getPluginConfig(aggressive, plugins);

  // Optionally remove the removeDimensions plugin if user wants to keep width/height
  if (!removeDimensions) {
    const idx = pluginConfig.findIndex((p) => p.name === "removeDimensions");
    if (idx !== -1) pluginConfig.splice(idx, 1);
  }

  // Ensure viewBox attribute is preserved by disabling removeViewBox plugin
  if (preserveViewBox) {
    pluginConfig.push({
      name: "removeViewBox",
      active: false,
    });
  }

  try {
    // Run SVGO optimization with multipass and plugin config
    const result = optimize(svgContent, {
      multipass,
      plugins: pluginConfig,
    });
    return result;
  } catch (e) {
    throw new Error(`SVGO optimization failed: ${e.message}`);
  }
}

/**
 * Optimize SVG from a file path (handles both .svg and compressed .svgz files).
 * @param {string} filePath - Path to SVG or SVGZ file.
 * @param {object} options - Optimization options (same as optimizeSVG).
 * @returns {Promise<string>} Optimized SVG string.
 */
export async function optimizeSVGFromFile(filePath, options = {}) {
  let content;
  if (filePath.endsWith(".svgz")) {
    // For compressed SVGZ files, read and decompress with zlib
    const gzipped = await fs.readFile(filePath);
    content = zlib.gunzipSync(gzipped).toString("utf-8");
  } else {
    // For regular SVG files, read as UTF-8 string
    content = await fs.readFile(filePath, "utf-8");
  }
  // Optimize and return the optimized SVG string data
  const result = optimizeSVG(content, options);
  return result.data;
}

/**
 * Optimize SVG content from a Buffer object.
 * @param {Buffer} buffer - Buffer containing SVG content.
 * @param {object} options - Optimization options.
 * @returns {string} Optimized SVG string.
 */
export function optimizeSVGFromBuffer(buffer, options = {}) {
  const content = buffer.toString("utf-8"); // Convert buffer to string
  const result = optimizeSVG(content, options);
  return result.data;
}

/**
 * Fetch SVG from a URL and optimize it.
 * @param {string} url - URL of the SVG resource.
 * @param {object} options - Optimization options.
 * @returns {Promise<string>} Optimized SVG string.
 * @throws Will throw if fetch fails or response is not ok.
 */
export async function optimizeSVGFromURL(url, options = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch SVG from URL: ${url}`);
  const buffer = await res.buffer();
  return optimizeSVGFromBuffer(buffer, options);
}

/**
 * Optimize SVG content from a readable stream.
 * Useful for streaming input sources.
 * @param {ReadableStream} readableStream - Readable stream containing SVG data.
 * @param {object} options - Optimization options.
 * @returns {Promise<string>} Optimized SVG string.
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
 * Uses sharp library to rasterize SVG at specified size and quality.
 * @param {string} input - SVG content string or path to SVG/SVGZ file.
 * @param {string} outputPath - Path where PNG output will be saved.
 * @param {object} options - Thumbnail options.
 * @param {number} options.width - Width of PNG output (default 512).
 * @param {number} options.height - Height of PNG output (default 512).
 * @param {number} options.density - DPI for SVG rasterization (default 120).
 * @param {number} options.quality - PNG compression quality (default 90).
 * @returns {Promise<void>}
 * @throws Throws if input is invalid or sharp processing fails.
 */
export async function exportPNGThumbnail(input, outputPath, options = {}) {
  let svgString;

  if (typeof input === "string" && input.trim().startsWith("<svg")) {
    // Input is raw SVG markup string
    svgString = input;
  } else if (typeof input === "string") {
    // Input is file path - read and decompress if needed
    svgString = input.endsWith(".svgz")
      ? zlib.gunzipSync(await fs.readFile(input)).toString("utf-8")
      : await fs.readFile(input, "utf-8");
  } else {
    throw new Error("Invalid input for PNG thumbnail");
  }

  // Default options for rasterizing SVG to PNG
  const {
    width = 512,
    height = 512,
    density = 120,
    quality = 90,
  } = options;

  // Use sharp to convert SVG string buffer to PNG file
  await sharp(Buffer.from(svgString), { density })
    .resize(width, height)
    .png({ quality })
    .toFile(outputPath);
}

/**
 * Validate SVG content by attempting to parse and optimize it without plugins.
 * @param {string} svgContent - Raw SVG markup string.
 * @returns {boolean} True if SVG is valid, false otherwise.
 */
export function validateSVG(svgContent) {
  try {
    optimize(svgContent, { multipass: false, plugins: [] }); // Try parsing with no changes
    return true;
  } catch {
    return false; // Parsing or optimization failed
  }
}
