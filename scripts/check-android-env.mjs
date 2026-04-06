import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import os from "node:os";

const divider = () => console.log("--------------------------------------------------");

const runCommand = (command, args = []) => {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    shell: false
  });

  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
  };
};

const readJavaCandidate = (javaHome) => {
  if (!javaHome || !existsSync(javaHome)) {
    return null;
  }

  const executable = path.join(javaHome, "bin", process.platform === "win32" ? "java.exe" : "java");

  if (!existsSync(executable)) {
    return null;
  }

  const result = runCommand(executable, ["-version"]);

  if (!result.ok) {
    return null;
  }

  const match = result.output.match(/version "(?<major>\d+)(?:\.\d+)?/);

  return {
    home: javaHome,
    major: match?.groups?.major ? Number(match.groups.major) : null,
    output: result.output
  };
};

const defaultSdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(os.homedir(), "AppData", "Local", "Android", "Sdk")
].filter(Boolean);

const sdkPath = defaultSdkCandidates.find((candidate) => existsSync(candidate));
const javaCandidates = [
  "C:\\Program Files\\Android\\Android Studio\\jbr",
  process.env.JAVA_HOME,
  "C:\\Program Files\\ojdkbuild\\java-17-openjdk-17.0.3.0.6-1"
]
  .filter(Boolean)
  .map(readJavaCandidate)
  .filter(Boolean);

const java = javaCandidates.find((candidate) => (candidate.major ?? 0) >= 21) ?? javaCandidates[0] ?? null;

console.log("Vector Control Hub Android doctor");
divider();

if (java) {
  const versionLine = java.output.split("\n")[0];
  console.log(`Java: found (${java.major ?? "unknown"})`);
  console.log(versionLine);
  console.log(`JAVA_HOME candidate: ${java.home}`);

  if ((java.major ?? 0) < 21) {
    console.log("Warning: this Android project needs Java 21 or newer for Gradle builds.");
  }
} else {
  console.log("Java: missing");
  console.log("Install Android Studio or set JAVA_HOME to a Java 21+ JDK before building the Android shell.");
}

divider();

if (sdkPath) {
  console.log(`Android SDK: found at ${sdkPath}`);
} else {
  console.log("Android SDK: not found");
  console.log("Open Android Studio once and let it install the Android SDK, or set ANDROID_HOME / ANDROID_SDK_ROOT.");
}

divider();

if (java && (java.major ?? 0) >= 21 && sdkPath) {
  console.log("Android shell foundation looks ready.");
  console.log("Next steps:");
  console.log("1. npm run mobile:android:prepare");
  console.log("2. npm run mobile:android:debug");
  console.log("3. npm run mobile:android:bundle");
  console.log("4. npm run mobile:android:open");
  process.exit(0);
}

if (java && sdkPath) {
  console.log("Android shell foundation is close, but the Java version is too old for this project.");
  console.log("Install Android Studio and let the build use its bundled JBR, or point JAVA_HOME at Java 21+.");
  process.exit(1);
}

if (sdkPath) {
  console.log("Java is still the blocker for Android builds.");
  console.log("Install Android Studio and let the build use its bundled JBR, or set JAVA_HOME to Java 21+.");
  process.exit(1);
}

if (java) {
  console.log("Android SDK is still the blocker for Android builds.");
  console.log("Open Android Studio once and let it install the Android SDK, or set ANDROID_HOME / ANDROID_SDK_ROOT.");
  process.exit(1);
}

console.log("Android shell foundation is not fully ready yet.");
console.log("Fix the missing pieces above, then rerun npm run mobile:android:doctor.");
process.exit(1);
