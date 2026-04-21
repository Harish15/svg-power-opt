// Generates a synthetic corpus of SVG files for benchmarking.
// Produces a mix of small icons, medium icons, and copies of the large
// Illustration.svg so that results reflect real-world workloads.
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(__dirname, "corpus");
const LARGE_SRC = path.join(__dirname, "..", "icons", "Illustration.svg");

await fs.emptyDir(CORPUS);

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

// Build a bloated but valid SVG icon. Emulates files exported by design tools:
// editor namespaces, metadata, comments, long number precision, redundant attrs.
function makeIcon(seed, complexity = 20) {
  const paths = [];
  for (let i = 0; i < complexity; i++) {
    const cmds = [];
    cmds.push(`M${rand(0, 100).toFixed(6)} ${rand(0, 100).toFixed(6)}`);
    for (let j = 0; j < 6; j++) {
      cmds.push(
        `C${rand(0, 100).toFixed(6)} ${rand(0, 100).toFixed(6)}, ${rand(
          0,
          100
        ).toFixed(6)} ${rand(0, 100).toFixed(6)}, ${rand(0, 100).toFixed(
          6
        )} ${rand(0, 100).toFixed(6)}`
      );
    }
    cmds.push("Z");
    const fill = `rgb(${(seed * (i + 1)) % 255}, ${(seed * 3) % 255}, ${
      (seed * 7) % 255
    })`;
    paths.push(
      `  <path class="icon-part part-${i}" data-name="shape-${i}" fill="${fill}" stroke="#000000" stroke-width="1.000000" d="${cmds.join(
        " "
      )}" />`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Adobe Illustrator 27.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0) -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:sketch="http://www.bohemiancoding.com/sketch/ns"
  version="1.1"
  id="icon-${seed}"
  x="0px"
  y="0px"
  width="100px"
  height="100px"
  viewBox="0 0 100 100"
  enable-background="new 0 0 100 100"
  xml:space="preserve">
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description rdf:about=""><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">icon ${seed}</dc:title></rdf:Description>
    </rdf:RDF>
  </metadata>
  <title>Icon ${seed}</title>
  <desc>Generated bloated icon for benchmarking</desc>
  <defs>
    <linearGradient id="g${seed}" x1="0" y1="0" x2="100" y2="100">
      <stop offset="0" style="stop-color:#ff0000;stop-opacity:1" />
      <stop offset="1" style="stop-color:#0000ff;stop-opacity:1" />
    </linearGradient>
  </defs>
  <g id="layer_${seed}" sketch:type="MSLayerGroup">
${paths.join("\n")}
  </g>
</svg>
`;
}

const counts = {
  small: 200,  // small icons, ~1-3KB each
  medium: 40,  // medium icons, ~15KB each
  large: 5,    // large illustrations (copies of the 420KB file)
};

let totalBytes = 0;

for (let i = 0; i < counts.small; i++) {
  const svg = makeIcon(i + 1, 10);
  const p = path.join(CORPUS, `small-${String(i).padStart(3, "0")}.svg`);
  await fs.writeFile(p, svg);
  totalBytes += Buffer.byteLength(svg);
}

for (let i = 0; i < counts.medium; i++) {
  const svg = makeIcon(i + 1000, 80);
  const p = path.join(CORPUS, `medium-${String(i).padStart(3, "0")}.svg`);
  await fs.writeFile(p, svg);
  totalBytes += Buffer.byteLength(svg);
}

if (await fs.pathExists(LARGE_SRC)) {
  const data = await fs.readFile(LARGE_SRC);
  for (let i = 0; i < counts.large; i++) {
    const p = path.join(CORPUS, `large-${String(i).padStart(2, "0")}.svg`);
    await fs.writeFile(p, data);
    totalBytes += data.byteLength;
  }
}

const files = await fs.readdir(CORPUS);
console.log(
  `Generated ${files.length} SVG files, total ${(totalBytes / 1024).toFixed(
    1
  )} KB in ${CORPUS}`
);
