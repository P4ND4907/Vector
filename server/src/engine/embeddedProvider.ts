import type { RobotController, RobotStatus } from "../robot/types.js";
import type { EngineProviderStatus } from "./types.js";

const GAP_MESSAGE =
  "Embedded SDK transport is not implemented. This provider is a placeholder for future direct Vector SDK integration.";

const PROTOCOL_GAPS = [
  "Direct BLE/SDK transport not implemented",
  "Requires Vector SDK native bindings",
  "No certificate exchange layer"
];

const notConnectedStatus = (): RobotStatus => ({
  id: "embedded-placeholder",
  name: "Vector (Embedded - Not Connected)",
  ipAddress: "",
  token: "",
  batteryPercent: 0,
  isCharging: false,
  isConnected: false,
  isDocked: false,
  lastSeen: new Date().toISOString(),
  firmwareVersion: "unknown",
  mood: "unknown",
  connectionState: "disconnected",
  wifiStrength: 0,
  isMuted: false,
  volume: 0,
  cameraAvailable: false,
  connectionSource: "mock",
  systemStatus: "offline",
  currentActivity: "Embedded SDK not available"
});

const errorRecord = (type: string, payload: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  type,
  payload,
  status: "error" as const,
  createdAt: new Date().toISOString(),
  resultMessage: GAP_MESSAGE
});

export const getEmbeddedProviderStatus = (): EngineProviderStatus => ({
  provider: "embedded",
  available: false,
  connected: false,
  note: GAP_MESSAGE,
  protocolGaps: PROTOCOL_GAPS
});

export const createEmbeddedProvider = (): RobotController => {
  const stub = (type: string, payload: Record<string, unknown> = {}) =>
    Promise.resolve(errorRecord(type, payload));

  return {
    getStatus: () => Promise.resolve(notConnectedStatus()),
    getIntegrationInfo: () =>
      Promise.resolve({
        source: "mock" as const,
        wirePodReachable: false,
        wirePodBaseUrl: "",
        robotReachable: false,
        mockMode: true,
        autoDetectEnabled: false,
        reconnectOnStartup: false,
        probes: [],
        managedBridge: {
          source: "none" as const,
          available: false,
          running: false,
          endpoint: "",
          note: GAP_MESSAGE
        },
        note: GAP_MESSAGE
      }),
    getBridgeWatchdogStatus: () =>
      Promise.resolve({
        enabled: false,
        intervalMs: 0,
        lastCheckedAt: new Date().toISOString(),
        healthy: false,
        note: GAP_MESSAGE
      } as never),
    connect: () => Promise.resolve(notConnectedStatus()),
    disconnect: () => Promise.resolve(notConnectedStatus()),
    discoverRobots: () => Promise.resolve([]),
    drive: (payload) => stub("drive", payload as Record<string, unknown>),
    head: (payload) => stub("head", payload as Record<string, unknown>),
    lift: (payload) => stub("lift", payload as Record<string, unknown>),
    speak: (payload) => stub("speak", payload as Record<string, unknown>),
    animation: (payload) => stub("animation", payload as Record<string, unknown>),
    dock: () => stub("dock"),
    wake: () => stub("wake"),
    toggleMute: (payload) => stub("toggleMute", payload as Record<string, unknown>),
    setVolume: (payload) => stub("setVolume", payload as Record<string, unknown>),
    getSettings: () => Promise.reject(new Error(GAP_MESSAGE)),
    updateSettings: () => Promise.reject(new Error(GAP_MESSAGE)),
    runDiagnostics: () => Promise.reject(new Error(GAP_MESSAGE)),
    getSnapshots: () => Promise.resolve([]),
    syncPhotos: () =>
      Promise.resolve({ snapshots: [], latestSnapshot: undefined, syncedCount: 0, note: GAP_MESSAGE }),
    capturePhoto: () =>
      Promise.resolve({ snapshots: [], latestSnapshot: undefined, syncedCount: 0, note: GAP_MESSAGE }),
    getCameraStreamUrl: () => Promise.resolve(undefined),
    getPhotoImage: () => Promise.reject(new Error(GAP_MESSAGE)),
    deletePhoto: () =>
      Promise.resolve({ snapshots: [], latestSnapshot: undefined, syncedCount: 0, note: GAP_MESSAGE }),
    getVoiceDiagnostics: () => Promise.reject(new Error(GAP_MESSAGE)),
    repairVoiceSetup: () => stub("repairVoiceSetup"),
    getWirePodWeatherConfig: () => Promise.reject(new Error(GAP_MESSAGE)),
    setWirePodWeatherConfig: () => Promise.reject(new Error(GAP_MESSAGE)),
    getWirePodSetupStatus: () => Promise.reject(new Error(GAP_MESSAGE)),
    finishWirePodSetup: () => Promise.reject(new Error(GAP_MESSAGE)),
    quickRepair: () => Promise.reject(new Error(GAP_MESSAGE)),
    getSupportReports: () => Promise.resolve([]),
    getAiMemory: () => Promise.resolve([]),
    saveAiMemory: () => Promise.reject(new Error(GAP_MESSAGE)),
    getLearnedCommands: () => Promise.resolve([]),
    saveLearnedCommand: () => Promise.reject(new Error(GAP_MESSAGE)),
    deleteLearnedCommand: () => Promise.resolve(undefined),
    getCommandGaps: () => Promise.resolve([]),
    recordCommandGap: () => Promise.reject(new Error(GAP_MESSAGE)),
    reportProblem: () => Promise.reject(new Error(GAP_MESSAGE)),
    getAutomationControl: () => Promise.reject(new Error(GAP_MESSAGE)),
    getRoamSessions: () => Promise.resolve([]),
    startRoam: () => Promise.reject(new Error(GAP_MESSAGE)),
    pauseRoam: () => Promise.reject(new Error(GAP_MESSAGE)),
    resumeRoam: () => Promise.reject(new Error(GAP_MESSAGE)),
    stopRoam: () => Promise.reject(new Error(GAP_MESSAGE)),
    getRoutines: () => Promise.resolve([]),
    saveRoutine: () => Promise.reject(new Error(GAP_MESSAGE)),
    updateRoutine: () => Promise.resolve(undefined),
    deleteRoutine: () => Promise.resolve(false),
    getLogs: () => Promise.resolve([])
  };
};
