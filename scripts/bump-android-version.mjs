import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const buildGradlePath = path.join(rootDir, "app", "android", "app", "build.gradle");
const playNotesPath = path.join(rootDir, "docs", "PLAY_CONSOLE_NOTES.md");
const mobileAndroidPath = path.join(rootDir, "docs", "MOBILE_ANDROID.md");

const updateFile = (filePath, transform) => {
  const previous = fs.readFileSync(filePath, "utf8");
  const next = transform(previous);

  if (next === previous) {
    return false;
  }

  fs.writeFileSync(filePath, next, "utf8");
  return true;
};

const buildGradle = fs.readFileSync(buildGradlePath, "utf8");
const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
const versionNameMatch = buildGradle.match(/versionName\s+"([^"]+)"/);

if (!versionCodeMatch || !versionNameMatch) {
  throw new Error("Android versionCode/versionName could not be found in build.gradle.");
}

const currentVersionCode = Number(versionCodeMatch[1]);
const currentVersionName = versionNameMatch[1];
const versionParts = currentVersionName.split(".").map((part) => Number(part));

if (versionParts.length !== 3 || versionParts.some((part) => Number.isNaN(part))) {
  throw new Error(`Current versionName "${currentVersionName}" is not in x.y.z format.`);
}

const now = new Date();
const startOfYear = new Date(now.getFullYear(), 0, 1);
const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
const pad = (value, length = 2) => String(value).padStart(length, "0");
const timeBasedVersionCode = Number(
  `${String(now.getFullYear()).slice(-2)}${pad(dayOfYear, 3)}${pad(now.getHours())}${pad(now.getMinutes())}`
);
const nextVersionCode = Math.max(currentVersionCode + 1, timeBasedVersionCode);
const nextVersionName = `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`;

updateFile(buildGradlePath, (content) =>
  content
    .replace(/versionCode\s+\d+/, `versionCode ${nextVersionCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${nextVersionName}"`)
);

updateFile(playNotesPath, (content) =>
  content
    .replace(/- current `versionCode`: `\d+`/, `- current \`versionCode\`: \`${nextVersionCode}\``)
    .replace(/- current `versionName`: `[^`]+`/, `- current \`versionName\`: \`${nextVersionName}\``)
);

updateFile(mobileAndroidPath, (content) =>
  content.replace(
    /For example:\r?\n\r?\n- `versionCode \d+`\r?\n- `versionName "[^"]+"`/,
    `For example:\n\n- \`versionCode ${nextVersionCode}\`\n- \`versionName "${nextVersionName}"\``
  )
);

console.log(`Android version bumped: versionCode ${currentVersionCode} -> ${nextVersionCode}`);
console.log(`Android version code strategy: max(current + 1, YYDDDHHMM time-based floor)`);
console.log(`Android version bumped: versionName ${currentVersionName} -> ${nextVersionName}`);
