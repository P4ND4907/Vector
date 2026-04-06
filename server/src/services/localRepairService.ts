import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export interface LocalRepairLaunchResult {
  attempted: boolean;
  launched: boolean;
  executablePath?: string;
  message: string;
}

const buildCandidatePaths = () => {
  const localPrograms = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Programs", "wire-pod", "chipper.exe")
    : "";

  return [
    process.env.WIREPOD_EXECUTABLE?.trim() || "",
    "C:\\Program Files\\wire-pod\\chipper\\chipper.exe",
    "C:\\Program Files\\wire-pod\\wire-pod.exe",
    localPrograms
  ].filter(Boolean);
};

export const createLocalRepairService = () => ({
  getCandidatePaths: buildCandidatePaths,

  async tryStartWirePod(): Promise<LocalRepairLaunchResult> {
    for (const executablePath of buildCandidatePaths()) {
      if (!existsSync(executablePath)) {
        continue;
      }

      try {
        const child = spawn(executablePath, [], {
          detached: true,
          stdio: "ignore",
          windowsHide: true
        });
        child.unref();

        return {
          attempted: true,
          launched: true,
          executablePath,
          message: "Tried starting the local Vector brain from this computer."
        };
      } catch (error) {
        return {
          attempted: true,
          launched: false,
          executablePath,
          message: error instanceof Error ? error.message : "WirePod could not be launched from the app."
        };
      }
    }

    return {
      attempted: false,
      launched: false,
      message: "No local WirePod installation was found in the expected Windows locations."
    };
  }
});
