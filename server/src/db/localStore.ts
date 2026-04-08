import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  AiMemoryRecord,
  AutomationControlRecord,
  CameraSnapshotRecord,
  CommandGapRecord,
  CommandLogRecord,
  LearnedCommandRecord,
  SupportReportRecord,
  RobotStatus,
  RoamSessionRecord,
  RoutineRecord,
  RuntimeSettings
} from "../robot/types.js";
import { sanitizeRobotSerial } from "../robot/serials.js";
import { sanitizeLearnedCommands } from "../services/learnedCommandsService.js";

interface PersistedRobotProfile {
  aliases: Record<string, string>;
  selectedSerial: string;
  token: string;
}

export interface PersistedState {
  aiMemory: AiMemoryRecord[];
  automationControl: AutomationControlRecord;
  commandGaps: CommandGapRecord[];
  learnedCommands: LearnedCommandRecord[];
  logs: CommandLogRecord[];
  robotProfile: PersistedRobotProfile;
  roamSessions: RoamSessionRecord[];
  routines: RoutineRecord[];
  snapshots: CameraSnapshotRecord[];
  supportReports: SupportReportRecord[];
  settings: RuntimeSettings;
}

const defaultSettings = (): RuntimeSettings => ({
  theme: "dark",
  colorTheme: "vector",
  autoDetectWirePod: true,
  customWirePodEndpoint: "",
  savedWirePodEndpoint: "",
  mockMode: false,
  reconnectOnStartup: true,
  protectChargingUntilFull: true,
  pollingIntervalMs: 6000,
  liveUpdateMode: "polling",
  serial: "",
  weatherLocation: "Anchorage, Alaska"
});

const defaultState = (): PersistedState => ({
  aiMemory: [],
  automationControl: {
    status: "idle",
    behavior: "patrol",
    targetArea: "Desk perimeter",
    safeReturnEnabled: true,
    captureSnapshots: true,
    dataCollectionEnabled: true,
    autoDockThreshold: 24
  },
  commandGaps: [],
  learnedCommands: [],
  settings: defaultSettings(),
  routines: [],
  logs: [],
  roamSessions: [],
  snapshots: [],
  supportReports: [],
  robotProfile: {
    aliases: {},
    selectedSerial: "",
    token: "wirepod-managed"
  }
});

export const createLocalStore = (filePath: string) => {
  const resolvedPath = path.resolve(filePath);

  const ensureFile = () => {
    const directory = path.dirname(resolvedPath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
    if (!existsSync(resolvedPath)) {
      writeFileSync(resolvedPath, JSON.stringify(defaultState(), null, 2), "utf8");
    }
  };

  const readState = (): PersistedState => {
    ensureFile();
    try {
      const raw = JSON.parse(readFileSync(resolvedPath, "utf8")) as Partial<PersistedState>;
      return {
        ...defaultState(),
        ...raw,
        aiMemory: Array.isArray(raw.aiMemory) ? raw.aiMemory.slice(0, 100) : [],
        automationControl: {
          ...defaultState().automationControl,
          ...(raw.automationControl ?? {})
        },
        commandGaps: Array.isArray(raw.commandGaps) ? raw.commandGaps.slice(0, 120) : [],
        learnedCommands: sanitizeLearnedCommands(raw.learnedCommands),
        settings: {
          ...defaultSettings(),
          ...(raw.settings ?? {}),
          serial: sanitizeRobotSerial(raw.settings?.serial) ?? ""
        },
        routines: Array.isArray(raw.routines) ? raw.routines : [],
        logs: Array.isArray(raw.logs) ? raw.logs.slice(0, 200) : [],
        roamSessions: Array.isArray(raw.roamSessions) ? raw.roamSessions.slice(0, 24) : [],
        snapshots: Array.isArray(raw.snapshots) ? raw.snapshots.slice(0, 24) : [],
        supportReports: Array.isArray(raw.supportReports) ? raw.supportReports.slice(0, 40) : [],
        robotProfile: {
          ...defaultState().robotProfile,
          ...(raw.robotProfile ?? {}),
          selectedSerial: sanitizeRobotSerial(raw.robotProfile?.selectedSerial) ?? ""
        }
      };
    } catch {
      return defaultState();
    }
  };

  const writeState = (state: PersistedState) => {
    ensureFile();
    writeFileSync(resolvedPath, JSON.stringify(state, null, 2), "utf8");
  };

  let state = readState();

  return {
    getState: () => state,
    replaceState: (nextState: PersistedState) => {
      state = nextState;
      writeState(state);
      return state;
    },
    update: (updater: (current: PersistedState) => PersistedState) => {
      state = updater(state);
      writeState(state);
      return state;
    },
    saveRobotProfile: (patch: Partial<PersistedRobotProfile>) =>
      state = (() => {
        const nextState = {
          ...state,
          robotProfile: {
            ...state.robotProfile,
            ...patch,
            selectedSerial:
              patch.selectedSerial === undefined
                ? state.robotProfile.selectedSerial
                : sanitizeRobotSerial(patch.selectedSerial) ?? "",
            aliases: {
              ...state.robotProfile.aliases,
              ...(patch.aliases ?? {})
            }
          }
        };
        writeState(nextState);
        return nextState;
      })(),
    saveSettings: (patch: Partial<RuntimeSettings>) =>
      state = (() => {
        const nextState = {
          ...state,
          settings: {
            ...state.settings,
            ...patch,
            serial:
              patch.serial === undefined ? state.settings.serial : sanitizeRobotSerial(patch.serial) ?? ""
          }
        };
        writeState(nextState);
        return nextState;
      })(),
    saveAutomationControl: (patch: Partial<AutomationControlRecord>) =>
      state = (() => {
        const nextState = {
          ...state,
          automationControl: {
            ...state.automationControl,
            ...patch
          }
        };
        writeState(nextState);
        return nextState;
      })(),
    saveAiMemory: (aiMemory: AiMemoryRecord[]) =>
      state = (() => {
        const nextState = {
          ...state,
          aiMemory: aiMemory.slice(0, 100)
        };
        writeState(nextState);
        return nextState;
      })(),
    saveLearnedCommands: (learnedCommands: LearnedCommandRecord[]) =>
      state = (() => {
        const nextState = {
          ...state,
          learnedCommands: learnedCommands.slice(0, 120)
        };
        writeState(nextState);
        return nextState;
      })(),
    appendLog: (log: CommandLogRecord) =>
      state = (() => {
        const nextState = {
          ...state,
          logs: [log, ...state.logs].slice(0, 200)
        };
        writeState(nextState);
        return nextState;
      })(),
    saveRoutines: (routines: RoutineRecord[]) =>
      state = (() => {
        const nextState = {
          ...state,
          routines
        };
        writeState(nextState);
        return nextState;
      })(),
    saveRoamSessions: (roamSessions: RoamSessionRecord[]) =>
      state = (() => {
        const nextState = {
          ...state,
          roamSessions: roamSessions.slice(0, 24)
        };
        writeState(nextState);
        return nextState;
      })(),
    saveSnapshots: (snapshots: CameraSnapshotRecord[]) =>
      state = (() => {
        const nextState = {
          ...state,
          snapshots: snapshots.slice(0, 24)
        };
        writeState(nextState);
        return nextState;
      })(),
    saveSupportReports: (supportReports: SupportReportRecord[]) =>
      state = (() => {
        const nextState = {
          ...state,
          supportReports: supportReports.slice(0, 40)
        };
        writeState(nextState);
        return nextState;
      })(),
    saveCommandGaps: (commandGaps: CommandGapRecord[]) =>
      state = (() => {
        const nextState = {
          ...state,
          commandGaps: commandGaps.slice(0, 120)
        };
        writeState(nextState);
        return nextState;
      })()
  };
};

export const buildOfflineRobot = (
  profile: {
    aliases?: Record<string, string>;
    selectedSerial?: string;
    token?: string;
  },
  message = "Local bridge offline",
  source: RobotStatus["connectionSource"] = "wirepod"
): RobotStatus => {
  const serial = sanitizeRobotSerial(profile.selectedSerial);
  const alias = serial ? profile.aliases?.[serial] : undefined;

  return {
    id: serial ? `vector-${serial}` : "vector-offline",
    serial,
    name: alias || "Vector",
    nickname: alias,
    ipAddress: "Unavailable",
    token: profile.token || "wirepod-managed",
    batteryPercent: 0,
    isCharging: false,
    isConnected: false,
    isDocked: false,
    lastSeen: new Date().toISOString(),
    firmwareVersion: "WirePod unavailable",
    mood: "sleepy",
    connectionState: "error",
    wifiStrength: 0,
    isMuted: false,
    volume: 3,
    cameraAvailable: false,
    connectionSource: source,
    systemStatus: "offline",
    currentActivity: message
  };
};
