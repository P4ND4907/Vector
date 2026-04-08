export type ConnectionState = "connected" | "connecting" | "disconnected" | "error";
export type RobotConnectionSource = "mock" | "wirepod";
export type LocalBridgeProvider = "wirepod";
export type RobotMood = "ready" | "curious" | "playful" | "charging" | "sleepy" | "focused";
export type NotificationLevel = "info" | "success" | "warning";
export type TriggerType = "schedule" | "interval" | "battery-low" | "disconnect" | "manual";
export type RepeatType = "once" | "hourly" | "daily" | "custom";
export type RoutineActionType = "speak" | "animation" | "dock" | "mute" | "notify" | "stop";
export type ThemeMode = "dark" | "light";
export type ColorTheme = "vector" | "midnight" | "ice";
export type StartupBehavior = "dashboard" | "last-screen" | "connect";
export type ActionStatus = "idle" | "loading" | "success" | "error";
export type DiagnosticCheckStatus = "pass" | "warn" | "fail";
export type DiagnosticOverallStatus = "healthy" | "attention" | "critical";
export type DiagnosticCategory = "network" | "power" | "motion" | "vision" | "audio" | "storage";
export type RoamBehavior = "patrol" | "explore" | "quiet";
export type RoamSessionStatus = "running" | "paused" | "completed";
export type AutomationStatus = "idle" | "running" | "paused";
export type SystemStatus = "ready" | "charging" | "docked" | "busy" | "offline" | "error";
export type LiveUpdateMode = "polling";
export type MonetizationPlanId = "free" | "pro" | "setup" | "studio";
export type MonetizationAccessTier = Extract<MonetizationPlanId, "free" | "pro">;

export interface OptionalModule {
  enabled: boolean;
  description: string;
  features: string[];
  endpoints: string[];
}

export interface OptionalModules {
  [key: string]: OptionalModule;
  dashboard: OptionalModule;
  aiBrain: OptionalModule;
  wirepodExpansion: OptionalModule;
}

export interface OptionalFeatureListItem {
  name: string;
  enabled: boolean;
  value: string;
}

export interface FeatureFlags {
  aiBrain: boolean;
  dashboard: boolean;
  wirepodExpansion: boolean;
  liveCamera: boolean;
  businessNotifications: boolean;
  memory: boolean;
  routines: boolean;
}

export interface RobotProfile {
  id: string;
  serial?: string;
  name: string;
  ipAddress: string;
  token: string;
  autoReconnect: boolean;
  lastPairedAt: string;
}

export interface Robot {
  id: string;
  serial?: string;
  name: string;
  nickname?: string;
  ipAddress: string;
  token: string;
  lastSeen: string;
  batteryPercent: number;
  isCharging: boolean;
  isConnected: boolean;
  isDocked: boolean;
  firmwareVersion: string;
  connectionState: ConnectionState;
  mood: RobotMood;
  wifiStrength: number;
  isMuted: boolean;
  volume: number;
  cameraAvailable: boolean;
  connectionSource?: RobotConnectionSource;
  systemStatus: SystemStatus;
  currentActivity: string;
}

export interface WirePodProbe {
  endpoint: string;
  source: "active" | "default" | "saved" | "custom";
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export type LocalBridgeProbe = WirePodProbe;

export type ManagedBridgeSource = "bundled" | "external" | "none";

export interface ManagedBridgeStatus {
  source: ManagedBridgeSource;
  available: boolean;
  running: boolean;
  endpoint: string;
  note: string;
  launchPath?: string;
}

export interface WirePodWeatherConfig {
  enable: boolean;
  provider: string;
  key: string;
  unit?: string;
}

export type LocalBridgeWeatherConfig = WirePodWeatherConfig;

export type WirePodConnectionMode = "escape-pod" | "ip" | "unknown";
export type LocalBridgeConnectionMode = WirePodConnectionMode;

export interface WirePodSetupStatus {
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

export type LocalBridgeSetupStatus = WirePodSetupStatus;

export interface MobileBackendTarget {
  label: string;
  url: string;
  kind: "localhost" | "lan";
}

export type BluetoothDiscoveryConfidence = "likely" | "possible" | "unknown";

export interface BluetoothDiscoveryStatus {
  supported: boolean;
  platform: "android" | "ios" | "web" | "unknown";
  bluetoothEnabled: boolean;
  locationEnabled: boolean | null;
  ready: boolean;
  note: string;
}

export interface BluetoothDiscoveryCandidate {
  id: string;
  deviceId: string;
  name: string;
  localName?: string;
  rssi?: number;
  bonded: boolean;
  confidence: BluetoothDiscoveryConfidence;
  note: string;
}

export interface BluetoothScanSnapshot {
  devices: BluetoothDiscoveryCandidate[];
  totalDetected: number;
  likelyCount: number;
  scannedAt: string;
  note: string;
}

export interface IntegrationStatus {
  source: RobotConnectionSource;
  wirePodReachable: boolean;
  wirePodBaseUrl: string;
  bridgeProvider?: LocalBridgeProvider;
  bridgeLabel?: string;
  bridgeReachable?: boolean;
  bridgeBaseUrl?: string;
  managedBridge: ManagedBridgeStatus;
  selectedSerial?: string;
  note?: string;
  robotReachable: boolean;
  mockMode: boolean;
  autoDetectEnabled: boolean;
  reconnectOnStartup: boolean;
  customEndpoint?: string;
  lastCheckedAt?: string;
  probes: WirePodProbe[];
}

export interface DriveState {
  speed: number;
  precisionMode: boolean;
  headAngle: number;
  liftHeight: number;
}

export interface RoutineAction {
  type: RoutineActionType;
  value: string;
}

export interface Routine {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: TriggerType;
  triggerValue: string;
  conditions: string[];
  actions: RoutineAction[];
  delayMs: number;
  repeat: RepeatType;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface CommandLog {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: "success" | "error" | "queued";
  createdAt: string;
  resultMessage: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  level: NotificationLevel;
  createdAt: string;
  read: boolean;
  channel: "push" | "robot" | "system";
}

export interface AnimationItem {
  id: string;
  name: string;
  category: "happy" | "curious" | "greeting" | "idle" | "silly" | "celebration" | "sleepy";
  favorite: boolean;
  durationMs: number;
}

export interface SavedPhrase {
  id: string;
  label: string;
  text: string;
}

export interface CameraSnapshot {
  id: string;
  remoteId?: string;
  createdAt: string;
  label: string;
  dataUrl: string;
  motionScore: number;
  source?: RobotConnectionSource;
}

export interface CameraSyncResult {
  snapshots: CameraSnapshot[];
  latestSnapshot?: CameraSnapshot;
  syncedCount: number;
  note?: string;
}

export interface VisionEvent {
  id: string;
  label: string;
  createdAt: string;
  confidence: number;
}

export interface DiagnosticCheck {
  id: string;
  label: string;
  category: DiagnosticCategory;
  status: DiagnosticCheckStatus;
  metric: string;
  details: string;
}

export interface DiagnosticReport {
  id: string;
  createdAt: string;
  overallStatus: DiagnosticOverallStatus;
  summary: string;
  robotName: string;
  checks: DiagnosticCheck[];
  troubleshooting: string[];
}

export interface DiagnosticsSnapshot {
  robot: Robot;
  integration: IntegrationStatus;
  logs: CommandLog[];
  latestSuccessfulCommand?: CommandLog;
  latestFailedCommand?: CommandLog;
  troubleshooting: string[];
  bridgeWatchdog?: BridgeWatchdogStatus;
}

export interface VoiceDiagnostics {
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

export interface BridgeWatchdogStatus {
  observedAt: string;
  overallStatus: "healthy" | "attention" | "critical";
  issueCode:
    | "mock-mode"
    | "bridge-offline"
    | "sdk-session-timeout"
    | "robot-routes-quiet"
    | "reconnect-loop"
    | "stable";
  summary: string;
  recommendedAction: string;
  bridgeReachable: boolean;
  robotReachable: boolean;
  autoRecoveryAvailable: boolean;
  autoRecoveryLikelyHelpful: boolean;
  connTimerEvents: number;
  reconnectEvents: number;
  recentEvidence: string[];
}

export interface RepairStep {
  id: string;
  label: string;
  status: "success" | "warn" | "fail";
  details: string;
}

export interface RepairResult {
  id: string;
  createdAt: string;
  overallStatus: "repaired" | "partial" | "failed";
  summary: string;
  steps: RepairStep[];
}

export interface SupportReport {
  id: string;
  createdAt: string;
  summary: string;
  details: string;
  contactEmail?: string;
  robotName: string;
  integrationNote?: string;
  repairResult: RepairResult;
}

export interface CommandGap {
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

export interface SupportBundle {
  generatedAt: string;
  diagnosticsSnapshot: DiagnosticsSnapshot;
  voiceDiagnostics: VoiceDiagnostics;
  supportReports: SupportReport[];
  commandGaps: CommandGap[];
  settings: AppSettings;
  bridgeWatchdog?: BridgeWatchdogStatus;
}

export interface RoamEvent {
  id: string;
  createdAt: string;
  type: "movement" | "vision" | "battery" | "dock" | "status";
  message: string;
  batteryPercent: number;
  dataPointsCollected: number;
}

export interface RoamSession {
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
  events: RoamEvent[];
}

export interface AutomationControl {
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

export interface PairingCandidate {
  id: string;
  serial?: string;
  name: string;
  ipAddress: string;
  signalStrength: number;
  secure: boolean;
  lastSeen: string;
}

export interface AppSettings {
  theme: ThemeMode;
  colorTheme: ColorTheme;
  appBackendUrl: string;
  planAccess: MonetizationAccessTier;
  advancedMode: boolean;
  autoReconnect: boolean;
  startupBehavior: StartupBehavior;
  developerMode: boolean;
  networkTimeoutMs: number;
  cloudSyncEnabled: boolean;
  notificationsEnabled: boolean;
  volume: number;
  robotNickname: string;
  autoDetectWirePod: boolean;
  customWirePodEndpoint: string;
  savedWirePodEndpoint: string;
  mockMode: boolean;
  reconnectOnStartup: boolean;
  protectChargingUntilFull: boolean;
  pollingIntervalMs: number;
  liveUpdateMode: LiveUpdateMode;
  robotSerial: string;
}

export interface AiCommandAction {
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

export interface AiCommandPreview {
  id: string;
  prompt: string;
  summary: string;
  source: "rules" | "openai";
  warnings: string[];
  canExecute: boolean;
  actions: AiCommandAction[];
}

export interface AiCommandHistoryItem {
  id: string;
  prompt: string;
  summary: string;
  status: "success" | "error";
  createdAt: string;
  resultMessage: string;
}

export interface LearnedCommand {
  phrase: string;
  normalizedPhrase: string;
  targetPrompt: string;
  normalizedTargetPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export type VectorCommandCatalogCategory =
  | "classic"
  | "community"
  | "control"
  | "assistant";

export type VectorCommandCatalogStatus = "live" | "partial";

export type VectorCommandCatalogSurface =
  | "face"
  | "voice"
  | "motion"
  | "camera"
  | "app"
  | "memory";

export interface VectorCommandCatalogItem {
  key: string;
  title: string;
  category: VectorCommandCatalogCategory;
  status: VectorCommandCatalogStatus;
  summary: string;
  aliases: string[];
  samplePrompt: string;
  surfaces: VectorCommandCatalogSurface[];
  note?: string;
}

export interface ActionFeedback {
  status: ActionStatus;
  message?: string;
  updatedAt?: string;
}

export interface AppSnapshot {
  robot: Robot;
  integration: IntegrationStatus;
  optionalModules: OptionalModules;
  optionalFeatureList: OptionalFeatureListItem[];
  featureFlags: FeatureFlags;
  savedProfiles: RobotProfile[];
  routines: Routine[];
  logs: CommandLog[];
  notifications: NotificationItem[];
  animations: AnimationItem[];
  savedPhrases: SavedPhrase[];
  snapshots: CameraSnapshot[];
  visionEvents: VisionEvent[];
  diagnosticReports: DiagnosticReport[];
  roamSessions: RoamSession[];
  automationControl: AutomationControl;
  availableRobots: PairingCandidate[];
  supportReports: SupportReport[];
  queuedAnimations: string[];
  driveState: DriveState;
  settings: AppSettings;
  aiCommandHistory: AiCommandHistoryItem[];
}

export interface PairRobotInput {
  name: string;
  ipAddress: string;
  token: string;
  autoReconnect: boolean;
  serial?: string;
}

export interface RobotCommandResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
}

export interface ToastItem {
  id: string;
  title: string;
  description: string;
  level: NotificationLevel;
}

export type MonetizationPlanStatus = "live" | "needs-config" | "coming-soon";
export type MonetizationPlanCadence = "free" | "monthly" | "one-time" | "custom";

export interface MonetizationPlan {
  id: MonetizationPlanId;
  name: string;
  priceLabel: string;
  cadence: MonetizationPlanCadence;
  summary: string;
  highlights: string[];
  status: MonetizationPlanStatus;
  ctaLabel?: string;
  checkoutUrl?: string;
  desktopWebOnly?: boolean;
  note?: string;
}

export interface MonetizationStatus {
  desktopCheckoutReady: boolean;
  supportEmailConfigured: boolean;
  androidPlayBillingReady: boolean;
  hostedAdsReady: boolean;
  checkoutLockedToDesktop: boolean;
}

export interface MonetizationOverview {
  headline: string;
  summary: string;
  supportEmail?: string;
  plans: MonetizationPlan[];
  freeKeepsPeople: string[];
  proReasons: string[];
  retentionHooks: string[];
  nextMoves: string[];
  status: MonetizationStatus;
}
