import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ManagedBridgeStatusRecord } from "../robot/types.js";

const DEFAULT_ENDPOINT = "http://127.0.0.1:8080";
const DEFAULT_TIMEOUT_MS = 1_500;
const START_COOLDOWN_MS = 7_000;
const START_WAIT_MS = 15_000;
const SDK_INFO_PATH = "/api-sdk/get_sdk_info";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeEndpoint = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_ENDPOINT;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_ENDPOINT;
  }
};

const defaultLaunchCandidates = (projectRoot: string) => [
  path.join(projectRoot, "local-bridge", "start.ps1"),
  path.join(projectRoot, "local-bridge", "start.bat"),
  path.join(projectRoot, "local-bridge", "start.cmd"),
  path.join(projectRoot, "wire-pod", "start.ps1"),
  path.join(projectRoot, "wire-pod", "start.bat"),
  path.join(projectRoot, "wire-pod", "start.cmd"),
  path.join(projectRoot, "wire-pod", "start-wire-pod.ps1"),
  path.join(projectRoot, "wire-pod", "start-wire-pod.bat")
];

const resolveLaunchPath = (projectRoot: string) => {
  const configured = process.env.VECTOR_MANAGED_BRIDGE_START?.trim();
  const candidates = [
    ...(configured ? [configured] : []),
    ...defaultLaunchCandidates(projectRoot)
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }

  return "";
};

const probeEndpoint = async (endpoint: string, timeoutMs: number) => {
  try {
    const response = await fetch(`${endpoint}${SDK_INFO_PATH}`, {
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (response.ok) {
      return true;
    }
  } catch {
    // Try POST below.
  }

  try {
    const response = await fetch(`${endpoint}${SDK_INFO_PATH}`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs)
    });

    return response.ok;
  } catch {
    return false;
  }
};

const buildStatus = ({
  endpoint,
  launchPath,
  running
}: {
  endpoint: string;
  launchPath: string;
  running: boolean;
}): ManagedBridgeStatusRecord => {
  if (launchPath) {
    return {
      source: "bundled",
      available: true,
      running,
      endpoint,
      launchPath,
      note: running
        ? "Bundled local bridge is running."
        : "Bundled local bridge is available and can be started automatically."
    };
  }

  if (running) {
    return {
      source: "external",
      available: false,
      running: true,
      endpoint,
      note: "Using an external local bridge."
    };
  }

  return {
    source: "none",
    available: false,
    running: false,
    endpoint,
    note: "No bundled local bridge was found yet."
  };
};

const startLaunchPath = (launchPath: string) => {
  const extension = path.extname(launchPath).toLowerCase();
  const cwd = path.dirname(launchPath);

  if (extension === ".ps1") {
    spawn(
      "powershell.exe",
      ["-ExecutionPolicy", "Bypass", "-File", launchPath],
      {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true
      }
    ).unref();
    return;
  }

  if (extension === ".bat" || extension === ".cmd") {
    spawn(
      "cmd.exe",
      ["/c", launchPath],
      {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true
      }
    ).unref();
    return;
  }

  if (extension === ".exe") {
    spawn(
      launchPath,
      [],
      {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: true
      }
    ).unref();
  }
};

export const createLocalBridgeManager = ({
  projectRoot = process.cwd(),
  endpoint = process.env.VECTOR_MANAGED_BRIDGE_ENDPOINT,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: {
  projectRoot?: string;
  endpoint?: string;
  timeoutMs?: number;
} = {}) => {
  const managedEndpoint = normalizeEndpoint(endpoint);
  let cachedStatus = buildStatus({
    endpoint: managedEndpoint,
    launchPath: resolveLaunchPath(projectRoot),
    running: false
  });
  let startPromise: Promise<ManagedBridgeStatusRecord> | null = null;
  let lastStartAttemptAt = 0;

  const refreshStatus = async () => {
    const launchPath = resolveLaunchPath(projectRoot);
    const running = await probeEndpoint(managedEndpoint, timeoutMs);
    cachedStatus = buildStatus({
      endpoint: managedEndpoint,
      launchPath,
      running
    });
    return cachedStatus;
  };

  return {
    getCachedStatus: () => cachedStatus,
    refreshStatus,
    ensureRunning: async () => {
      const status = await refreshStatus();
      if (status.running || !status.available || !status.launchPath) {
        return status;
      }

      if (startPromise) {
        return startPromise;
      }

      if (Date.now() - lastStartAttemptAt < START_COOLDOWN_MS) {
        return status;
      }

      lastStartAttemptAt = Date.now();
      startPromise = (async () => {
        startLaunchPath(status.launchPath!);

        const deadline = Date.now() + START_WAIT_MS;
        while (Date.now() < deadline) {
          await sleep(800);
          const nextStatus = await refreshStatus();
          if (nextStatus.running) {
            return nextStatus;
          }
        }

        return cachedStatus;
      })();

      try {
        return await startPromise;
      } finally {
        startPromise = null;
      }
    }
  };
};
