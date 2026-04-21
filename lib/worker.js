// Worker thread: optimizes SVG content posted from the main thread and returns
// the result. One worker per thread runs in parallel so we actually use the
// host's cores instead of being bottlenecked by SVGO blocking the event loop.
import { parentPort, workerData } from "worker_threads";
import { optimize } from "svgo";

// Rebuild the exact same plugin table as the main library. We intentionally
// do not import from lib/index.js to avoid pulling sharp/fs-extra into every
// worker thread (they're heavy to initialize and we don't need them here).
const safePlugins = [
  "cleanupAttrs","removeDoctype","removeXMLProcInst","removeComments",
  "removeMetadata","removeTitle","removeDesc","removeUselessDefs",
  "removeEditorsNSData","removeEmptyAttrs","removeHiddenElems","removeEmptyText",
  "removeEmptyContainers","cleanupEnableBackground","convertStyleToAttrs",
  "convertColors","convertPathData","convertTransform",
  "removeUnknownsAndDefaults","removeNonInheritableGroupAttrs",
  "removeUselessStrokeAndFill","mergePaths","removeDimensions",
];
const aggressivePlugins = [
  "sortAttrs",
  { name: "removeAttrs", params: { attrs: "(class|data-name)" } },
];

function buildConfig(aggressive) {
  const all = aggressive ? [...safePlugins, ...aggressivePlugins] : safePlugins;
  return all.map((p) => (typeof p === "string" ? { name: p } : p));
}

const configSafe = buildConfig(false);
const configAggressive = buildConfig(true);

// workerData may include default options; per-task options override them.
const defaults = workerData?.defaults || {};

parentPort.on("message", (task) => {
  const { id, content, options = {} } = task;
  try {
    const merged = { ...defaults, ...options };
    const { aggressive = false, multipass = true } = merged;
    const plugins = aggressive ? configAggressive : configSafe;
    const result = optimize(content, { multipass, plugins });
    parentPort.postMessage({ id, ok: true, data: result.data });
  } catch (e) {
    parentPort.postMessage({ id, ok: false, error: e.message });
  }
});
