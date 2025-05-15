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

function getPluginConfig(aggressive = false) {
  const all = [...safePlugins];
  if (aggressive) all.push(...aggressivePlugins);
  return all.map((plugin) =>
    typeof plugin === "string" ? { name: plugin } : plugin
  );
}

export async function optimizeSVGFromFile(filePath, options = {}) {
  const content = await fs.readFile(filePath, "utf-8");
  const result = optimizeSVG(content, options);
  return result.data;
}

export function optimizeSVG(svgContent, options = {}) {
  const { aggressive = false } = options;
  const result = optimize(svgContent, {
    multipass: true,
    plugins: getPluginConfig(aggressive),
  });
  return result;
}
