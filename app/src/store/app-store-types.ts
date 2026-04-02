import type {
  ActionFeedback,
  AiCommandHistoryItem,
  AppSettings,
  AppSnapshot,
  AutomationControl,
  PairRobotInput,
  Routine,
  ToastItem
} from "@/types";

export type DriveDirection = "forward" | "reverse" | "left" | "right" | "stop";

export interface AppState extends AppSnapshot {
  initialized: boolean;
  telemetryActive: boolean;
  actionStates: Record<string, ActionFeedback>;
  toasts: ToastItem[];
  initialize: () => Promise<void>;
  dismissToast: (toastId: string) => void;
  scanForRobots: () => Promise<void>;
  pairRobot: (input: PairRobotInput) => Promise<void>;
  connectRobot: () => Promise<void>;
  disconnectRobot: () => Promise<void>;
  driveRobot: (direction: DriveDirection) => Promise<void>;
  moveHead: (angle: number) => Promise<void>;
  moveLift: (height: number) => Promise<void>;
  wakeRobot: () => Promise<void>;
  setRobotVolume: (volume: number) => Promise<void>;
  setSpeed: (speed: number) => void;
  togglePrecisionMode: () => void;
  speakText: (text: string) => Promise<void>;
  playAnimation: (animationId: string) => Promise<void>;
  queueAnimation: (animationId: string) => void;
  playQueuedAnimations: () => Promise<void>;
  playRandomAnimation: () => Promise<void>;
  runDiagnostics: () => Promise<void>;
  updateAutomationControl: (patch: Partial<AutomationControl>) => void;
  startRoam: () => Promise<void>;
  pauseRoam: () => Promise<void>;
  resumeRoam: () => Promise<void>;
  stopRoam: () => Promise<void>;
  returnToDock: () => Promise<void>;
  toggleMute: () => Promise<void>;
  takeSnapshot: () => Promise<void>;
  saveRoutine: (routine: Routine) => Promise<void>;
  removeRoutine: (routineId: string) => Promise<void>;
  toggleRoutine: (routineId: string) => void;
  runRoutineNow: (routineId: string) => Promise<void>;
  addReminder: (title: string, description: string) => void;
  markNotificationRead: (notificationId: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  recordAiCommandHistory: (item: AiCommandHistoryItem) => void;
  clearLogs: () => void;
  exportState: () => string;
  importState: (value: Partial<AppSnapshot>) => void;
}

export type PersistedSlice = Partial<
  Pick<
    AppState,
    | "robot"
    | "integration"
    | "savedProfiles"
    | "routines"
    | "logs"
    | "notifications"
    | "diagnosticReports"
    | "roamSessions"
    | "automationControl"
    | "queuedAnimations"
    | "driveState"
    | "settings"
    | "aiCommandHistory"
    | "animations"
    | "savedPhrases"
    | "snapshots"
    | "visionEvents"
    | "availableRobots"
  >
>;

export type AppStateUpdate = Partial<AppState> | ((state: AppState) => Partial<AppState>);
export type AppStoreSet = (updater: AppStateUpdate) => void;
export type AppStoreGet = () => AppState;
