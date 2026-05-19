import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const serverUrl = process.env.VECTOR_RELEASE_SERVER_URL ?? "http://127.0.0.1:8787";

const checks = [];
const warnings = [];

const record = (ok, label, details = "") => {
  checks.push({ ok, label, details });
  const prefix = ok ? "[pass]" : "[fail]";
  console.log(`${prefix} ${label}${details ? ` - ${details}` : ""}`);
};

const warn = (label, details = "") => {
  warnings.push({ label, details });
  console.log(`[warn] ${label}${details ? ` - ${details}` : ""}`);
};

const quoteWindowsShellToken = (token) =>
  /[\s&()^|<>"]/u.test(token) ? `"${token.replaceAll('"', '\\"')}"` : token;

const run = (label, command, args) => {
  const useWindowsShell = process.platform === "win32";
  const shellCommand = [command, ...args].map(quoteWindowsShellToken).join(" ");
  const result = useWindowsShell
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", shellCommand], {
        cwd: repoRoot,
        encoding: "utf8"
      })
    : spawnSync(command, args, {
    cwd: repoRoot,
        encoding: "utf8"
      });

  record(result.status === 0, label, result.status === 0 ? "ok" : "command failed");
  if (result.status !== 0) {
    console.log(result.stdout ?? "");
    console.error(result.stderr ?? "");
  }
  return result.status === 0;
};

const readGradleVersion = () => {
  const buildGradlePath = path.join(repoRoot, "app", "android", "app", "build.gradle");
  const buildGradle = readFileSync(buildGradlePath, "utf8");
  const applicationId = buildGradle.match(/applicationId\s+"([^"]+)"/)?.[1];
  const versionCode = Number(buildGradle.match(/versionCode\s+(\d+)/)?.[1]);
  const versionName = buildGradle.match(/versionName\s+"([^"]+)"/)?.[1];
  return { applicationId, versionCode, versionName };
};

const requestJson = async (url, init) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
};

const checkLiveServer = async () => {
  try {
    const health = await requestJson(`${serverUrl}/health`);
    record(Boolean(health.ok), "Local backend health", serverUrl);
  } catch (error) {
    warn("Local backend is not running", "Skipping live robot auto-repair checks.");
    return;
  }

  let engine = await requestJson(`${serverUrl}/api/engine/health`);
  if (!engine.integration?.robotReachable && engine.integration?.bridgeReachable) {
    warn("Robot route not reachable", "Trying automatic reconnect once.");
    await requestJson(`${serverUrl}/api/engine/repair/reconnect`, { method: "POST", body: "{}" });
    engine = await requestJson(`${serverUrl}/api/engine/health`);
  }

  record(engine.provider === "embedded", "Embedded engine selected", `provider=${engine.provider}`);
  record(Boolean(engine.integration?.bridgeReachable), "Local bridge reachable", engine.integration?.note ?? "");
  record(Boolean(engine.integration?.robotReachable), "Robot route reachable", engine.integration?.note ?? "");
};

console.log("Vector release health check");
console.log("--------------------------------------------------");

const gradle = readGradleVersion();
record(gradle.applicationId === "com.vectorcontrolhub.app", "Play package name", gradle.applicationId ?? "missing");
record(Number.isFinite(gradle.versionCode) && gradle.versionCode > 0, "Android versionCode", String(gradle.versionCode));
record(Boolean(gradle.versionName), "Android versionName", gradle.versionName ?? "missing");

const envSource = readFileSync(path.join(repoRoot, "server", "src", "utils", "env.ts"), "utf8");
record(
  envSource.includes('photoEmailEnabled: process.env.PHOTO_EMAIL_ENABLED === "true"'),
  "Photo email privacy default",
  "disabled unless local user opts in"
);

const appPackage = JSON.parse(readFileSync(path.join(repoRoot, "app", "package.json"), "utf8"));
const bluetoothVersion = appPackage.dependencies?.["@capacitor-community/bluetooth-le"];
if (bluetoothVersion === "^7.3.2") {
  warn(
    "Bluetooth plugin deprecation warnings are allowed",
    "7.3.2 is the newest Capacitor 7-compatible line; 8.x requires Capacitor 8."
  );
} else {
  warn("Bluetooth plugin version changed", `current=${bluetoothVersion ?? "missing"}; run a real-device pairing test.`);
}

if (!existsSync(path.join(repoRoot, "app", "android", "keystore.properties"))) {
  warn("Android release keystore file missing", "Bundle builds may be unsigned unless your local Play signing setup supplies it.");
}

run("Typecheck", npmCommand, ["run", "typecheck"]);
run("Server tests", npmCommand, ["run", "test", "--workspace", "server"]);
await checkLiveServer();

console.log("--------------------------------------------------");
if (checks.some((check) => !check.ok)) {
  console.error("Release health check failed. Fix failed checks before uploading.");
  process.exit(1);
}

console.log(`Release health check passed with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`);
