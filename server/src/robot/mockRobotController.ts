import { Buffer } from "node:buffer";
import type {
  AiMemoryRecord,
  AutomationControlRecord,
  BridgeWatchdogStatusRecord,
  CameraImageAsset,
  CameraSnapshotRecord,
  CameraSyncResult,
  CommandGapRecord,
  CommandLogRecord,
  DiagnosticReportRecord,
  DiscoveredRobot,
  LearnedCommandRecord,
  RepairResultRecord,
  RobotController,
  RobotIntegrationInfo,
  RoamEventRecord,
  RobotStatus,
  RoamSessionRecord,
  RoutineRecord,
  RuntimeSettings,
  SupportReportRecord,
  WirePodSetupStatusRecord,
  WirePodWeatherConfigRecord,
  VoiceDiagnosticsRecord
} from "./types.js";
import {
  deleteLearnedCommand,
  upsertLearnedCommand
} from "../services/learnedCommandsService.js";

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
  protectChargingUntilFull: true,
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
    },
    {
      id: makeId(),
      label: "Wake word",
      category: "audio",
      status: "pass",
      metric: "Hey Vector",
      details: "Mock mode keeps the voice defaults on a healthy baseline."
    },
    {
      id: makeId(),
      label: "Speech locale",
      category: "audio",
      status: "pass",
      metric: "en-US",
      details: "Mock voice testing is using English (US)."
    },
    {
      id: makeId(),
      label: "Speaker volume",
      category: "audio",
      status: "pass",
      metric: `${robot.volume}/5`,
      details: "Mock speaker volume is high enough for testing."
    },
    {
      id: makeId(),
      label: "Voice pipeline",
      category: "audio",
      status: "pass",
      metric: "intent_time",
      details: "Mock mode is simulating a recent successful voice intent."
    }
  ]
});

const createVoiceDiagnostics = (robot: RobotStatus): VoiceDiagnosticsRecord => ({
  wakeWordMode: "hey-vector",
  locale: "en-US",
  volume: robot.volume,
  lastIntent: "intent_time",
  lastTranscription: "what time is it",
  lastHeardAt: new Date().toISOString(),
  status: "healthy",
  summary: "Mock mode is simulating a healthy Hey Vector setup.",
  troubleshooting: ["Turn off mock mode when you are ready to test the real robot microphone path."]
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
  let supportReports: SupportReportRecord[] = [];
  let aiMemory: AiMemoryRecord[] = [];
  let learnedCommands: LearnedCommandRecord[] = [];
  let commandGaps: CommandGapRecord[] = [];
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
    bridgeProvider: "wirepod",
    bridgeLabel: "WirePod compatibility bridge",
    bridgeReachable: false,
    bridgeBaseUrl: settings.savedWirePodEndpoint || "http://127.0.0.1:8080",
    managedBridge: {
      source: "none",
      available: false,
      running: false,
      endpoint: settings.savedWirePodEndpoint || "http://127.0.0.1:8080",
      note: "Mock mode does not use a live local bridge."
    },
    note: "Mock mode is active.",
    robotReachable: true,
    mockMode: true,
    autoDetectEnabled: settings.autoDetectWirePod,
    reconnectOnStartup: settings.reconnectOnStartup,
    customEndpoint: settings.customWirePodEndpoint || undefined,
    lastCheckedAt: new Date().toISOString(),
    probes: []
  };
  const automationHeartbeatIntervalMs = {
    patrol: 14_000,
    explore: 11_000,
    quiet: 18_000
  } as const satisfies Record<AutomationControlRecord["behavior"], number>;
  const roundMetric = (value: number) => Math.round(value * 100) / 100;
  const pushRoamEvent = (
    session: RoamSessionRecord,
    event: RoamEventRecord,
    summary: string
  ): RoamSessionRecord => ({
    ...session,
    summary,
    events: [event, ...session.events].slice(0, 18)
  });
  const runMockAutomationHeartbeat = () => {
    if (automationControl.status !== "running") {
      return;
    }

    const active = roamSessions.find((session) => session.id === automationControl.activeSessionId);
    if (!active || active.status !== "running") {
      return;
    }

    const lastHeartbeatMs = new Date(automationControl.lastHeartbeatAt || active.startedAt).getTime();
    const intervalMs = automationHeartbeatIntervalMs[automationControl.behavior];
    if (Number.isFinite(lastHeartbeatMs) && Date.now() - lastHeartbeatMs < intervalMs) {
      return;
    }

    const nowIso = new Date().toISOString();
    const batteryDrain =
      automationControl.behavior === "explore" ? 2 : automationControl.behavior === "quiet" ? 1 : 1;
    const dataGain =
      automationControl.dataCollectionEnabled
        ? automationControl.behavior === "explore"
          ? 4
          : 3
        : 0;

    if (automationControl.safeReturnEnabled && robot.batteryPercent <= automationControl.autoDockThreshold) {
      const summary = `Mock auto-return triggered at ${robot.batteryPercent}% battery.`;
      const event: RoamEventRecord = {
        id: makeId(),
        createdAt: nowIso,
        type: "battery",
        message: `Battery reached ${robot.batteryPercent}%. Mock mode returned to the charger automatically.`,
        batteryPercent: robot.batteryPercent,
        dataPointsCollected: active.dataPointsCollected
      };
      roamSessions = roamSessions.map((session) =>
        session.id === active.id
          ? pushRoamEvent(
              {
                ...session,
                status: "completed",
                endedAt: nowIso,
                batteryEnd: robot.batteryPercent
              },
              event,
              summary
            )
          : session
      );
      automationControl = {
        ...automationControl,
        status: "idle",
        activeSessionId: undefined,
        lastHeartbeatAt: nowIso
      };
      robot = {
        ...robot,
        isDocked: true,
        isCharging: true,
        mood: "charging",
        currentActivity: "Mock auto-returning to the charger.",
        lastSeen: nowIso
      };
      pushLog(makeLog("automation-auto-dock", { sessionId: active.id }, "success", summary));
      return;
    }

    if (robot.isDocked) {
      const chargeGain = robot.isCharging ? 2 : 1;
      const nextBattery = Math.min(100, robot.batteryPercent + chargeGain);
      const summary = "Mock roam is armed, but Vector is still on the charger.";
      const event: RoamEventRecord = {
        id: makeId(),
        createdAt: nowIso,
        type: "dock",
        message: `Mock roam heartbeat checked ${automationControl.targetArea}, but the robot is still docked.`,
        batteryPercent: nextBattery,
        dataPointsCollected: active.dataPointsCollected + Math.max(1, dataGain - 1)
      };
      roamSessions = roamSessions.map((session) =>
        session.id === active.id
          ? pushRoamEvent(
              {
                ...session,
                dataPointsCollected: session.dataPointsCollected + Math.max(1, dataGain - 1)
              },
              event,
              summary
            )
          : session
      );
      automationControl = {
        ...automationControl,
        lastHeartbeatAt: nowIso
      };
      robot = {
        ...robot,
        batteryPercent: nextBattery,
        currentActivity: summary,
        lastSeen: nowIso
      };
      return;
    }

    const stepIndex = active.commandsIssued % 4;
    let eventType: RoamEventRecord["type"] = "movement";
    let summary = "";
    let distanceGain = 0;
    let snapshotGain = 0;

    if (automationControl.behavior === "explore") {
      if (stepIndex === 0) {
        summary = `Mock explore mode pushed into a new route in ${automationControl.targetArea}.`;
        distanceGain = 0.52;
      } else if (stepIndex === 1) {
        summary = "Mock explore mode pivoted to a fresh angle.";
        distanceGain = 0.14;
      } else if (stepIndex === 2) {
        summary = "Mock explore mode paused for a curious scan.";
        distanceGain = 0.05;
        eventType = "vision";
      } else {
        summary = `Mock explore mode pressed deeper into ${automationControl.targetArea}.`;
        distanceGain = 0.46;
      }
    } else if (automationControl.behavior === "quiet") {
      if (stepIndex === 0) {
        summary = "Mock quiet patrol drifted forward softly.";
        distanceGain = 0.12;
      } else if (stepIndex === 1) {
        summary = "Mock quiet patrol made a small lookout check.";
        distanceGain = 0.03;
        eventType = "vision";
      } else if (stepIndex === 2) {
        summary = "Mock quiet patrol adjusted course gently.";
        distanceGain = 0.1;
      } else {
        summary = "Mock quiet patrol paused to listen.";
        distanceGain = 0;
        eventType = "status";
      }
    } else {
      if (stepIndex === 0) {
        summary = `Mock patrol sweep forward through ${automationControl.targetArea}.`;
        distanceGain = 0.32;
      } else if (stepIndex === 1) {
        summary = `Mock patrol pivoted left to re-check ${automationControl.targetArea}.`;
        distanceGain = 0.1;
      } else if (stepIndex === 2) {
        summary = `Mock patrol continued through ${automationControl.targetArea}.`;
        distanceGain = 0.32;
      } else {
        summary = "Mock patrol visual sweep complete.";
        distanceGain = 0.05;
        eventType = "vision";
      }
    }

    if (
      automationControl.captureSnapshots &&
      (active.commandsIssued + 1) % (automationControl.behavior === "explore" ? 3 : 4) === 0
    ) {
      snapshotGain = 1;
      summary = `${summary} Mock snapshot captured for the session log.`;
      eventType = "vision";
    }

    const nextBattery = Math.max(5, robot.batteryPercent - batteryDrain);
    const nextDataPoints = active.dataPointsCollected + dataGain + (snapshotGain ? 2 : 0);
    const event: RoamEventRecord = {
      id: makeId(),
      createdAt: nowIso,
      type: eventType,
      message: summary,
      batteryPercent: nextBattery,
      dataPointsCollected: nextDataPoints
    };

    roamSessions = roamSessions.map((session) =>
      session.id === active.id
        ? pushRoamEvent(
            {
              ...session,
              distanceMeters: roundMetric(session.distanceMeters + distanceGain),
              commandsIssued: session.commandsIssued + 1,
              snapshotsTaken: session.snapshotsTaken + snapshotGain,
              dataPointsCollected: nextDataPoints
            },
            event,
            summary
          )
        : session
    );
    automationControl = {
      ...automationControl,
      lastHeartbeatAt: nowIso
    };
    robot = {
      ...robot,
      batteryPercent: nextBattery,
      mood: "focused",
      currentActivity: summary,
      lastSeen: nowIso
    };
  };
  let wirePodWeatherConfig: WirePodWeatherConfigRecord = {
    enable: false,
    provider: "",
    key: "",
    unit: ""
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
    getStatus: () => {
      runMockAutomationHeartbeat();
      return robot;
    },
    getIntegrationInfo: () => integrationInfo,
    getBridgeWatchdogStatus: (): BridgeWatchdogStatusRecord => ({
      observedAt: new Date().toISOString(),
      overallStatus: "healthy",
      issueCode: "mock-mode",
      summary: "Mock mode is active, so the live bridge watchdog is paused.",
      recommendedAction: "Turn off mock mode when you are ready to test the real bridge.",
      bridgeReachable: false,
      robotReachable: true,
      autoRecoveryAvailable: false,
      autoRecoveryLikelyHelpful: false,
      connTimerEvents: 0,
      reconnectEvents: 0,
      recentEvidence: ["Mock mode is active."]
    }),
    getSettings: () => settings,
    updateSettings: (patch) => {
      settings = { ...settings, ...patch, mockMode: true };
      integrationInfo = {
        ...integrationInfo,
        wirePodBaseUrl: settings.savedWirePodEndpoint || settings.customWirePodEndpoint || "http://127.0.0.1:8080",
        bridgeBaseUrl: settings.savedWirePodEndpoint || settings.customWirePodEndpoint || "http://127.0.0.1:8080",
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
    deletePhoto: (photoId) => {
      const before = snapshots.length;
      snapshots = snapshots.filter((item) => item.id !== photoId && item.remoteId !== photoId);
      const deletedCount = before - snapshots.length;
      pushLog(
        makeLog(
          "photo-delete",
          { photoId },
          deletedCount ? "success" : "error",
          deletedCount ? "Mock photo removed." : "That photo could not be found."
        )
      );
      return {
        snapshots,
        latestSnapshot: snapshots[0],
        syncedCount: deletedCount,
        note: deletedCount ? "Mock photo removed." : "That photo could not be found."
      } satisfies CameraSyncResult;
    },
    getVoiceDiagnostics: () => createVoiceDiagnostics(robot),
    repairVoiceSetup: () =>
      pushLog(
        makeLog(
          "voice-repair",
          { wakeWordMode: "hey-vector", locale: "en-US", volume: robot.volume },
          "success",
          "Mock WirePod voice defaults refreshed for testing."
        )
      ),
    getWirePodSetupStatus: (): WirePodSetupStatusRecord => ({
      reachable: false,
      initialSetupComplete: false,
      sttProvider: "vosk",
      sttLanguage: "en-US",
      connectionMode: "escape-pod",
      port: "443",
      discoveredRobotCount: discoveredRobots.length,
      needsRobotPairing: false,
      recommendedNextStep: "Turn off mock mode when you are ready to set up the real local bridge."
    }),
    finishWirePodSetup: ({ language, connectionMode, port }): WirePodSetupStatusRecord => ({
      reachable: false,
      initialSetupComplete: true,
      sttProvider: "vosk",
      sttLanguage: language?.trim() || "en-US",
      connectionMode: connectionMode || "escape-pod",
      port: port?.trim() || "443",
      discoveredRobotCount: discoveredRobots.length,
      needsRobotPairing: false,
      recommendedNextStep: "Mock mode marked the local setup step as complete for UI testing."
    }),
    getWirePodWeatherConfig: () => wirePodWeatherConfig,
    setWirePodWeatherConfig: ({ provider, key, unit }) => {
      wirePodWeatherConfig = {
        enable: Boolean(provider.trim() && key.trim()),
        provider: provider.trim(),
        key: key.trim(),
        unit: unit?.trim()
      };
      return wirePodWeatherConfig;
    },
    quickRepair: (): RepairResultRecord => {
      const result: RepairResultRecord = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        overallStatus: "repaired",
        summary: "Mock quick repair refreshed the local test state.",
        steps: [
          {
            id: makeId(),
            label: "Mock mode",
            status: "success",
            details: "No live repair was needed while mock mode is active."
          }
        ]
      };
      pushLog(makeLog("quick-repair", { mode: "mock" }, "success", result.summary));
      return result;
    },
    getSupportReports: () => supportReports,
    getAiMemory: () => aiMemory,
    saveAiMemory: ({ key, value }) => {
      const now = new Date().toISOString();
      const existing = aiMemory.find((item) => item.key.toLowerCase() === key.trim().toLowerCase());

      if (existing) {
        aiMemory = aiMemory.map((item) =>
          item.key.toLowerCase() === key.trim().toLowerCase()
            ? { ...item, key: key.trim(), value: value.trim(), updatedAt: now }
            : item
        );
      } else {
        aiMemory = [
          {
            key: key.trim(),
            value: value.trim(),
            createdAt: now,
            updatedAt: now
          },
          ...aiMemory
        ].slice(0, 100);
      }

      return aiMemory;
    },
    getLearnedCommands: () => learnedCommands,
    saveLearnedCommand: ({ phrase, targetPrompt }) => {
      const nextLearnedCommands = upsertLearnedCommand(learnedCommands, phrase, targetPrompt);
      learnedCommands = nextLearnedCommands.commands;
      pushLog(
        makeLog(
          "learned-command-save",
          {
            phrase: nextLearnedCommands.record.phrase,
            targetPrompt: nextLearnedCommands.record.targetPrompt
          },
          "success",
          `Mock mode saved learned phrase ${nextLearnedCommands.record.phrase}.`
        )
      );
      return nextLearnedCommands.record;
    },
    deleteLearnedCommand: ({ phrase }) => {
      const nextLearnedCommands = deleteLearnedCommand(learnedCommands, phrase);
      learnedCommands = nextLearnedCommands.commands;
      if (nextLearnedCommands.record) {
        pushLog(
          makeLog(
            "learned-command-delete",
            {
              phrase: nextLearnedCommands.record.phrase
            },
            "success",
            `Mock mode forgot learned phrase ${nextLearnedCommands.record.phrase}.`
          )
        );
      }
      return nextLearnedCommands.record;
    },
    getCommandGaps: () => commandGaps,
    recordCommandGap: ({ source, prompt, normalizedPrompt, category, note, suggestedArea, heardAt, matchedIntent }) => {
      const record: CommandGapRecord = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        source,
        prompt,
        normalizedPrompt:
          normalizedPrompt ||
          prompt
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " "),
        category,
        note,
        suggestedArea,
        heardAt,
        matchedIntent
      };
      commandGaps = [record, ...commandGaps].slice(0, 120);
      return record;
    },
    reportProblem: ({ summary, details, contactEmail }) => {
      const repairResult: RepairResultRecord = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        overallStatus: "repaired",
        summary: "Mock repair completed before saving the problem report.",
        steps: [
          {
            id: makeId(),
            label: "Mock mode",
            status: "success",
            details: "The local mock stack was already healthy."
          }
        ]
      };
      const report: SupportReportRecord = {
        id: makeId(),
        createdAt: new Date().toISOString(),
        summary,
        details,
        contactEmail,
        robotName: robot.nickname ?? robot.name,
        integrationNote: integrationInfo.note,
        repairResult
      };
      supportReports = [report, ...supportReports].slice(0, 40);
      pushLog(makeLog("support-report", { summary }, "success", "Mock problem report saved locally."));
      return report;
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
