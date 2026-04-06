export type RobotConnectionSource = "mock" | "wirepod";
export type MaybePromise<T> = T | Promise<T>;
export type SystemStatus = "ready" | "charging" | "docked" | "busy" | "offline" | "error";
export type LiveUpdateMode = "polling";
export type ThemeMode = "dark" | "light";
export type ColorTheme = "vector" | "midnight" | "ice";
export type RoamBehavior = "patrol" | "explore" | "quiet";
export type RoamSessionStatus = "running" | "paused" | "completed";
export type AutomationStatus = "idle" | "running" | "paused";

export interface OptionalModuleRecord {
  enabled: boolean;
  description: string;
  features: string[];
  endpoints: string[];
}

export interface OptionalModulesRecord {
  [key: string]: OptionalModuleRecord;
  dashboard: OptionalModuleRecord;
  aiBrain: OptionalModuleRecord;
  wirepodExpansion: OptionalModuleRecord;
}

export interface OptionalFeatureListItemRecord {
  name: string;
  enabled: boolean;
  value: string;
}

export interface FeatureFlagsRecord {
  aiBrain: boolean;
  dashboard: boolean;
  wirepodExpansion: boolean;
  liveCamera: boolean;
  businessNotifications: boolean;
  memory: boolean;
  routines: boolean;
}

export interface AiMemoryRecord {
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface RobotStatus {
  id: string;
  name: string;
  nickname?: string;
  ipAddress: string;
  token: string;
  batteryPercent: number;
  isCharging: boolean;
  isConnected: boolean;
  isDocked: boolean;
  lastSeen: string;
  firmwareVersion: string;
  mood: string;
  connectionState: "connected" | "connecting" | "disconnected" | "error";
  wifiStrength: number;
  isMuted: boolean;
  volume: number;
  cameraAvailable: boolean;
  connectionSource: RobotConnectionSource;
  serial?: string;
  systemStatus: SystemStatus;
  currentActivity: string;
}

export interface DiscoveredRobot {
  id: string;
  serial: string;
  name: string;
  ipAddress: string;
  signalStrength: number;
  secure: boolean;
  activated: boolean;
  lastSeen: string;
}

export interface WirePodProbeResult {
  endpoint: string;
  source: "active" | "default" | "saved" | "custom";
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface WirePodWeatherConfigRecord {
  enable: boolean;
  provider: string;
  key: string;
  unit?: string;
}

export type WirePodConnectionMode = "escape-pod" | "ip" | "unknown";

export interface WirePodSetupStatusRecord {
  reachable: boolean;
  initialSetupComplete: boolean;
  sttProvider: string;
  sttLanguage: string;
  connectionMode: WirePodConnectionMode;
  port: string;
  discoveredRobotCount: number;
  needsRobotPairing: boolean;
  recommendedNextStep: string;
}

export interface RuntimeSettings {
  theme: ThemeMode;
  colorTheme: ColorTheme;
  autoDetectWirePod: boolean;
  customWirePodEndpoint: string;
  savedWirePodEndpoint: string;
  mockMode: boolean;
  reconnectOnStartup: boolean;
  pollingIntervalMs: number;
  liveUpdateMode: LiveUpdateMode;
  serial: string;
  userName?: string;
  weatherLocation?: string;
  preferredLanguage?: string;
  chatTarget?: string;
}

export interface RobotIntegrationInfo {
  source: RobotConnectionSource;
  wirePodReachable: boolean;
  wirePodBaseUrl: string;
  selectedSerial?: string;
  note?: string;
  robotReachable: boolean;
  mockMode: boolean;
  autoDetectEnabled: boolean;
  reconnectOnStartup: boolean;
  customEndpoint?: string;
  lastCheckedAt?: string;
  probes: WirePodProbeResult[];
}

export interface CameraSnapshotRecord {
  id: string;
  remoteId?: string;
  createdAt: string;
  label: string;
  dataUrl: string;
  motionScore: number;
  source: RobotConnectionSource;
}

export interface CameraSyncResult {
  snapshots: CameraSnapshotRecord[];
  latestSnapshot?: CameraSnapshotRecord;
  syncedCount: number;
  note: string;
}

export interface CameraImageAsset {
  contentType: string;
  buffer: Uint8Array;
}

export interface RoamEventRecord {
  id: string;
  createdAt: string;
  type: "movement" | "vision" | "battery" | "dock" | "status";
  message: string;
  batteryPercent: number;
  dataPointsCollected: number;
}

export interface RoamSessionRecord {
  id: string;
  name: string;
  status: RoamSessionStatus;
  behavior: RoamBehavior;
  targetArea: string;
  startedAt: string;
  endedAt?: string;
  distanceMeters: number;
  commandsIssued: number;
  snapshotsTaken: number;
  dataPointsCollected: number;
  batteryStart: number;
  batteryEnd?: number;
  summary: string;
  events: RoamEventRecord[];
}

export interface AutomationControlRecord {
  status: AutomationStatus;
  activeSessionId?: string;
  behavior: RoamBehavior;
  targetArea: string;
  safeReturnEnabled: boolean;
  captureSnapshots: boolean;
  dataCollectionEnabled: boolean;
  autoDockThreshold: number;
  startedAt?: string;
  lastHeartbeatAt?: string;
}

export interface RoutineRecord {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  triggerValue: string;
  conditions: string[];
  actions: Array<{ type: string; value: string }>;
  delayMs: number;
  repeat: string;
  lastRunAt?: string;
}

export interface CommandLogRecord {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: "success" | "error" | "queued";
  createdAt: string;
  resultMessage: string;
}

export interface ParsedAiAction {
  id: string;
  type:
    | "speak"
    | "drive"
    | "stop"
    | "dock"
    | "wake"
    | "volume"
    | "animation"
    | "status"
    | "roam"
    | "assistant"
    | "photo";
  label: string;
  params: Record<string, unknown>;
}

export interface ParsedAiCommand {
  id: string;
  prompt: string;
  summary: string;
  source: "rules" | "openai";
  warnings: string[];
  canExecute: boolean;
  actions: ParsedAiAction[];
}

export interface DiagnosticCheckRecord {
  id: string;
  label: string;
  category: "network" | "power" | "motion" | "vision" | "audio" | "storage";
  status: "pass" | "warn" | "fail";
  metric: string;
  details: string;
}

export interface DiagnosticReportRecord {
  id: string;
  createdAt: string;
  overallStatus: "healthy" | "attention" | "critical";
  summary: string;
  robotName: string;
  checks: DiagnosticCheckRecord[];
  troubleshooting: string[];
}

export interface VoiceDiagnosticsRecord {
  wakeWordMode: "hey-vector" | "alexa" | "unknown";
  locale: string;
  volume: number;
  lastIntent?: string;
  lastTranscription?: string;
  lastHeardAt?: string;
  status: "healthy" | "attention" | "critical";
  summary: string;
  troubleshooting: string[];
}

export interface RepairStepRecord {
  id: string;
  label: string;
  status: "success" | "warn" | "fail";
  details: string;
}

export interface RepairResultRecord {
  id: string;
  createdAt: string;
  overallStatus: "repaired" | "partial" | "failed";
  summary: string;
  steps: RepairStepRecord[];
}

export interface SupportReportRecord {
  id: string;
  createdAt: string;
  summary: string;
  details: string;
  contactEmail?: string;
  robotName: string;
  integrationNote?: string;
  repairResult: RepairResultRecord;
}

export interface CommandGapRecord {
  id: string;
  createdAt: string;
  source: "ai" | "voice";
  prompt: string;
  normalizedPrompt: string;
  category: "unsupported" | "missing-integration" | "unmatched" | "no-audio";
  note: string;
  suggestedArea?: string;
  heardAt?: string;
  matchedIntent?: string;
}

export interface RobotController {
  getStatus: () => MaybePromise<RobotStatus>;
  getIntegrationInfo: () => MaybePromise<RobotIntegrationInfo>;
  getSettings: () => MaybePromise<RuntimeSettings>;
  updateSettings: (patch: Partial<RuntimeSettings>) => MaybePromise<RuntimeSettings>;
  discoverRobots: () => MaybePromise<DiscoveredRobot[]>;
  connect: (payload?: Partial<RobotStatus>) => MaybePromise<RobotStatus>;
  disconnect: () => MaybePromise<RobotStatus>;
  drive: (payload: { direction: string; speed: number; durationMs?: number }) => MaybePromise<CommandLogRecord>;
  head: (payload: { angle: number }) => MaybePromise<CommandLogRecord>;
  lift: (payload: { height: number }) => MaybePromise<CommandLogRecord>;
  speak: (payload: { text: string }) => MaybePromise<CommandLogRecord>;
  animation: (payload: { animationId: string }) => MaybePromise<CommandLogRecord>;
  dock: () => MaybePromise<CommandLogRecord>;
  wake: () => MaybePromise<CommandLogRecord>;
  toggleMute: (payload: { isMuted: boolean }) => MaybePromise<CommandLogRecord>;
  setVolume: (payload: { volume: number }) => MaybePromise<CommandLogRecord>;
  runDiagnostics: () => MaybePromise<DiagnosticReportRecord>;
  getSnapshots: () => MaybePromise<CameraSnapshotRecord[]>;
  syncPhotos: () => MaybePromise<CameraSyncResult>;
  capturePhoto: () => MaybePromise<CameraSyncResult>;
  getCameraStreamUrl: () => MaybePromise<string | undefined>;
  getPhotoImage: (photoId: string, variant?: "full" | "thumb") => MaybePromise<CameraImageAsset>;
  deletePhoto: (photoId: string) => MaybePromise<CameraSyncResult>;
  getVoiceDiagnostics: () => MaybePromise<VoiceDiagnosticsRecord>;
  repairVoiceSetup: () => MaybePromise<CommandLogRecord>;
  getWirePodWeatherConfig: () => MaybePromise<WirePodWeatherConfigRecord>;
  setWirePodWeatherConfig: (payload: {
    provider: string;
    key: string;
    unit?: string;
  }) => MaybePromise<WirePodWeatherConfigRecord>;
  getWirePodSetupStatus: () => MaybePromise<WirePodSetupStatusRecord>;
  finishWirePodSetup: (payload: {
    language?: string;
    connectionMode?: Exclude<WirePodConnectionMode, "unknown">;
    port?: string;
  }) => MaybePromise<WirePodSetupStatusRecord>;
  quickRepair: () => MaybePromise<RepairResultRecord>;
  getSupportReports: () => MaybePromise<SupportReportRecord[]>;
  getAiMemory: () => MaybePromise<AiMemoryRecord[]>;
  saveAiMemory: (payload: { key: string; value: string }) => MaybePromise<AiMemoryRecord[]>;
  getCommandGaps: () => MaybePromise<CommandGapRecord[]>;
  recordCommandGap: (payload: {
    source: CommandGapRecord["source"];
    prompt: string;
    normalizedPrompt?: string;
    category: CommandGapRecord["category"];
    note: string;
    suggestedArea?: string;
    heardAt?: string;
    matchedIntent?: string;
  }) => MaybePromise<CommandGapRecord>;
  reportProblem: (payload: {
    summary: string;
    details: string;
    contactEmail?: string;
  }) => MaybePromise<SupportReportRecord>;
  getAutomationControl: () => MaybePromise<AutomationControlRecord>;
  getRoamSessions: () => MaybePromise<RoamSessionRecord[]>;
  startRoam: (automation: AutomationControlRecord) => MaybePromise<RoamSessionRecord>;
  pauseRoam: () => MaybePromise<RoamSessionRecord>;
  resumeRoam: () => MaybePromise<RoamSessionRecord>;
  stopRoam: () => MaybePromise<RoamSessionRecord>;
  getRoutines: () => MaybePromise<RoutineRecord[]>;
  saveRoutine: (routine: RoutineRecord) => MaybePromise<RoutineRecord>;
  updateRoutine: (routineId: string, patch: Partial<RoutineRecord>) => MaybePromise<RoutineRecord | undefined>;
  deleteRoutine: (routineId: string) => MaybePromise<boolean>;
  getLogs: () => MaybePromise<CommandLogRecord[]>;
}
