import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "dist-electron");

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  console.log(`Removed previous Electron output: ${outputDir}`);
} else {
  console.log(`Electron output directory is already clean: ${outputDir}`);
}
