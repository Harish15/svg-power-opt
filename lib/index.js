import fs from "fs-extra";
import { optimize } from "svgo";
import zlib from "zlib";
import fetch from "node-fetch"; // npm i node-fetch@2 for CommonJS compatibility
import sharp from "sharp"; // npm i sharp

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

const aggressivePlugins = [
  "sortAttrs",
  {
    name: "removeAttrs",
    params: {
      attrs: "(class|data-name)", // avoid removing fill/stroke
    },
  },
];

function getPluginConfig(aggressive = false, customPlugins = []) {
  const all = [...safePlugins];
  if (aggressive) all.push(...aggressivePlugins);
  // Allow user plugins to override or append
  return [
    ...all.map((p) => (typeof p === "string" ? { name: p } : p)),
    ...customPlugins,
  ];
}

// Optimize SVG content string
export function optimizeSVG(svgContent, options = {}) {
  const {
    aggressive = false,
    multipass = true,
    plugins = [],
    preserveViewBox = true,
    removeDimensions = true,
  } = options;

  const pluginConfig = getPluginConfig(aggressive, plugins);

  if (!removeDimensions) {
    // Filter out removeDimensions plugin
    const idx = pluginConfig.findIndex((p) => p.name === "removeDimensions");
    if (idx !== -1) pluginConfig.splice(idx, 1);
  }

  if (preserveViewBox) {
    pluginConfig.push({
      name: "removeViewBox",
      active: false,
    });
  }

  try {
    const result = optimize(svgContent, {
      multipass,
      plugins: pluginConfig,
    });
    return result;
  } catch (e) {
    throw new Error(`SVGO optimization failed: ${e.message}`);
  }
}

// From file path (auto handles .svgz)
export async function optimizeSVGFromFile(filePath, options = {}) {
  let content;
  if (filePath.endsWith(".svgz")) {
    const gzipped = await fs.readFile(filePath);
    content = zlib.gunzipSync(gzipped).toString("utf-8");
  } else {
    content = await fs.readFile(filePath, "utf-8");
  }
  const result = optimizeSVG(content, options);
  return result.data;
}

// From Buffer
export function optimizeSVGFromBuffer(buffer, options = {}) {
  const content = buffer.toString("utf-8");
  const result = optimizeSVG(content, options);
  return result.data;
}

// From URL
export async function optimizeSVGFromURL(url, options = {}) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch SVG from URL: ${url}`);
  const buffer = await res.buffer();
  return optimizeSVGFromBuffer(buffer, options);
}

// Stream interface (returns a Promise of optimized string)
export async function optimizeSVGStream(readableStream, options = {}) {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  return optimizeSVGFromBuffer(buffer, options);
}

// Export PNG thumbnail from SVG string or file
export async function exportPNGThumbnail(input, outputPath, options = {}) {
  let svgString;

  if (typeof input === "string" && input.trim().startsWith("<svg")) {
    svgString = input;
  } else if (typeof input === "string") {
    // Assume file path
    svgString = input.endsWith(".svgz")
      ? zlib.gunzipSync(await fs.readFile(input)).toString("utf-8")
      : await fs.readFile(input, "utf-8");
  } else {
    throw new Error("Invalid input for PNG thumbnail");
  }

  const {
    width = 512,
    height = 512,
    density = 120,
    quality = 90,
  } = options;

  await sharp(Buffer.from(svgString), { density })
    .resize(width, height)
    .png({ quality })
    .toFile(outputPath);
}

// Validate SVG by trying to parse and optimize safely
export function validateSVG(svgContent) {
  try {
    optimize(svgContent, { multipass: false, plugins: [] });
    return true;
  } catch {
    return false;
  }
}
