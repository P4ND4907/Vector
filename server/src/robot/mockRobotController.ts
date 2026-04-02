import { Buffer } from "node:buffer";
import type {
  AutomationControlRecord,
  CameraImageAsset,
  CameraSnapshotRecord,
  CameraSyncResult,
  CommandLogRecord,
  DiagnosticReportRecord,
  DiscoveredRobot,
  RobotController,
  RobotIntegrationInfo,
  RobotStatus,
  RoamSessionRecord,
  RoutineRecord,
  RuntimeSettings
} from "./types.js";

const makeId = () => crypto.randomUUID();

const buildMockPhotoDataUrl = (label: string, accent: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#061226" />
        <stop offset="100%" stop-color="${accent}" />
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="28" fill="url(#bg)" />
    <circle cx="320" cy="180" r="120" fill="rgba(255,255,255,0.08)" />
    <rect x="198" y="104" width="244" height="152" rx="50" fill="rgba(10,17,31,0.75)" stroke="#7af8ea" stroke-width="8" />
    <circle cx="278" cy="178" r="24" fill="#d8fcff" />
    <circle cx="362" cy="178" r="24" fill="#d8fcff" />
    <text x="50%" y="316" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, sans-serif" font-size="26">${label}</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const buildMockSnapshot = (remoteId: string, label: string, accent: string): CameraSnapshotRecord => ({
  id: makeId(),
  remoteId,
  createdAt: new Date().toISOString(),
  label,
  dataUrl: buildMockPhotoDataUrl(label, accent),
  motionScore: 0,
  source: "mock"
});

const buildSettings = (): RuntimeSettings => ({
  theme: "dark",
  colorTheme: "vector",
  autoDetectWirePod: true,
  customWirePodEndpoint: "",
  savedWirePodEndpoint: "",
  mockMode: true,
  reconnectOnStartup: true,
  pollingIntervalMs: 6000,
  liveUpdateMode: "polling",
  serial: "mock-serial-01"
});

const buildRobot = (): RobotStatus => ({
  id: "vector-01",
  name: "Vector Prime",
  nickname: "Scout",
  ipAddress: "192.168.0.18",
  token: "mock-vector-token",
  batteryPercent: 76,
  isCharging: false,
  isConnected: true,
  isDocked: false,
  lastSeen: new Date().toISOString(),
  firmwareVersion: "2.4.1-local",
  mood: "playful",
  connectionState: "connected",
  wifiStrength: 88,
  isMuted: false,
  volume: 3,
  cameraAvailable: true,
  connectionSource: "mock",
  serial: "mock-serial-01",
  systemStatus: "ready",
  currentActivity: "Awaiting your next command."
});

const baseRoutines: RoutineRecord[] = [
  {
    id: "routine-1",
    name: "Morning Greeting",
    enabled: true,
    triggerType: "schedule",
    triggerValue: "07:00",
    conditions: ["Only when connected"],
    actions: [
      { type: "speak", value: "Good morning. Ready to roll." },
      { type: "animation", value: "happy-hello" }
    ],
    delayMs: 0,
    repeat: "daily",
    lastRunAt: new Date(Date.now() - 86_400_000).toISOString()
  }
];

const makeLog = (
  type: string,
  payload: Record<string, unknown>,
  status: CommandLogRecord["status"],
  resultMessage: string
): CommandLogRecord => ({
  id: makeId(),
  type,
  payload,
  status,
  createdAt: new Date().toISOString(),
  resultMessage
});

const createDiagnosticsReport = (robot: RobotStatus): DiagnosticReportRecord => ({
  id: makeId(),
  createdAt: new Date().toISOString(),
  overallStatus: robot.isConnected ? "healthy" : "attention",
  summary: robot.isConnected
    ? "Mock diagnostics passed across network, power, and motion checks."
    : "Mock diagnostics found the robot offline.",
  robotName: robot.nickname ?? robot.name,
  troubleshooting: robot.isConnected
    ? ["Mock mode is active, so live WirePod checks are not running."]
    : ["Turn off mock mode when you are ready to use the real local WirePod connection."],
  checks: [
    {
      id: makeId(),
      label: "Mock network",
      category: "network",
      status: robot.isConnected ? "pass" : "warn",
      metric: robot.isConnected ? "Connected" : "Offline",
      details: "Mock mode simulates the local network path."
    },
    {
      id: makeId(),
      label: "Battery",
      category: "power",
      status: robot.batteryPercent > 20 ? "pass" : "warn",
      metric: `${robot.batteryPercent}%`,
      details: "Battery is simulated for development and UI testing."
    },
    {
      id: makeId(),
      label: "Motion",
      category: "motion",
      status: "pass",
      metric: "Available",
      details: "Mock movement commands are ready."
    }
  ]
});

export const createMockRobotController = (): RobotController => {
  let settings = buildSettings();
  let robot = buildRobot();
  let routines = [...baseRoutines];
  let automationControl: AutomationControlRecord = {
    status: "idle",
    behavior: "patrol",
    targetArea: "Desk perimeter",
    safeReturnEnabled: true,
    captureSnapshots: true,
    dataCollectionEnabled: true,
    autoDockThreshold: 24
  };
  let roamSessions: RoamSessionRecord[] = [];
  const discoveredRobots: DiscoveredRobot[] = [
    {
      id: "mock-serial-01",
      serial: "mock-serial-01",
      name: "Vector Prime",
      ipAddress: "192.168.0.18",
      signalStrength: 88,
      secure: true,
      activated: true,
      lastSeen: new Date().toISOString()
    }
  ];
  let logs: CommandLogRecord[] = [
    makeLog("connect", { ipAddress: robot.ipAddress }, "success", "Connected to Vector Prime.")
  ];
  let snapshots: CameraSnapshotRecord[] = [
    buildMockSnapshot("mock-2", "Mock desk patrol", "#1d6f68"),
    buildMockSnapshot("mock-1", "Mock dock check", "#12397a")
  ];
  let integrationInfo: RobotIntegrationInfo = {
    source: "mock",
    wirePodReachable: false,
    wirePodBaseUrl: settings.savedWirePodEndpoint || "http://127.0.0.1:8080",
    note: "Mock mode is active.",
    robotReachable: true,
    mockMode: true,
    autoDetectEnabled: settings.autoDetectWirePod,
    reconnectOnStartup: settings.reconnectOnStartup,
    customEndpoint: settings.customWirePodEndpoint || undefined,
    lastCheckedAt: new Date().toISOString(),
    probes: []
  };

  const pushLog = (log: CommandLogRecord) => {
    logs = [log, ...logs].slice(0, 200);
    robot = {
      ...robot,
      lastSeen: new Date().toISOString()
    };
    return log;
  };

  return {
    getStatus: () => robot,
    getIntegrationInfo: () => integrationInfo,
    getSettings: () => settings,
    updateSettings: (patch) => {
      settings = { ...settings, ...patch, mockMode: true };
      integrationInfo = {
        ...integrationInfo,
        wirePodBaseUrl: settings.savedWirePodEndpoint || settings.customWirePodEndpoint || "http://127.0.0.1:8080",
        autoDetectEnabled: settings.autoDetectWirePod,
        reconnectOnStartup: settings.reconnectOnStartup,
        customEndpoint: settings.customWirePodEndpoint || undefined,
        lastCheckedAt: new Date().toISOString()
      };
      return settings;
    },
    discoverRobots: () => discoveredRobots,
    connect: (payload) => {
      robot = {
        ...robot,
        ...payload,
        isConnected: true,
        isCharging: false,
        isDocked: false,
        connectionState: "connected",
        systemStatus: "ready",
        currentActivity: "Connected in mock mode.",
        lastSeen: new Date().toISOString()
      };
      pushLog(makeLog("connect", payload ?? {}, "success", `Connected to ${robot.name}.`));
      return robot;
    },
    disconnect: () => {
      robot = {
        ...robot,
        isConnected: false,
        connectionState: "disconnected",
        systemStatus: "offline",
        currentActivity: "Disconnected in mock mode.",
        lastSeen: new Date().toISOString()
      };
      pushLog(makeLog("disconnect", {}, "success", `${robot.name} disconnected safely.`));
      return robot;
    },
    drive: (payload) =>
      pushLog(makeLog("drive", payload, "success", `${payload.direction} command accepted.`)),
    head: (payload) => pushLog(makeLog("head", payload, "success", `Head angle set to ${payload.angle}.`)),
    lift: (payload) => pushLog(makeLog("lift", payload, "success", `Lift height set to ${payload.height}.`)),
    speak: (payload) => pushLog(makeLog("speak", payload, "success", `Speaking: ${payload.text}`)),
    animation: (payload) =>
      pushLog(makeLog("animation", payload, "success", `Animation ${payload.animationId} queued.`)),
    dock: () => {
      robot = {
        ...robot,
        isCharging: true,
        isDocked: true,
        mood: "charging",
        systemStatus: "charging",
        currentActivity: "Returning to the charger."
      };
      return pushLog(makeLog("dock", {}, "success", "Vector is returning to the charger."));
    },
    wake: () => {
      robot = {
        ...robot,
        isCharging: false,
        isDocked: false,
        connectionState: "connected",
        isConnected: true,
        systemStatus: "ready",
        currentActivity: "Waking up."
      };
      return pushLog(makeLog("wake", {}, "success", "Wake command sent."));
    },
    toggleMute: ({ isMuted }) => {
      robot = {
        ...robot,
        isMuted
      };
      return pushLog(makeLog("mute", { isMuted }, "success", isMuted ? "Audio muted." : "Audio unmuted."));
    },
    setVolume: ({ volume }) => {
      robot = {
        ...robot,
        volume
      };
      return pushLog(makeLog("volume", { volume }, "success", `Volume set to ${volume}.`));
    },
    getSnapshots: () => snapshots,
    capturePhoto: () => {
      const next = buildMockSnapshot(
        `mock-${snapshots.length + 1}`,
        `Mock capture ${snapshots.length + 1}`,
        "#2c8f8b"
      );
      snapshots = [next, ...snapshots].slice(0, 12);
      pushLog(makeLog("photo-capture", { count: snapshots.length }, "success", "Mock photo captured."));

      return {
        snapshots,
        latestSnapshot: next,
        syncedCount: 1,
        note: "Mock photo captured."
      } satisfies CameraSyncResult;
    },
    syncPhotos: () => {
      const next = buildMockSnapshot(
        `mock-${snapshots.length + 1}`,
        `Mock snapshot ${snapshots.length + 1}`,
        "#5b3cc4"
      );
      snapshots = [next, ...snapshots].slice(0, 12);
      pushLog(makeLog("photo-sync", { count: snapshots.length }, "success", "Mock photo synced."));

      const result: CameraSyncResult = {
        snapshots,
        latestSnapshot: next,
        syncedCount: 1,
        note: "Mock photo synced."
      };

      return result;
    },
    getCameraStreamUrl: () => undefined,
    getPhotoImage: (photoId): CameraImageAsset => {
      const snapshot = snapshots.find((item) => item.remoteId === photoId || item.id === photoId);
      if (!snapshot) {
        throw new Error("That mock photo is no longer available.");
      }

      const encoded = snapshot.dataUrl.split(",")[1] ?? "";
      return {
        contentType: "image/svg+xml",
        buffer: Buffer.from(decodeURIComponent(encoded), "utf8")
      };
    },
    runDiagnostics: () => createDiagnosticsReport(robot),
    getAutomationControl: () => automationControl,
    getRoamSessions: () => roamSessions,
    startRoam: (nextAutomation) => {
      const startedAt = new Date().toISOString();
      const session: RoamSessionRecord = {
        id: makeId(),
        name: `${nextAutomation.targetArea} roam ${roamSessions.length + 1}`,
        status: "running",
        behavior: nextAutomation.behavior,
        targetArea: nextAutomation.targetArea,
        startedAt,
        distanceMeters: 0,
        commandsIssued: 0,
        snapshotsTaken: 0,
        dataPointsCollected: 0,
        batteryStart: robot.batteryPercent,
        summary: "Mock roam started and is collecting sample telemetry.",
        events: [
          {
            id: makeId(),
            createdAt: startedAt,
            type: "status",
            message: `Mock ${nextAutomation.behavior} roam started in ${nextAutomation.targetArea}.`,
            batteryPercent: robot.batteryPercent,
            dataPointsCollected: 0
          }
        ]
      };

      automationControl = {
        ...automationControl,
        ...nextAutomation,
        status: "running",
        activeSessionId: session.id,
        startedAt,
        lastHeartbeatAt: startedAt
      };
      roamSessions = [session, ...roamSessions].slice(0, 24);
      robot = {
        ...robot,
        mood: "focused",
        currentActivity: `Roaming ${nextAutomation.targetArea} in mock mode.`,
        lastSeen: startedAt
      };
      pushLog(makeLog("automation-start", { sessionId: session.id }, "success", `Roam started for ${nextAutomation.targetArea}.`));
      return session;
    },
    pauseRoam: () => {
      const active = roamSessions.find((session) => session.id === automationControl.activeSessionId);
      if (!active) {
        throw new Error("There is no active roam session to pause.");
      }

      const nextSession: RoamSessionRecord = {
        ...active,
        status: "paused",
        summary: "Mock roam paused."
      };
      roamSessions = roamSessions.map((session) => (session.id === active.id ? nextSession : session));
      automationControl = {
        ...automationControl,
        status: "paused",
        lastHeartbeatAt: new Date().toISOString()
      };
      pushLog(makeLog("automation-pause", { sessionId: active.id }, "success", `${active.name} paused.`));
      return nextSession;
    },
    resumeRoam: () => {
      const active = roamSessions.find((session) => session.id === automationControl.activeSessionId);
      if (!active) {
        throw new Error("There is no paused roam session to resume.");
      }

      const nextSession: RoamSessionRecord = {
        ...active,
        status: "running",
        summary: "Mock roam resumed."
      };
      roamSessions = roamSessions.map((session) => (session.id === active.id ? nextSession : session));
      automationControl = {
        ...automationControl,
        status: "running",
        lastHeartbeatAt: new Date().toISOString()
      };
      pushLog(makeLog("automation-resume", { sessionId: active.id }, "success", `${active.name} resumed.`));
      return nextSession;
    },
    stopRoam: () => {
      const active = roamSessions.find((session) => session.id === automationControl.activeSessionId);
      if (!active) {
        throw new Error("There is no roam session to stop.");
      }

      const endedAt = new Date().toISOString();
      const nextSession: RoamSessionRecord = {
        ...active,
        status: "completed",
        endedAt,
        batteryEnd: robot.batteryPercent,
        summary: "Mock roam completed and stored locally."
      };
      roamSessions = roamSessions.map((session) => (session.id === active.id ? nextSession : session));
      automationControl = {
        ...automationControl,
        status: "idle",
        activeSessionId: undefined,
        lastHeartbeatAt: endedAt
      };
      robot = {
        ...robot,
        mood: robot.isCharging ? "charging" : "ready",
        currentActivity: "Awaiting your next command.",
        lastSeen: endedAt
      };
      pushLog(makeLog("automation-stop", { sessionId: active.id }, "success", `${active.name} stopped and stored.`));
      return nextSession;
    },
    getRoutines: () => routines,
    saveRoutine: (routine) => {
      routines = [routine, ...routines.filter((item) => item.id !== routine.id)];
      pushLog(makeLog("routine-save", { routineId: routine.id }, "success", `Saved routine ${routine.name}.`));
      return routine;
    },
    updateRoutine: (routineId, patch) => {
      const existing = routines.find((item) => item.id === routineId);
      if (!existing) {
        return undefined;
      }
      const next = { ...existing, ...patch };
      routines = routines.map((item) => (item.id === routineId ? next : item));
      pushLog(makeLog("routine-update", { routineId }, "success", `Updated routine ${next.name}.`));
      return next;
    },
    deleteRoutine: (routineId) => {
      const before = routines.length;
      routines = routines.filter((item) => item.id !== routineId);
      pushLog(makeLog("routine-delete", { routineId }, "success", `Deleted routine ${routineId}.`));
      return routines.length < before;
    },
    getLogs: () => logs
  };
};
