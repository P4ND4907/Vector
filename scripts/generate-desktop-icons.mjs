import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceSvgPath = path.join(rootDir, "app", "public", "icon.svg");
const outputDir = path.join(rootDir, "build-resources", "icons");

const ensureDir = async (targetDir) => {
  await fs.mkdir(targetDir, { recursive: true });
};

const createIcoFromPngs = (pngBuffers) => {
  const headerSize = 6;
  const directorySize = 16 * pngBuffers.length;
  const header = Buffer.alloc(headerSize + directorySize);
  let imageOffset = header.length;

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngBuffers.length, 4);

  pngBuffers.forEach(({ buffer, size }, index) => {
    const entryOffset = headerSize + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(buffer.length, entryOffset + 8);
    header.writeUInt32LE(imageOffset, entryOffset + 12);
    imageOffset += buffer.length;
  });

  return Buffer.concat([header, ...pngBuffers.map(({ buffer }) => buffer)]);
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
        value: size,
      },
    })
      .render()
      .asPng();

    const fileName = `vector-control-hub-${size}.png`;
    await fs.writeFile(path.join(outputDir, fileName), png);
    if (size <= 256) {
      pngBuffers.push({ buffer: png, size });
    }
  }

  await fs.writeFile(
    path.join(outputDir, "vector-control-hub.png"),
    await fs.readFile(path.join(outputDir, "vector-control-hub-512.png")),
  );
  await fs.writeFile(
    path.join(outputDir, "vector-control-hub.ico"),
    createIcoFromPngs(pngBuffers),
  );
  console.log(`Desktop icons generated in ${outputDir}`);
};

await main();
