import fs from "fs-extra";
import { optimize } from "svgo";

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
  "removeHiddenElems", // Remove hidden elements
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
  "sortAttrs", // Sort attributes for better compression
  "removeAttrs", // This helps in removing unnecessary attributes
  "removeUselessStrokeAndFill", // Remove unnecessary stroke and fill
];

function getPluginConfig(aggressive = false) {
  return aggressive
    ? safePlugins.concat(aggressivePlugins).map((name) => ({ name }))
    : safePlugins.map((name) => ({ name }));
}

export async function optimizeSVGFromFile(filePath, options = {}) {
  const content = await fs.readFile(filePath, "utf-8");
  return optimizeSVG(content, options).data;
}

export function optimizeSVG(svgContent, options = {}) {
  const { aggressive = false } = options;
  const result = optimize(svgContent, {
    multipass: true, // Ensure multiple optimization passes
    plugins: getPluginConfig(aggressive), // Add aggressive plugins
  });
  return result;
}
