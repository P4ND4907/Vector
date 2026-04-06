import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import toIco from "to-ico";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceSvgPath = path.join(rootDir, "app", "public", "icon.svg");
const outputDir = path.join(rootDir, "build-resources", "icons");

const ensureDir = async (targetDir) => {
  await fs.mkdir(targetDir, { recursive: true });
};

const main = async () => {
  await ensureDir(outputDir);

  const svg = await fs.readFile(sourceSvgPath, "utf8");
  const pngBuffers = [];

  // ICO files top out at 256px, so keep larger PNG assets separate from the icon bundle.
  for (const size of [128, 256, 512]) {
    const png = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: size
      }
    }).render().asPng();

    const fileName = `vector-control-hub-${size}.png`;
    await fs.writeFile(path.join(outputDir, fileName), png);
    if (size <= 256) {
      pngBuffers.push(png);
    }
  }

  await fs.writeFile(path.join(outputDir, "vector-control-hub.png"), await fs.readFile(path.join(outputDir, "vector-control-hub-512.png")));
  await fs.writeFile(path.join(outputDir, "vector-control-hub.ico"), await toIco(pngBuffers));
  console.log(`Desktop icons generated in ${outputDir}`);
};

await main();
