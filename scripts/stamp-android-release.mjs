import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const buildGradlePath = path.join(rootDir, "app", "android", "app", "build.gradle");
const releaseDir = path.join(rootDir, "app", "android", "app", "build", "outputs", "bundle", "release");
const sourceBundlePath = path.join(releaseDir, "app-release.aab");

if (!fs.existsSync(sourceBundlePath)) {
  throw new Error(`Release bundle not found at ${sourceBundlePath}`);
}

const buildGradle = fs.readFileSync(buildGradlePath, "utf8");
const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
const versionNameMatch = buildGradle.match(/versionName\s+"([^"]+)"/);

if (!versionCodeMatch || !versionNameMatch) {
  throw new Error("Android versionCode/versionName could not be found in build.gradle.");
}

const versionCode = versionCodeMatch[1];
const versionName = versionNameMatch[1];
const stampedBundleName = `Vector-Companion-${versionName}-${versionCode}.aab`;
const stampedBundlePath = path.join(releaseDir, stampedBundleName);

fs.copyFileSync(sourceBundlePath, stampedBundlePath);

console.log(`Stamped Android release bundle: ${stampedBundlePath}`);
