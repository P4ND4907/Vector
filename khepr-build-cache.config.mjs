import { definePresetTask } from "@pandora/build-cache";

const appInputs = [
  "src/**/*",
  "public/**/*",
  "index.html",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "tailwind.config.ts",
  "postcss.config.js",
  "components.json",
  "capacitor.config.ts"
];

const desktopPackagingInputs = [
  "desktop/**/*",
  "local-bridge/**/*",
  "direct-bridge/**/*",
  "build-resources/**/*",
  "scripts/prune-electron-output.mjs",
  "scripts/serve-static-app.mjs",
  "package.json",
  "package-lock.json"
];

const androidNativeInputs = [
  "package.json",
  "capacitor.config.ts",
  "android/build.gradle",
  "android/settings.gradle",
  "android/variables.gradle",
  "android/gradle.properties",
  "android/gradle/wrapper/**/*",
  "android/capacitor.settings.gradle",
  "android/capacitor-cordova-android-plugins/build.gradle",
  "android/capacitor-cordova-android-plugins/src/**/*",
  "android/app/build.gradle",
  "android/app/proguard-rules.pro",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/src/main/java/**/*",
  "android/app/src/main/res/**/*",
  "android/app/src/test/**/*",
  "android/app/src/androidTest/**/*",
  "../scripts/run-android-gradle.mjs",
  "../scripts/sync-android-safe.mjs",
  "../scripts/clean-android-generated.mjs"
];

export default {
  namespaceStrategy: "git-branch",
  remote: {
    directory: ".pandora-workspace-remote-cache",
    pullOnRun: true,
    pushOnRun: true
  },
  tasks: {
    app: definePresetTask("vite", {
      cwd: "app",
      command: "npm.cmd run build",
      inputs: appInputs,
      outputs: ["dist"],
      description: "Build the React control hub web app."
    }),
    server: {
      cwd: "server",
      command: "npm.cmd run build",
      inputs: ["src/**/*", "package.json", "tsconfig.json"],
      outputs: ["dist"],
      description: "Build the local Express and TensorFlow server."
    },
    desktopAssets: {
      command: "npm.cmd run desktop:assets",
      inputs: ["app/public/icon.svg", "scripts/generate-desktop-icons.mjs", "package.json"],
      outputs: ["build-resources/icons"],
      description: "Generate desktop icon assets used by Electron packaging."
    },
    desktop: {
      command: "npm.cmd run desktop:dist:raw",
      dependsOn: ["app", "server", "desktopAssets"],
      inputs: desktopPackagingInputs,
      outputs: ["dist-electron"],
      description: "Package the Windows desktop app from cached web and server builds."
    },
    android: {
      cwd: "app",
      command: "npm.cmd run mobile:debug:android",
      dependsOn: ["app"],
      hashEnv: ["CAPACITOR_APP_ID"],
      inputs: androidNativeInputs,
      outputs: ["android/app/build"],
      description: "Build the Android app from the cached Capacitor web bundle."
    }
  }
};
