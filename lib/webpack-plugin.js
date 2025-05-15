import { optimizeSVGFromBuffer } from "./index.js";

export class SvgPowerOptWebpackPlugin {
  constructor(options = {}) {
    this.options = options;
  }

  apply(compiler) {
    compiler.hooks.emit.tapPromise("SvgPowerOptWebpackPlugin", async (compilation) => {
      const assets = compilation.assets;
      const svgFiles = Object.keys(assets).filter((name) => /\.svg$/i.test(name));

      await Promise.all(svgFiles.map(async (name) => {
        const asset = assets[name];
        const source = asset.source();
        const optimized = optimizeSVGFromBuffer(Buffer.from(source), this.options);
        compilation.assets[name] = {
          source: () => optimized,
          size: () => Buffer.byteLength(optimized, "utf-8"),
        };
      }));
    });
  }
}
