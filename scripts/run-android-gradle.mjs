import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const task = process.argv[2];

if (!task) {
  console.error("Missing Gradle task. Example: node scripts/run-android-gradle.mjs assembleDebug");
  process.exit(1);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidRoot = path.join(repoRoot, "app", "android");
const gradleWrapper = path.join(androidRoot, "gradlew.bat");

const readJavaMajorVersion = (javaHome) => {
  const executable = path.join(javaHome, "bin", "java.exe");

  if (!existsSync(executable)) {
    return null;
  }

  const versionCheck = spawn(executable, ["-version"], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });

  return new Promise((resolve) => {
    let output = "";

    versionCheck.stdout?.on("data", (chunk) => {
      output += chunk.toString();
    });

    versionCheck.stderr?.on("data", (chunk) => {
      output += chunk.toString();
    });

    versionCheck.on("exit", () => {
      const match = output.match(/version "(?<major>\d+)(?:\.\d+)?/);
      resolve(match?.groups?.major ? Number(match.groups.major) : null);
    });
  });
};

const resolveJavaHome = async () => {
  const candidates = [
    "C:\\Program Files\\Android\\Android Studio\\jbr",
    process.env.JAVA_HOME,
    "C:\\Program Files\\ojdkbuild\\java-17-openjdk-17.0.3.0.6-1"
  ].filter(Boolean);

  const availableCandidates = [];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const version = await readJavaMajorVersion(candidate);

    if (version) {
      availableCandidates.push({ candidate, version });
    }
  }

  const supportedCandidate = availableCandidates.find(({ version }) => version >= 21);

  if (supportedCandidate) {
    return supportedCandidate.candidate;
  }

  return availableCandidates[0]?.candidate ?? null;
};

const resolveSdkRoot = () => {
  const candidates = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    path.join(os.homedir(), "AppData", "Local", "Android", "Sdk")
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
};

const main = async () => {
  const javaHome = await resolveJavaHome();
  const sdkRoot = resolveSdkRoot();

  if (!javaHome) {
    console.error("Could not find a supported JDK. Install Android Studio or set JAVA_HOME to Java 21+ first.");
    process.exit(1);
  }

  const javaMajorVersion = await readJavaMajorVersion(javaHome);

  if (!javaMajorVersion || javaMajorVersion < 21) {
    console.error(`Found Java ${javaMajorVersion ?? "unknown"}, but this Android shell needs Java 21 or newer.`);
    console.error("Install Android Studio and let the build use its bundled JBR, or point JAVA_HOME at a Java 21+ install.");
    process.exit(1);
  }

  if (!sdkRoot) {
    console.error("Could not find the Android SDK. Run Android Studio once or set ANDROID_SDK_ROOT.");
    process.exit(1);
  }

  const env = {
    ...process.env,
    JAVA_HOME: javaHome,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    Path: [
      path.join(javaHome, "bin"),
      path.join(sdkRoot, "platform-tools"),
      path.join(sdkRoot, "cmdline-tools", "latest", "bin"),
      process.env.Path ?? process.env.PATH ?? ""
    ].join(";")
  };

  const isWindows = process.platform === "win32";
  const command = isWindows ? process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe" : gradleWrapper;
  const tasks = /Release$/i.test(task) && task.toLowerCase() !== "clean" ? ["clean", task] : [task];
  const args = isWindows
    ? ["/d", "/s", "/c", gradleWrapper, ...tasks, "--stacktrace"]
    : [...tasks, "--stacktrace"];

  const child = spawn(command, args, {
    cwd: androidRoot,
    stdio: "inherit",
    shell: false,
    env
  });

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
