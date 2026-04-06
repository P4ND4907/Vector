import type {
  AiCommandHistoryItem,
  AnimationItem,
  AutomationControl,
  AppSnapshot,
  CameraSnapshot,
  DiagnosticReport,
  IntegrationStatus,
  NotificationItem,
  OptionalModules,
  PairingCandidate,
  Robot,
  RoamSession,
  Routine,
  SavedPhrase,
  SupportReport,
  VisionEvent
} from "@/types";
import { animationCatalog } from "@/lib/animation-catalog";
import { buildFeatureFlags, buildOptionalFeatureList } from "@/lib/optional-features";

const buildSnapshotDataUrl = (label: string, accent: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#061226" />
        <stop offset="100%" stop-color="${accent}" />
      </linearGradient>
    </defs>
    <rect width="640" height="360" rx="28" fill="url(#bg)" />
    <circle cx="320" cy="182" r="108" fill="rgba(255,255,255,0.1)" />
    <rect x="182" y="112" width="276" height="160" rx="58" fill="rgba(10,17,31,0.72)" stroke="#7af8ea" stroke-width="8" />
    <circle cx="268" cy="186" r="28" fill="#d8fcff" />
    <circle cx="372" cy="186" r="28" fill="#d8fcff" />
    <text x="50%" y="320" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, sans-serif" font-size="24">${label}</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const now = new Date();

const robot: Robot = {
  id: "vector-01",
  serial: "MOCK-0001",
  name: "Vector Prime",
  nickname: "Scout",
  ipAddress: "192.168.0.18",
  token: "mock-vector-token",
  lastSeen: new Date(now.getTime() - 90_000).toISOString(),
  batteryPercent: 78,
  isCharging: false,
  isConnected: true,
  isDocked: false,
  firmwareVersion: "2.4.1-local",
  connectionState: "connected",
  mood: "playful",
  wifiStrength: 88,
  isMuted: false,
  volume: 3,
  cameraAvailable: true,
  connectionSource: "mock",
  systemStatus: "ready",
  currentActivity: "Mock mode is active."
};

const integration: IntegrationStatus = {
  source: "mock",
  wirePodReachable: false,
  wirePodBaseUrl: "http://127.0.0.1:8080",
  selectedSerial: robot.serial,
  note: "Mock mode is active. Connect to WirePod later without changing the UI.",
  robotReachable: true,
  mockMode: true,
  autoDetectEnabled: true,
  reconnectOnStartup: true,
  customEndpoint: "",
  lastCheckedAt: new Date(now.getTime() - 60_000).toISOString(),
  probes: [
    {
      endpoint: "http://127.0.0.1:8080",
      source: "default",
      ok: false,
      error: "Mock mode bypassed WirePod detection."
    }
  ]
};

const availableRobots: PairingCandidate[] = [
  {
    id: "candidate-01",
    serial: "MOCK-0001",
    name: "Vector Prime",
    ipAddress: "192.168.0.18",
    signalStrength: 88,
    secure: true,
    lastSeen: new Date(now.getTime() - 25_000).toISOString()
  },
  {
    id: "candidate-02",
    serial: "MOCK-0002",
    name: "Workshop Vector",
    ipAddress: "192.168.0.44",
    signalStrength: 64,
    secure: true,
    lastSeen: new Date(now.getTime() - 110_000).toISOString()
  }
];

const animations: AnimationItem[] = animationCatalog;

const savedPhrases: SavedPhrase[] = [
  { id: "phrase-1", label: "Morning", text: "Good morning. Systems are green and ready." },
  { id: "phrase-2", label: "Reminder", text: "Friendly reminder: take a stretch break and drink some water." },
  { id: "phrase-3", label: "Dock", text: "Returning to charger now." }
];

const routines: Routine[] = [
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
    lastRunAt: new Date(now.getTime() - 86_400_000).toISOString(),
    nextRunAt: new Date(now.getTime() + 28_800_000).toISOString()
  },
  {
    id: "routine-2",
    name: "Low Battery Dock",
    enabled: true,
    triggerType: "battery-low",
    triggerValue: "< 20%",
    conditions: ["If not already charging"],
    actions: [{ type: "dock", value: "return-to-charger" }],
    delayMs: 2000,
    repeat: "once",
    lastRunAt: new Date(now.getTime() - 172_800_000).toISOString()
  }
];

const notifications: NotificationItem[] = [
  {
    id: "notification-1",
    title: "Charging complete",
    description: "Vector Prime reached 100% and is ready to leave the dock.",
    level: "success",
    createdAt: new Date(now.getTime() - 7_200_000).toISOString(),
    read: false,
    channel: "push"
  },
  {
    id: "notification-2",
    title: "Routine finished",
    description: "Morning Greeting played with no issues.",
    level: "info",
    createdAt: new Date(now.getTime() - 25_200_000).toISOString(),
    read: true,
    channel: "system"
  }
];

const snapshots: CameraSnapshot[] = [
  {
    id: "shot-1",
    createdAt: new Date(now.getTime() - 1_800_000).toISOString(),
    label: "Desk patrol",
    dataUrl: buildSnapshotDataUrl("Desk patrol", "#12397a"),
    motionScore: 42
  },
  {
    id: "shot-2",
    createdAt: new Date(now.getTime() - 7_200_000).toISOString(),
    label: "Dock check",
    dataUrl: buildSnapshotDataUrl("Dock check", "#67411f"),
    motionScore: 18
  }
];

const visionEvents: VisionEvent[] = [
  {
    id: "vision-1",
    label: "Motion detected near charging dock",
    createdAt: new Date(now.getTime() - 950_000).toISOString(),
    confidence: 0.73
  },
  {
    id: "vision-2",
    label: "Face detection placeholder ready",
    createdAt: new Date(now.getTime() - 4_400_000).toISOString(),
    confidence: 0.52
  }
];

const diagnosticReports: DiagnosticReport[] = [
  {
    id: "diag-1",
    createdAt: new Date(now.getTime() - 5_400_000).toISOString(),
    overallStatus: "healthy",
    summary: "Core systems look stable with one mild storage warning for cached media growth.",
    robotName: robot.name,
    checks: [
      {
        id: "diag-1-network",
        label: "Local network",
        category: "network",
        status: "pass",
        metric: "14 ms average latency",
        details: "Robot responded cleanly across three mock heartbeat probes."
      },
      {
        id: "diag-1-power",
        label: "Battery health",
        category: "power",
        status: "pass",
        metric: "Battery normal",
        details: "Battery state is within the expected idle roaming envelope."
      },
      {
        id: "diag-1-storage",
        label: "Local data storage",
        category: "storage",
        status: "warn",
        metric: "84 MB cached",
        details: "Snapshot history is growing. Consider pruning old images during the next maintenance pass."
      },
      {
        id: "diag-1-vision",
        label: "Camera and vision",
        category: "vision",
        status: "pass",
        metric: "2 recent detections",
        details: "Camera feed and event markers are responding in mock mode."
      }
    ],
    troubleshooting: [
      "Mock mode is active, so diagnostics are simulated.",
      "Turn mock mode off in Settings to talk to a real WirePod instance."
    ]
  }
];

const roamSessions: RoamSession[] = [
  {
    id: "roam-1",
    name: "Studio patrol",
    status: "completed",
    behavior: "patrol",
    targetArea: "Desk and charger loop",
    startedAt: new Date(now.getTime() - 12_600_000).toISOString(),
    endedAt: new Date(now.getTime() - 11_700_000).toISOString(),
    distanceMeters: 18.4,
    commandsIssued: 29,
    snapshotsTaken: 2,
    dataPointsCollected: 56,
    batteryStart: 96,
    batteryEnd: 82,
    summary: "Completed a calm patrol and returned with a full motion log.",
    events: [
      {
        id: "roam-1-event-1",
        createdAt: new Date(now.getTime() - 12_300_000).toISOString(),
        type: "movement",
        message: "Patrol route started near the dock and moved toward the desk edge.",
        batteryPercent: 94,
        dataPointsCollected: 18
      },
      {
        id: "roam-1-event-2",
        createdAt: new Date(now.getTime() - 12_000_000).toISOString(),
        type: "vision",
        message: "Captured a motion marker near the keyboard lane.",
        batteryPercent: 89,
        dataPointsCollected: 26
      },
      {
        id: "roam-1-event-3",
        createdAt: new Date(now.getTime() - 11_760_000).toISOString(),
        type: "dock",
        message: "Session wrapped and robot returned close to the charger lane.",
        batteryPercent: 82,
        dataPointsCollected: 56
      }
    ]
  }
];

const automationControl: AutomationControl = {
  status: "idle",
  behavior: "patrol",
  targetArea: "Desk perimeter",
  safeReturnEnabled: true,
  captureSnapshots: true,
  dataCollectionEnabled: true,
  autoDockThreshold: 24
};

const aiCommandHistory: AiCommandHistoryItem[] = [
  {
    id: "ai-1",
    prompt: "say hello",
    summary: 'Speak "hello"',
    status: "success",
    createdAt: new Date(now.getTime() - 3_000_000).toISOString(),
    resultMessage: "Speaking: \"hello\""
  }
];

const supportReports: SupportReport[] = [];

const optionalModules: OptionalModules = {
  dashboard: {
    enabled: true,
    description: "Main control center UI",
    features: [
      "battery_status",
      "movement_joystick",
      "command_history",
      "routine_builder",
      "camera_panel_optional"
    ],
    endpoints: ["/robot/status", "/robot/move", "/robot/dock", "/robot/stop"]
  },
  wirepodExpansion: {
    enabled: true,
    description: "Custom app endpoints layered on top of WirePod",
    features: [
      "routine_start",
      "business_notify",
      "ai_chat",
      "automation_trigger",
      "status_broadcast"
    ],
    endpoints: ["/routine/start", "/business/notify", "/ai/chat", "/automation/trigger"]
  },
  aiBrain: {
    enabled: true,
    description: "Chat, memory, and context-aware responses",
    features: [
      "chat_responses",
      "user_memory",
      "conversation_context",
      "fallback_to_basic_commands"
    ],
    endpoints: ["/ai/chat", "/ai/memory/save", "/ai/memory/get"]
  }
};

export const initialSnapshot: AppSnapshot = {
  robot,
  integration,
  optionalModules,
  optionalFeatureList: buildOptionalFeatureList(optionalModules),
  featureFlags: buildFeatureFlags(optionalModules),
  savedProfiles: [
    {
      id: robot.id,
      serial: robot.serial,
      name: robot.name,
      ipAddress: robot.ipAddress,
      token: robot.token,
      autoReconnect: true,
      lastPairedAt: new Date(now.getTime() - 172_800_000).toISOString()
    }
  ],
  routines,
  logs: [
    {
      id: "log-1",
      type: "connect",
      payload: { ipAddress: robot.ipAddress },
      status: "success",
      createdAt: new Date(now.getTime() - 3_600_000).toISOString(),
      resultMessage: "Connected to Vector Prime in mock mode."
    },
    {
      id: "log-2",
      type: "animation",
      payload: { animation: "happy-hello" },
      status: "success",
      createdAt: new Date(now.getTime() - 3_000_000).toISOString(),
      resultMessage: "Played Happy Hello animation."
    }
  ],
  notifications,
  animations,
  savedPhrases,
  snapshots,
  visionEvents,
  diagnosticReports,
  roamSessions,
  automationControl,
  availableRobots,
  supportReports,
  queuedAnimations: ["curious-peek"],
  driveState: {
    speed: 55,
    precisionMode: false,
    headAngle: 12,
    liftHeight: 24
  },
  settings: {
    theme: "dark",
    colorTheme: "vector",
    appBackendUrl: "",
    advancedMode: false,
    autoReconnect: true,
    startupBehavior: "connect",
    developerMode: false,
    networkTimeoutMs: 4500,
    cloudSyncEnabled: false,
    notificationsEnabled: true,
    volume: 3,
    robotNickname: "Scout",
    autoDetectWirePod: true,
    customWirePodEndpoint: "",
    savedWirePodEndpoint: "",
    mockMode: true,
    reconnectOnStartup: true,
    protectChargingUntilFull: true,
    pollingIntervalMs: 6000,
    liveUpdateMode: "polling",
    robotSerial: robot.serial ?? ""
  },
  aiCommandHistory
};

export const cloneSnapshot = () => JSON.parse(JSON.stringify(initialSnapshot)) as AppSnapshot;
export const buildCameraFrame = buildSnapshotDataUrl;
