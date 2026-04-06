import { cloneSnapshot } from "@/services/mockData";
import { mockRobotService } from "@/services/mockRobotService";
import {
  deleteJson,
  getJson,
  isNetworkError,
  patchJson,
  postJson
} from "@/services/apiClient";
import {
  mobileRuntimeNeedsManualBackendUrl,
  persistAppBackendUrl
} from "@/lib/runtime-target";
import {
  buildProfile,
  mapCameraSnapshot,
  mapAvailableRobot,
  mapDiagnosticReport,
  mapDiagnosticsSnapshot,
  mapIntegration,
  mapRepairResult,
  mapRobot,
  mapRoutine,
  mapSettings,
  mapSupportReport,
  type ServerBootstrapResponse,
  type ServerCameraSnapshot,
  type ServerDiagnosticsSnapshot,
  type ServerDiscoveredRobot,
  type ServerIntegration,
  type ServerLog,
  type ServerRepairResult,
  type ServerRobot,
  type ServerRoutine,
  type ServerSettings,
  type ServerSupportReport
} from "@/services/robotBackend";
import { CHARGING_PROTECTION_RELEASE_PERCENT } from "@/lib/charging-protection";
import { buildFeatureFlags, buildOptionalFeatureList } from "@/lib/optional-features";
import type {
  AnimationItem,
  AppSettings,
  AppSnapshot,
  CameraSnapshot,
  CameraSyncResult,
  DiagnosticReport,
  DiagnosticsSnapshot,
  IntegrationStatus,
  MobileBackendTarget,
  PairRobotInput,
  RepairResult,
  Robot,
  RobotCommandResult,
  RobotProfile,
  Routine,
  SupportReport,
  WirePodConnectionMode,
  WirePodSetupStatus,
  WirePodWeatherConfig
} from "@/types";

interface ActionApiResponse {
  log: ServerLog;
  robot?: ServerRobot;
  integration?: ServerIntegration;
}

interface SettingsApiResponse {
  settings: ServerSettings;
  integration: ServerIntegration;
}

interface WirePodWeatherApiResponse {
  weather: WirePodWeatherConfig;
}

interface WirePodSetupApiResponse {
  setup: WirePodSetupStatus;
}

interface MobileBackendTargetsApiResponse {
  targets: MobileBackendTarget[];
}

interface StatusApiResponse {
  robot: ServerRobot;
  integration: ServerIntegration;
}

interface DiscoveryApiResponse {
  robots: ServerDiscoveredRobot[];
  integration: ServerIntegration;
}

interface DiagnosticsRunResponse {
  report: DiagnosticReport;
  snapshot: ServerDiagnosticsSnapshot;
}

interface QuickRepairApiResponse {
  repair: ServerRepairResult;
  snapshot: ServerDiagnosticsSnapshot;
}

interface SupportReportApiResponse {
  report: ServerSupportReport;
  reports: ServerSupportReport[];
  snapshot: ServerDiagnosticsSnapshot;
}

interface VoiceRepairApiResponse {
  log: ServerLog;
  robot: ServerRobot;
  integration: ServerIntegration;
}

interface CameraSyncApiResponse {
  snapshots: ServerCameraSnapshot[];
  latestSnapshot?: ServerCameraSnapshot;
  syncedCount: number;
  note?: string;
  streamUrl?: string;
}

interface RobotEnvelope {
  robot: Robot;
  integration: IntegrationStatus;
}

let telemetryPausedUntil = 0;
const AUTO_RECONNECT_COOLDOWN_MS = 15_000;
const WIREPOD_SETUP_CACHE_MS = 4_000;
const SUPPORT_ACTION_TIMEOUT_MS = 30_000;
const WIREPOD_SETUP_TIMEOUT_MS = 20_000;
const MIN_POLLING_INTERVAL_MS = 1_000;
const FAST_DOCKED_POLLING_INTERVAL_MS = 1_500;
let wirePodSetupCache: { value: WirePodSetupStatus; expiresAt: number } | null = null;

const clearWirePodSetupCache = () => {
  wirePodSetupCache = null;
};

export const pauseTelemetry = (durationMs: number) => {
  telemetryPausedUntil = Math.max(telemetryPausedUntil, Date.now() + Math.max(0, durationMs));
};

interface SettingsEnvelope {
  settings: AppSettings;
  integration: IntegrationStatus;
  robot?: Robot;
}

const buildReconnectPayload = (
  robot: Robot,
  integration: IntegrationStatus,
  settings: AppSettings
) => ({
  serial: robot.serial || settings.robotSerial || integration.selectedSerial,
  name: robot.nickname || robot.name,
  nickname: robot.nickname,
  ipAddress: robot.ipAddress,
  token: robot.token
});

const shouldAttemptReconnect = (
  context: { robot: Robot; integration: IntegrationStatus; settings: AppSettings },
  reconnectInFlight: boolean,
  lastReconnectAttemptAt: number
) => {
  if (reconnectInFlight || context.settings.mockMode || !context.settings.reconnectOnStartup) {
    return false;
  }

  if (!context.integration.wirePodReachable) {
    return false;
  }

  if (
    context.settings.protectChargingUntilFull &&
    context.robot.isDocked &&
    context.robot.batteryPercent < CHARGING_PROTECTION_RELEASE_PERCENT
  ) {
    return false;
  }

  if (!context.robot.serial && !context.settings.robotSerial && !context.integration.selectedSerial) {
    return false;
  }

  if (context.robot.isConnected && context.integration.robotReachable) {
    return false;
  }

  return Date.now() - lastReconnectAttemptAt >= AUTO_RECONNECT_COOLDOWN_MS;
};

const shouldUseFallback = (error: unknown) => isNetworkError(error);

const shouldApplyMobileLocalOnlySettings = (patch: Partial<AppSettings>) => {
  if (!mobileRuntimeNeedsManualBackendUrl()) {
    return false;
  }

  const localOnlyKeys: Array<keyof AppSettings> = [
    "appBackendUrl",
    "mockMode",
    "theme",
    "colorTheme"
  ];

  const patchKeys = Object.keys(patch) as Array<keyof AppSettings>;
  return patchKeys.length > 0 && patchKeys.every((key) => localOnlyKeys.includes(key));
};

const getStoredMockMode = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem("vector-control-hub-store");
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as { state?: { settings?: { mockMode?: boolean } } };
    return Boolean(parsed.state?.settings?.mockMode);
  } catch {
    return false;
  }
};

const useApiOrFallback = async <T,>(apiCall: () => Promise<T>, fallbackCall: () => Promise<T>) => {
  try {
    return await apiCall();
  } catch (error) {
    if (!shouldUseFallback(error) || !getStoredMockMode()) {
      throw error;
    }
    return fallbackCall();
  }
};

const buildBootstrapSnapshot = (fallback: AppSnapshot, response: ServerBootstrapResponse): AppSnapshot => {
  const robot = mapRobot(response.robot, fallback.robot);
  const integration = mapIntegration(response.integration, fallback.integration);
  const settings = mapSettings(response.settings, {
    ...fallback.settings,
    robotNickname: robot.nickname ?? fallback.settings.robotNickname
  });
  const resolvedOptionalModules = response.optionalModules ?? fallback.optionalModules;
  const resolvedFeatureFlags =
    response.featureFlags ?? buildFeatureFlags(resolvedOptionalModules);
  const resolvedOptionalFeatureList =
    response.optionalFeatureList ?? buildOptionalFeatureList(resolvedOptionalModules);
  const savedProfile: RobotProfile = {
    id: robot.id,
    serial: robot.serial,
    name: robot.nickname || robot.name,
    ipAddress: robot.ipAddress,
    token: robot.token,
    autoReconnect: settings.reconnectOnStartup,
    lastPairedAt: new Date().toISOString()
  };

  return {
    ...fallback,
    robot: {
      ...robot,
      nickname: settings.robotNickname || robot.nickname || robot.name
    },
    integration,
    optionalModules: resolvedOptionalModules,
    optionalFeatureList: resolvedOptionalFeatureList,
    featureFlags: resolvedFeatureFlags,
    settings,
    routines: response.routines.map(mapRoutine),
    logs: response.logs,
    snapshots: response.snapshots.map(mapCameraSnapshot),
    availableRobots: response.robots.map(mapAvailableRobot),
    supportReports: Array.isArray(response.supportReports) ? response.supportReports.map(mapSupportReport) : [],
    savedProfiles: [
      savedProfile,
      ...fallback.savedProfiles.filter((profile) =>
        savedProfile.serial && profile.serial
          ? profile.serial !== savedProfile.serial
          : profile.id !== savedProfile.id
      )
    ].slice(0, 5)
  };
};

const connectPayload = (
  robot: Robot,
  settings?: AppSettings,
  integration?: IntegrationStatus
) => ({
  serial: robot.serial || settings?.robotSerial || integration?.selectedSerial,
  name: robot.nickname || robot.name,
  nickname: robot.nickname,
  ipAddress: robot.ipAddress,
  token: robot.token
});

const mapRobotEnvelope = (
  response: { robot: ServerRobot; integration: ServerIntegration },
  fallbackRobot: Robot,
  fallbackIntegration: IntegrationStatus
): RobotEnvelope => ({
  robot: mapRobot(response.robot, fallbackRobot),
  integration: mapIntegration(response.integration, fallbackIntegration)
});

const mapActionResult = (
  response: ActionApiResponse,
  fallbackRobot: Robot,
  fallbackIntegration: IntegrationStatus
) => ({
  message: response.log.resultMessage,
  robot: response.robot ? mapRobot(response.robot, fallbackRobot) : fallbackRobot,
  integration: response.integration
    ? mapIntegration(response.integration, fallbackIntegration)
    : fallbackIntegration
});

const buildOfflineWirePodState = (
  robot: Robot,
  integration: IntegrationStatus,
  note = "Vector brain offline"
): RobotEnvelope => ({
  robot: {
    ...robot,
    isConnected: false,
    isCharging: robot.isCharging,
    isDocked: robot.isDocked,
    connectionState: "error",
    firmwareVersion: robot.firmwareVersion || "WirePod unavailable",
    wifiStrength: 0,
    mood: robot.isCharging ? "charging" : "sleepy",
    systemStatus: robot.isCharging ? "charging" : robot.isDocked ? "docked" : "offline",
    currentActivity: robot.isCharging
      ? "Charging safely while the local brain is offline."
      : "Vector brain offline",
    lastSeen: robot.lastSeen || new Date().toISOString(),
    connectionSource: "wirepod"
  },
  integration: {
    ...integration,
    source: "wirepod",
    mockMode: false,
    wirePodReachable: false,
    robotReachable: false,
    note,
    lastCheckedAt: new Date().toISOString()
  }
});

const buildLocalSettingsTransition = ({
  patch,
  currentSettings,
  currentIntegration,
  currentRobot,
  normalizedBackendUrl
}: {
  patch: Partial<AppSettings>;
  currentSettings: AppSettings;
  currentIntegration: IntegrationStatus;
  currentRobot?: Robot;
  normalizedBackendUrl: string;
}): Pick<SettingsEnvelope, "integration" | "robot"> | null => {
  if (patch.mockMode === undefined) {
    return null;
  }

  if (patch.mockMode) {
    const mockSnapshot = cloneSnapshot();
    return {
      integration: {
        ...mockSnapshot.integration,
        selectedSerial:
          currentIntegration.selectedSerial ||
          currentSettings.robotSerial ||
          currentRobot?.serial ||
          mockSnapshot.integration.selectedSerial,
        note: "Mock mode is active."
      },
      robot: currentRobot
        ? {
            ...mockSnapshot.robot,
            serial: currentSettings.robotSerial || currentRobot.serial || mockSnapshot.robot.serial,
            nickname:
              currentSettings.robotNickname ||
              currentRobot.nickname ||
              mockSnapshot.robot.nickname ||
              mockSnapshot.robot.name,
            name: currentRobot.name || mockSnapshot.robot.name
          }
        : undefined
    };
  }

  const needsBackendTarget = mobileRuntimeNeedsManualBackendUrl() && normalizedBackendUrl.length === 0;

  return {
    integration: {
      ...currentIntegration,
      source: "wirepod",
      mockMode: false,
      wirePodReachable: needsBackendTarget ? false : currentIntegration.wirePodReachable,
      robotReachable: false,
      note: needsBackendTarget ? "Save the desktop backend URL in Settings first." : "Vector brain offline",
      lastCheckedAt: new Date().toISOString()
    },
    robot: currentRobot
      ? {
          ...currentRobot,
          isConnected: false,
          connectionState: "error",
          connectionSource: "wirepod",
          systemStatus:
            currentRobot.isDocked
              ? currentRobot.isCharging
                ? "charging"
                : "docked"
              : "offline",
          currentActivity: needsBackendTarget
            ? "Waiting for the desktop backend URL."
            : "Vector brain offline",
          lastSeen: currentRobot.lastSeen || new Date().toISOString()
        }
      : undefined
  };
};

export const robotService = {
  async bootstrap(): Promise<AppSnapshot> {
    return useApiOrFallback(
      async () => {
        const response = await getJson<ServerBootstrapResponse>(
          "/api/app/bootstrap",
          "Vector bootstrap data is unavailable."
        );
        return buildBootstrapSnapshot(cloneSnapshot(), response);
      },
      () => mockRobotService.bootstrap()
    );
  },

  async scanNetwork() {
    return useApiOrFallback(
      async () => {
        const response = await getJson<DiscoveryApiResponse>(
          "/api/robot/discover",
          "Robot discovery failed."
        );
        return {
          robots: response.robots.map(mapAvailableRobot),
          integration: mapIntegration(response.integration, cloneSnapshot().integration)
        };
      },
      async () => ({
        robots: await mockRobotService.scanNetwork(),
        integration: cloneSnapshot().integration
      })
    );
  },

  async pairRobot(input: PairRobotInput): Promise<
    RobotCommandResult<{ profile: RobotProfile; robot: Robot; integration: IntegrationStatus }>
  > {
    return useApiOrFallback(
      async () => {
        const response = await postJson<StatusApiResponse>(
          "/api/robot/connect",
          input,
          "Robot pairing failed."
        );
        const fallback = cloneSnapshot();
        const robot = mapRobot(response.robot, fallback.robot);
        const integration = mapIntegration(response.integration, fallback.integration);
        const profile = buildProfile(input, robot);

        return {
          ok: true,
          message:
            integration.source === "wirepod"
              ? `Saved ${profile.name} and linked it to ${integration.wirePodBaseUrl}.`
              : `Saved ${profile.name} locally.`,
          data: { profile, robot, integration }
        };
      },
      async () => {
        const result = await mockRobotService.pairRobot(input);
        if (!result.data) {
          throw new Error("Mock pairing did not return a robot profile.");
        }
        return {
          ...result,
          data: {
            ...result.data,
            integration: cloneSnapshot().integration
          }
        };
      }
    );
  },

  async connect(
    robot: Robot,
    integration: IntegrationStatus,
    settings?: AppSettings
  ): Promise<RobotCommandResult<RobotEnvelope>> {
    return useApiOrFallback(
      async () => {
        const response = await postJson<StatusApiResponse>(
          "/api/robot/connect",
          connectPayload(robot, settings, integration),
          "Robot connection failed."
        );
        const data = mapRobotEnvelope(response, robot, integration);

        return {
          ok: true,
          message: data.robot.isConnected
            ? `${data.robot.nickname ?? data.robot.name} is online and ready.`
            : data.integration.note || "Vector brain offline",
          data
        };
      },
      async () => {
        const result = await mockRobotService.connect(robot);
        return {
          ...result,
          data: result.data
            ? {
                robot: result.data,
                integration: cloneSnapshot().integration
              }
            : undefined
        };
      }
    );
  },

  async disconnect(robot: Robot, integration: IntegrationStatus): Promise<RobotCommandResult<RobotEnvelope>> {
    return useApiOrFallback(
      async () => {
        const response = await postJson<StatusApiResponse>(
          "/api/robot/disconnect",
          undefined,
          "Robot disconnect failed."
        );
        return {
          ok: true,
          message: `${robot.nickname ?? robot.name} disconnected safely.`,
          data: mapRobotEnvelope(response, robot, integration)
        };
      },
      async () => {
        const result = await mockRobotService.disconnect(robot);
        return {
          ...result,
          data: result.data
            ? {
                robot: result.data,
                integration: cloneSnapshot().integration
              }
            : undefined
        };
      }
    );
  },

  async sendDriveCommand(
    direction: string,
    speed: number,
    precisionMode: boolean,
    context?: { robot: Robot; integration: IntegrationStatus; durationMs?: number }
  ) {
    const defaultDurationMs =
      direction === "stop"
        ? 0
        : context?.durationMs ??
          (precisionMode ? 425 : direction === "forward" || direction === "reverse" ? 700 : 520);
    const payload = {
      direction,
      speed: direction === "stop" ? 0 : precisionMode ? Math.min(speed, 35) : speed,
      durationMs: defaultDurationMs
    };

    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<ActionApiResponse>(
          "/api/robot/drive",
          payload,
          "Drive command failed."
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const result = await mockRobotService.sendDriveCommand(direction, speed, precisionMode);
        return {
          message: result.message,
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async setHead(angle: number, context?: { robot: Robot; integration: IntegrationStatus }) {
    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<ActionApiResponse>(
          "/api/robot/head",
          { angle },
          "Head command failed."
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const result = await mockRobotService.setHead(angle);
        return {
          message: result.message,
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async setLift(height: number, context?: { robot: Robot; integration: IntegrationStatus }) {
    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<ActionApiResponse>(
          "/api/robot/lift",
          { height },
          "Lift command failed."
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const result = await mockRobotService.setLift(height);
        return {
          message: result.message,
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async speak(text: string, context?: { robot: Robot; integration: IntegrationStatus }) {
    pauseTelemetry(12_000);
    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<ActionApiResponse>(
          "/api/robot/speak",
          { text },
          "Speech command failed."
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const result = await mockRobotService.speak(text);
        return {
          message: result.message,
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async playAnimation(animation: AnimationItem, context?: { robot: Robot; integration: IntegrationStatus }) {
    pauseTelemetry(7_000);
    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<ActionApiResponse>(
          "/api/robot/animation",
          { animationId: animation.id },
          "Animation command failed."
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const result = await mockRobotService.playAnimation(animation);
        return {
          message: result.message,
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async dock(context?: { robot: Robot; integration: IntegrationStatus }) {
    pauseTelemetry(10_000);
    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<ActionApiResponse>(
          "/api/robot/dock",
          undefined,
          "Dock command failed."
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const result = await mockRobotService.dock();
        return {
          message: result.message,
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async wake(context?: { robot: Robot; integration: IntegrationStatus }) {
    pauseTelemetry(6_000);
    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<ActionApiResponse>(
          "/api/robot/wake",
          undefined,
          "Wake command failed."
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const result = await mockRobotService.wake();
        return {
          message: result.message,
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async toggleMute(isMuted: boolean, context?: { robot: Robot; integration: IntegrationStatus }) {
    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<ActionApiResponse>(
          "/api/robot/mute",
          { isMuted },
          "Mute command failed."
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const result = await mockRobotService.toggleMute(isMuted);
        return {
          message: result.message,
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async setVolume(volume: number, context?: { robot: Robot; integration: IntegrationStatus }) {
    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<ActionApiResponse>(
          "/api/robot/volume",
          { volume },
          "Volume command failed."
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const result = await mockRobotService.setVolume(volume);
        return {
          message: result.message,
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async takePhoto(count = 0): Promise<RobotCommandResult<CameraSyncResult>> {
    return useApiOrFallback(
      async () => {
        const response = await postJson<CameraSyncApiResponse>(
          "/api/robot/camera/capture",
          undefined,
          "Photo capture failed."
        );

        return {
          ok: true,
          message: response.note || "Robot photo captured and synced.",
          data: {
            snapshots: response.snapshots.map(mapCameraSnapshot),
            latestSnapshot: response.latestSnapshot ? mapCameraSnapshot(response.latestSnapshot) : undefined,
            syncedCount: response.syncedCount,
            note: response.note
          }
        };
      },
      async () => {
        const result = await mockRobotService.takePhoto(count);
        if (!result.data) {
          throw new Error("Snapshot failed.");
        }

        return {
          ok: true,
          message: result.message,
          data: {
            snapshots: [result.data],
            latestSnapshot: result.data,
            syncedCount: 1,
            note: result.message
          }
        };
      }
    );
  },

  async syncPhotos(): Promise<RobotCommandResult<CameraSyncResult>> {
    return useApiOrFallback(
      async () => {
        const response = await postJson<CameraSyncApiResponse>(
          "/api/robot/camera/sync",
          undefined,
          "Photo sync failed."
        );

        return {
          ok: true,
          message: response.note || "Robot photo library synced.",
          data: {
            snapshots: response.snapshots.map(mapCameraSnapshot),
            latestSnapshot: response.latestSnapshot ? mapCameraSnapshot(response.latestSnapshot) : undefined,
            syncedCount: response.syncedCount,
            note: response.note
          }
        };
      },
      async () => {
        const result = await mockRobotService.syncPhotos();
        if (!result.data) {
          throw new Error("Photo sync did not return any library data.");
        }

        return {
          ok: true,
          message: result.message,
          data: {
            snapshots: result.data.snapshots,
            latestSnapshot: result.data.latestSnapshot ?? result.data.snapshots[0],
            syncedCount: result.data.syncedCount,
            note: result.data.note
          }
        };
      }
    );
  },

  async deletePhoto(photoId: string, currentSnapshots?: CameraSnapshot[]): Promise<RobotCommandResult<CameraSyncResult>> {
    return useApiOrFallback<RobotCommandResult<CameraSyncResult>>(
      async () => {
        const response = await deleteJson<CameraSyncApiResponse>(
          `/api/robot/camera/photo/${encodeURIComponent(photoId)}`,
          "Photo delete failed."
        );

        return {
          ok: true,
          message: response.note || "Photo removed.",
          data: {
            snapshots: response.snapshots.map(mapCameraSnapshot),
            latestSnapshot: response.latestSnapshot ? mapCameraSnapshot(response.latestSnapshot) : undefined,
            syncedCount: response.syncedCount,
            note: response.note
          }
        };
      },
      async () => {
        return mockRobotService.deletePhoto(photoId, currentSnapshots ?? cloneSnapshot().snapshots);
      }
    );
  },

  async saveRoutine(routine: Routine) {
    return useApiOrFallback(
      async () => {
        const response = await postJson<{ routine: ServerRoutine }>(
          "/api/routines",
          routine,
          "Saving the routine failed."
        );
        return {
          ok: true,
          message: `Routine "${response.routine.name}" saved.`,
          data: mapRoutine(response.routine)
        };
      },
      () => mockRobotService.saveRoutine(routine)
    );
  },

  async deleteRoutine(routineId: string) {
    return useApiOrFallback(
      async () => {
        await deleteJson<{ deleted: boolean }>(`/api/routines/${routineId}`, "Deleting the routine failed.");
        return {
          ok: true,
          message: `Routine ${routineId} removed.`
        };
      },
      () => mockRobotService.deleteRoutine(routineId)
    );
  },

  async updateRoutine(routineId: string, patch: Partial<Routine>) {
    return useApiOrFallback(
      async () => {
        const response = await patchJson<{ routine?: ServerRoutine | null }>(
          `/api/routines/${routineId}`,
          patch,
          "Updating the routine failed."
        );

        return {
          ok: true,
          message: response.routine ? `Routine "${response.routine.name}" updated.` : `Routine ${routineId} updated.`,
          data: response.routine ? mapRoutine(response.routine) : undefined
        };
      },
      async () => ({
        ok: true,
        message: `Routine ${routineId} updated.`,
        data: undefined
      })
    );
  },

  async getDiagnosticsSnapshot(current: AppSnapshot): Promise<DiagnosticsSnapshot> {
    return useApiOrFallback(
      async () => {
        const response = await getJson<ServerDiagnosticsSnapshot>(
          "/api/diagnostics",
          "Diagnostics are unavailable."
        );
        return mapDiagnosticsSnapshot(response, current);
      },
      async () => mockRobotService.getDiagnosticsSnapshot(current)
    );
  },

  async runDiagnostics(current: AppSnapshot) {
    return useApiOrFallback(
      async () => {
        const response = await postJson<DiagnosticsRunResponse>(
          "/api/diagnostics/run",
          undefined,
          "Diagnostics failed."
        );
        return {
          ok: true,
          message: response.report.summary,
          data: {
            report: mapDiagnosticReport(response.report),
            snapshot: mapDiagnosticsSnapshot(response.snapshot, current)
          }
        };
      },
      async () => {
        const result = await mockRobotService.runDiagnostics(current.robot);
        if (!result.data) {
          throw new Error("Mock diagnostics did not return a report.");
        }

        return {
          ok: true,
          message: result.message,
          data: {
            report: result.data,
            snapshot: await mockRobotService.getDiagnosticsSnapshot(current)
          }
        };
      }
    );
  },

  async repairVoiceSetup(context?: { robot: Robot; integration: IntegrationStatus }) {
    return useApiOrFallback(
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        const response = await postJson<VoiceRepairApiResponse>(
          "/api/diagnostics/voice/repair",
          undefined,
          "Voice setup repair failed.",
          { timeoutMs: SUPPORT_ACTION_TIMEOUT_MS }
        );
        return mapActionResult(response, fallback.robot, fallback.integration);
      },
      async () => {
        const fallback = context ?? {
          robot: cloneSnapshot().robot,
          integration: cloneSnapshot().integration
        };
        return {
          message: "Mock voice setup refreshed.",
          robot: fallback.robot,
          integration: fallback.integration
        };
      }
    );
  },

  async quickRepair(current: AppSnapshot): Promise<RobotCommandResult<{ repair: RepairResult; snapshot: DiagnosticsSnapshot }>> {
    return useApiOrFallback(
      async () => {
        const response = await postJson<QuickRepairApiResponse>(
          "/api/support/repair",
          undefined,
          "Quick repair failed.",
          { timeoutMs: SUPPORT_ACTION_TIMEOUT_MS }
        );
        return {
          ok: true,
          message: response.repair.summary,
          data: {
            repair: mapRepairResult(response.repair),
            snapshot: mapDiagnosticsSnapshot(response.snapshot, current)
          }
        };
      },
      async () => ({
        ok: true,
        message: "Mock quick repair refreshed the local test state.",
        data: {
          repair: {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            overallStatus: "repaired",
            summary: "Mock mode does not need a live repair.",
            steps: [
              {
                id: crypto.randomUUID(),
                label: "Mock mode",
                status: "success",
                details: "The app is running in mock mode, so no live Vector repair was needed."
              }
            ]
          },
          snapshot: await mockRobotService.getDiagnosticsSnapshot(current)
        }
      })
    );
  },

  async reportProblem(
    current: AppSnapshot,
    payload: { summary: string; details: string; contactEmail?: string }
  ): Promise<RobotCommandResult<{ report: SupportReport; reports: SupportReport[]; snapshot: DiagnosticsSnapshot }>> {
    return useApiOrFallback(
      async () => {
        const response = await postJson<SupportReportApiResponse>(
          "/api/support/report",
          payload,
          "Problem report failed."
        );
        return {
          ok: true,
          message: "Problem report saved locally after the latest repair attempt.",
          data: {
            report: mapSupportReport(response.report),
            reports: response.reports.map(mapSupportReport),
            snapshot: mapDiagnosticsSnapshot(response.snapshot, current)
          }
        };
      },
      async () => {
        const repair = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          overallStatus: "repaired" as const,
          summary: "Mock repair completed.",
          steps: [
            {
              id: crypto.randomUUID(),
              label: "Mock mode",
              status: "success" as const,
              details: "Mock mode refreshed its local test state."
            }
          ]
        };
        const report: SupportReport = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          summary: payload.summary,
          details: payload.details,
          contactEmail: payload.contactEmail,
          robotName: cloneSnapshot().robot.nickname ?? cloneSnapshot().robot.name,
          integrationNote: "Mock mode is active.",
          repairResult: repair
        };
        return {
          ok: true,
          message: "Mock problem report saved locally.",
          data: {
            report,
            reports: [report],
            snapshot: await mockRobotService.getDiagnosticsSnapshot(current)
          }
        };
      }
    );
  },

  async updateSettings(
    patch: Partial<AppSettings>,
    current: AppSettings,
    currentIntegration: IntegrationStatus,
    currentRobot?: Robot
  ): Promise<SettingsEnvelope> {
    clearWirePodSetupCache();
    const normalizedBackendUrl = persistAppBackendUrl(
      patch.appBackendUrl === undefined ? current.appBackendUrl : patch.appBackendUrl
    );
    const localOnlyPatch = {
      appBackendUrl: normalizedBackendUrl
    };
    const backendPatch = {
      theme: patch.theme,
      colorTheme: patch.colorTheme,
      autoDetectWirePod: patch.autoDetectWirePod,
      customWirePodEndpoint: patch.customWirePodEndpoint,
      mockMode: patch.mockMode,
      reconnectOnStartup: patch.reconnectOnStartup ?? patch.autoReconnect,
      protectChargingUntilFull: patch.protectChargingUntilFull,
      pollingIntervalMs: patch.pollingIntervalMs,
      liveUpdateMode: patch.liveUpdateMode,
      serial: patch.robotSerial
    };
    const localTransition = buildLocalSettingsTransition({
      patch,
      currentSettings: current,
      currentIntegration,
      currentRobot,
      normalizedBackendUrl
    });

    const backendPatchHasValues = Object.values(backendPatch).some((value) => value !== undefined);

    if (!backendPatchHasValues || shouldApplyMobileLocalOnlySettings(patch)) {
      return {
        settings: { ...current, ...patch, ...localOnlyPatch },
        integration: localTransition?.integration ?? currentIntegration,
        robot: localTransition?.robot
      };
    }

    return useApiOrFallback(
      async () => {
        const response = await patchJson<SettingsApiResponse>(
          "/api/settings",
          backendPatch,
          "Settings update failed."
        );
        return {
          settings: mapSettings(response.settings, { ...current, ...patch, ...localOnlyPatch }),
          integration: mapIntegration(response.integration, cloneSnapshot().integration)
        };
      },
      async () => ({
        settings: { ...current, ...patch, ...localOnlyPatch },
        integration:
          localTransition?.integration ?? {
            ...cloneSnapshot().integration,
            mockMode: patch.mockMode ?? cloneSnapshot().integration.mockMode,
            autoDetectEnabled: patch.autoDetectWirePod ?? cloneSnapshot().integration.autoDetectEnabled,
            reconnectOnStartup:
              patch.reconnectOnStartup ?? patch.autoReconnect ?? cloneSnapshot().integration.reconnectOnStartup
          },
        robot: localTransition?.robot
      })
    );
  },

  async getWirePodWeatherConfig(): Promise<WirePodWeatherConfig> {
    return getJson<WirePodWeatherApiResponse>(
      "/api/settings/wirepod/weather",
      "WirePod weather settings are unavailable."
    ).then((response) => response.weather);
  },

  async updateWirePodWeatherConfig(payload: {
    provider: string;
    key: string;
    unit?: string;
  }): Promise<WirePodWeatherConfig> {
    return postJson<WirePodWeatherApiResponse>(
      "/api/settings/wirepod/weather",
      payload,
      "WirePod weather settings could not be saved."
    ).then((response) => response.weather);
  },

  async getWirePodSetupStatus(): Promise<WirePodSetupStatus> {
    if (wirePodSetupCache && wirePodSetupCache.expiresAt > Date.now()) {
      return wirePodSetupCache.value;
    }

    return getJson<WirePodSetupApiResponse>(
      "/api/settings/wirepod/setup",
      "WirePod setup details are unavailable."
    ).then((response) => {
      wirePodSetupCache = {
        value: response.setup,
        expiresAt: Date.now() + WIREPOD_SETUP_CACHE_MS
      };
      return response.setup;
    });
  },

  async finishWirePodSetup(payload?: {
    language?: string;
    connectionMode?: Exclude<WirePodConnectionMode, "unknown">;
    port?: string;
  }): Promise<WirePodSetupStatus> {
    clearWirePodSetupCache();
    return postJson<WirePodSetupApiResponse>(
      "/api/settings/wirepod/setup",
      payload ?? {},
      "WirePod setup could not be completed.",
      { timeoutMs: WIREPOD_SETUP_TIMEOUT_MS }
    ).then((response) => {
      wirePodSetupCache = {
        value: response.setup,
        expiresAt: Date.now() + WIREPOD_SETUP_CACHE_MS
      };
      return response.setup;
    });
  },

  async getMobileBackendTargets(): Promise<MobileBackendTarget[]> {
    try {
      const response = await getJson<MobileBackendTargetsApiResponse>(
        "/api/settings/mobile-targets",
        "Mobile backend suggestions are unavailable."
      );
      return response.targets;
    } catch {
      return [];
    }
  },

  async startRoam(robot: Robot, automation: Parameters<typeof mockRobotService.startRoam>[1], existingCount: number) {
    return mockRobotService.startRoam(robot, automation, existingCount);
  },

  async pauseRoam(session: Parameters<typeof mockRobotService.pauseRoam>[0]) {
    return mockRobotService.pauseRoam(session);
  },

  async resumeRoam(session: Parameters<typeof mockRobotService.resumeRoam>[0]) {
    return mockRobotService.resumeRoam(session);
  },

  async stopRoam(session: Parameters<typeof mockRobotService.stopRoam>[0], robot: Robot) {
    return mockRobotService.stopRoam(session, robot);
  },

  subscribeRoam: mockRobotService.subscribeRoam,

  subscribeTelemetry(
    getContext: () => { robot: Robot; integration: IntegrationStatus; settings: AppSettings },
    onUpdate: (payload: RobotEnvelope) => void
  ) {
    let stopped = false;
    let timer: number | null = null;
    let fallbackStopper: (() => void) | null = null;
    let reconnectInFlight = false;
    let lastReconnectAttemptAt = 0;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      if (stopped) {
        return;
      }
      const context = getContext();
      const baseInterval = Math.max(
        MIN_POLLING_INTERVAL_MS,
        context.settings.pollingIntervalMs || 6000
      );
      const interval =
        context.robot.isDocked || context.robot.isCharging
          ? Math.min(baseInterval, FAST_DOCKED_POLLING_INTERVAL_MS)
          : baseInterval;
      timer = window.setTimeout(() => {
        void poll();
      }, interval);
    };

    const ensureMockTelemetry = () => {
      if (fallbackStopper) {
        return;
      }
      fallbackStopper = mockRobotService.subscribeTelemetry(() => getContext().robot, (robot) => {
        onUpdate({
          robot,
          integration: {
            ...getContext().integration,
            source: "mock",
            mockMode: true,
            wirePodReachable: false,
            robotReachable: true,
            note: "Mock mode is active.",
            lastCheckedAt: new Date().toISOString()
          }
        });
      });
    };

    const stopMockTelemetry = () => {
      fallbackStopper?.();
      fallbackStopper = null;
    };

    const attemptReconnect = async (
      context: { robot: Robot; integration: IntegrationStatus; settings: AppSettings }
    ) => {
      if (!shouldAttemptReconnect(context, reconnectInFlight, lastReconnectAttemptAt)) {
        return;
      }

      reconnectInFlight = true;
      lastReconnectAttemptAt = Date.now();

      try {
        const response = await postJson<StatusApiResponse>(
          "/api/robot/connect",
          buildReconnectPayload(context.robot, context.integration, context.settings),
          "Robot reconnection failed."
        );

        onUpdate(mapRobotEnvelope(response, context.robot, context.integration));
      } catch {
        // Keep the last visible offline state and try again on the next cooldown.
      } finally {
        reconnectInFlight = false;
      }
    };

    const poll = async () => {
      try {
        if (Date.now() < telemetryPausedUntil) {
          schedule();
          return;
        }

        const context = getContext();
        const response = await getJson<StatusApiResponse>(
          "/api/robot/status",
          "Robot status poll failed."
        );
        stopMockTelemetry();
        const nextState = mapRobotEnvelope(response, context.robot, context.integration);
        onUpdate(nextState);

        await attemptReconnect({
          robot: nextState.robot,
          integration: nextState.integration,
          settings: context.settings
        });
      } catch (error) {
        const context = getContext();
        if (shouldUseFallback(error) && (context.settings.mockMode || context.integration.source === "mock")) {
          ensureMockTelemetry();
        } else {
          stopMockTelemetry();
          const offlineState = buildOfflineWirePodState(context.robot, context.integration);
          onUpdate(offlineState);
          await attemptReconnect({
            robot: offlineState.robot,
            integration: offlineState.integration,
            settings: context.settings
          });
        }
      } finally {
        schedule();
      }
    };

    void poll();

    return () => {
      stopped = true;
      clearTimer();
      stopMockTelemetry();
    };
  }
};
