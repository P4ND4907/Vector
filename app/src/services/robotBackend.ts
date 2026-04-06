import type {
  AiCommandPreview,
  AppSettings,
  AppSnapshot,
  CameraSnapshot,
  DiagnosticReport,
  DiagnosticsSnapshot,
  FeatureFlags,
  IntegrationStatus,
  OptionalFeatureListItem,
  OptionalModules,
  PairRobotInput,
  RepairResult,
  PairingCandidate,
  Robot,
  RobotProfile,
  Routine,
  SupportReport
} from "@/types";

export interface ServerRobot {
  id: string;
  serial?: string;
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
  mood: Robot["mood"];
  connectionState?: Robot["connectionState"];
  wifiStrength?: number;
  isMuted?: boolean;
  volume?: number;
  cameraAvailable?: boolean;
  connectionSource?: Robot["connectionSource"];
  systemStatus?: Robot["systemStatus"];
  currentActivity?: string;
}

export interface ServerDiscoveredRobot {
  id: string;
  serial?: string;
  name: string;
  ipAddress: string;
  signalStrength: number;
  secure: boolean;
  activated?: boolean;
  lastSeen: string;
}

export interface ServerLog {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: "success" | "error" | "queued";
  createdAt: string;
  resultMessage: string;
}

export interface ServerCameraSnapshot {
  id: string;
  remoteId?: string;
  createdAt: string;
  label: string;
  dataUrl: string;
  motionScore: number;
  source?: CameraSnapshot["source"];
}

export interface ServerRoutine {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: Routine["triggerType"];
  triggerValue: string;
  conditions: string[];
  actions: Routine["actions"];
  delayMs: number;
  repeat: Routine["repeat"];
  lastRunAt?: string;
}

export interface ServerSettings {
  theme: AppSettings["theme"];
  colorTheme: AppSettings["colorTheme"];
  autoDetectWirePod: boolean;
  customWirePodEndpoint: string;
  savedWirePodEndpoint: string;
  mockMode: boolean;
  reconnectOnStartup: boolean;
  pollingIntervalMs: number;
  liveUpdateMode: AppSettings["liveUpdateMode"];
  serial: string;
}

export interface ServerIntegration {
  source: IntegrationStatus["source"];
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
  probes: IntegrationStatus["probes"];
}

export interface ServerDiagnosticsSnapshot {
  robot: ServerRobot;
  integration: ServerIntegration;
  logs: ServerLog[];
  latestSuccessfulCommand?: ServerLog;
  latestFailedCommand?: ServerLog;
  troubleshooting: string[];
}

export interface ServerRepairStep {
  id: string;
  label: string;
  status: RepairResult["steps"][number]["status"];
  details: string;
}

export interface ServerRepairResult {
  id: string;
  createdAt: string;
  overallStatus: RepairResult["overallStatus"];
  summary: string;
  steps: ServerRepairStep[];
}

export interface ServerSupportReport {
  id: string;
  createdAt: string;
  summary: string;
  details: string;
  contactEmail?: string;
  robotName: string;
  integrationNote?: string;
  repairResult: ServerRepairResult;
}

export interface ServerBootstrapResponse {
  robot: ServerRobot;
  integration: ServerIntegration;
  optionalModules?: OptionalModules;
  optionalFeatureList?: OptionalFeatureListItem[];
  featureFlags?: FeatureFlags;
  settings: ServerSettings;
  routines: ServerRoutine[];
  logs: ServerLog[];
  robots: ServerDiscoveredRobot[];
  snapshots: ServerCameraSnapshot[];
  supportReports: ServerSupportReport[];
}

const normalizeVolume = (value: number | undefined, fallback: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  if (value > 5) {
    return Math.max(0, Math.min(5, Math.round(value / 20)));
  }

  return Math.max(0, Math.min(5, Math.round(value)));
};

export const mapRobot = (robot: ServerRobot, fallback?: Robot): Robot => ({
  id: robot.id || fallback?.id || crypto.randomUUID(),
  serial: robot.serial ?? fallback?.serial,
  name: robot.name || fallback?.name || "Vector",
  nickname: robot.nickname ?? fallback?.nickname,
  ipAddress: robot.ipAddress || fallback?.ipAddress || "Unavailable",
  token: robot.token || fallback?.token || "wirepod-managed",
  lastSeen: robot.lastSeen || fallback?.lastSeen || new Date().toISOString(),
  batteryPercent: robot.batteryPercent ?? fallback?.batteryPercent ?? 0,
  isCharging: robot.isCharging ?? fallback?.isCharging ?? false,
  isConnected: robot.isConnected ?? fallback?.isConnected ?? false,
  isDocked: robot.isDocked ?? fallback?.isDocked ?? false,
  firmwareVersion: robot.firmwareVersion || fallback?.firmwareVersion || "WirePod local",
  connectionState: robot.connectionState ?? fallback?.connectionState ?? (robot.isConnected ? "connected" : "error"),
  mood: robot.mood ?? fallback?.mood ?? "ready",
  wifiStrength: robot.wifiStrength ?? fallback?.wifiStrength ?? (robot.isConnected ? 100 : 0),
  isMuted: robot.isMuted ?? fallback?.isMuted ?? false,
  volume: normalizeVolume(robot.volume, fallback?.volume ?? 3),
  cameraAvailable: robot.cameraAvailable ?? fallback?.cameraAvailable ?? false,
  connectionSource: robot.connectionSource ?? fallback?.connectionSource ?? "mock",
  systemStatus: robot.systemStatus ?? fallback?.systemStatus ?? (robot.isConnected ? "ready" : "offline"),
  currentActivity: robot.currentActivity ?? fallback?.currentActivity ?? "Awaiting your next command."
});

export const mapSettings = (settings: ServerSettings, fallback: AppSettings): AppSettings => ({
  ...fallback,
  theme: settings.theme ?? fallback.theme,
  colorTheme: settings.colorTheme ?? fallback.colorTheme,
  autoReconnect: settings.reconnectOnStartup,
  autoDetectWirePod: settings.autoDetectWirePod,
  customWirePodEndpoint: settings.customWirePodEndpoint,
  savedWirePodEndpoint: settings.savedWirePodEndpoint,
  mockMode: settings.mockMode,
  reconnectOnStartup: settings.reconnectOnStartup,
  pollingIntervalMs: settings.pollingIntervalMs,
  liveUpdateMode: settings.liveUpdateMode,
  robotSerial: settings.serial
});

export const mapIntegration = (
  integration: ServerIntegration,
  fallback?: IntegrationStatus
): IntegrationStatus => ({
  source: integration.source ?? fallback?.source ?? "wirepod",
  wirePodReachable: integration.wirePodReachable ?? fallback?.wirePodReachable ?? false,
  wirePodBaseUrl: integration.wirePodBaseUrl || fallback?.wirePodBaseUrl || "http://127.0.0.1:8080",
  selectedSerial: integration.selectedSerial ?? fallback?.selectedSerial,
  note: integration.note ?? fallback?.note,
  robotReachable: integration.robotReachable ?? fallback?.robotReachable ?? false,
  mockMode: integration.mockMode ?? fallback?.mockMode ?? false,
  autoDetectEnabled: integration.autoDetectEnabled ?? fallback?.autoDetectEnabled ?? true,
  reconnectOnStartup: integration.reconnectOnStartup ?? fallback?.reconnectOnStartup ?? true,
  customEndpoint: integration.customEndpoint ?? fallback?.customEndpoint ?? "",
  lastCheckedAt: integration.lastCheckedAt ?? fallback?.lastCheckedAt ?? new Date().toISOString(),
  probes: Array.isArray(integration.probes) ? integration.probes : fallback?.probes ?? []
});

export const buildProfile = (input: PairRobotInput, robot: Robot): RobotProfile => ({
  id: robot.id,
  serial: input.serial?.trim() || robot.serial,
  name: input.name.trim() || robot.nickname || robot.name,
  ipAddress: input.ipAddress.trim() || robot.ipAddress,
  token: input.token.trim() || robot.token,
  autoReconnect: input.autoReconnect,
  lastPairedAt: new Date().toISOString()
});

export const mapRoutine = (routine: ServerRoutine): Routine => ({
  id: routine.id,
  name: routine.name,
  enabled: routine.enabled,
  triggerType: routine.triggerType,
  triggerValue: routine.triggerValue,
  conditions: routine.conditions,
  actions: routine.actions,
  delayMs: routine.delayMs,
  repeat: routine.repeat,
  lastRunAt: routine.lastRunAt
});

export const mapAvailableRobot = (robot: ServerDiscoveredRobot): PairingCandidate => ({
  id: robot.id,
  serial: robot.serial,
  name: robot.name,
  ipAddress: robot.ipAddress,
  signalStrength: robot.signalStrength,
  secure: robot.secure,
  lastSeen: robot.lastSeen
});

export const mapCameraSnapshot = (snapshot: ServerCameraSnapshot): CameraSnapshot => ({
  id: snapshot.id,
  remoteId: snapshot.remoteId,
  createdAt: snapshot.createdAt,
  label: snapshot.label,
  dataUrl: snapshot.dataUrl,
  motionScore: snapshot.motionScore,
  source: snapshot.source ?? "wirepod"
});

export const mapDiagnosticReport = (report: DiagnosticReport): DiagnosticReport => ({
  ...report,
  troubleshooting: Array.isArray(report.troubleshooting) ? report.troubleshooting : []
});

export const mapRepairResult = (repair: ServerRepairResult): RepairResult => ({
  ...repair,
  steps: Array.isArray(repair.steps) ? repair.steps : []
});

export const mapSupportReport = (report: ServerSupportReport): SupportReport => ({
  ...report,
  repairResult: mapRepairResult(report.repairResult)
});

export const mapDiagnosticsSnapshot = (
  snapshot: ServerDiagnosticsSnapshot,
  fallback: AppSnapshot
): DiagnosticsSnapshot => ({
  robot: mapRobot(snapshot.robot, fallback.robot),
  integration: mapIntegration(snapshot.integration, fallback.integration),
  logs: snapshot.logs,
  latestSuccessfulCommand: snapshot.latestSuccessfulCommand,
  latestFailedCommand: snapshot.latestFailedCommand,
  troubleshooting: Array.isArray(snapshot.troubleshooting) ? snapshot.troubleshooting : []
});

export const mapAiCommandPreview = (preview: AiCommandPreview): AiCommandPreview => ({
  ...preview,
  warnings: Array.isArray(preview.warnings) ? preview.warnings : [],
  actions: Array.isArray(preview.actions) ? preview.actions : []
});
