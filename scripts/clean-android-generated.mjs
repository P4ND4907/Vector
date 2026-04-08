import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidRoot = path.join(repoRoot, "app", "android");

const targets = [
  path.join(androidRoot, "capacitor-cordova-android-plugins"),
  path.join(androidRoot, "app", "src", "main", "assets", "public")
];

for (const target of targets) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`Removed stale Android generated path: ${target}`);
  } else {
    console.log(`Android generated path already clean: ${target}`);
  }
}
