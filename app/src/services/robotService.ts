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
  buildProfile,
  mapCameraSnapshot,
  mapAvailableRobot,
  mapDiagnosticReport,
  mapDiagnosticsSnapshot,
  mapIntegration,
  mapRobot,
  mapRoutine,
  mapSettings,
  type ServerBootstrapResponse,
  type ServerCameraSnapshot,
  type ServerDiagnosticsSnapshot,
  type ServerDiscoveredRobot,
  type ServerIntegration,
  type ServerLog,
  type ServerRobot,
  type ServerRoutine,
  type ServerSettings
} from "@/services/robotBackend";
import type {
  AnimationItem,
  AppSettings,
  AppSnapshot,
  CameraSyncResult,
  DiagnosticReport,
  DiagnosticsSnapshot,
  IntegrationStatus,
  PairRobotInput,
  Robot,
  RobotCommandResult,
  RobotProfile,
  Routine
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

interface SettingsEnvelope {
  settings: AppSettings;
  integration: IntegrationStatus;
}

const shouldUseFallback = (error: unknown) => isNetworkError(error);

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
    settings,
    routines: response.routines.map(mapRoutine),
    logs: response.logs,
    snapshots: response.snapshots.map(mapCameraSnapshot),
    availableRobots: response.robots.map(mapAvailableRobot),
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

const connectPayload = (robot: Robot) => ({
  serial: robot.serial,
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
    isCharging: false,
    isDocked: false,
    connectionState: "error",
    firmwareVersion: "WirePod unavailable",
    wifiStrength: 0,
    mood: "sleepy",
    systemStatus: "offline",
    currentActivity: "Vector brain offline",
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

  async connect(robot: Robot, integration: IntegrationStatus): Promise<RobotCommandResult<RobotEnvelope>> {
    return useApiOrFallback(
      async () => {
        const response = await postJson<StatusApiResponse>(
          "/api/robot/connect",
          connectPayload(robot),
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

  async updateSettings(patch: Partial<AppSettings>, current: AppSettings): Promise<SettingsEnvelope> {
    const backendPatch = {
      theme: patch.theme,
      colorTheme: patch.colorTheme,
      autoDetectWirePod: patch.autoDetectWirePod,
      customWirePodEndpoint: patch.customWirePodEndpoint,
      mockMode: patch.mockMode,
      reconnectOnStartup: patch.reconnectOnStartup ?? patch.autoReconnect,
      pollingIntervalMs: patch.pollingIntervalMs,
      liveUpdateMode: patch.liveUpdateMode,
      serial: patch.robotSerial
    };

    return useApiOrFallback(
      async () => {
        const response = await patchJson<SettingsApiResponse>(
          "/api/settings",
          backendPatch,
          "Settings update failed."
        );
        return {
          settings: mapSettings(response.settings, { ...current, ...patch }),
          integration: mapIntegration(response.integration, cloneSnapshot().integration)
        };
      },
      async () => ({
        settings: { ...current, ...patch },
        integration: {
          ...cloneSnapshot().integration,
          mockMode: patch.mockMode ?? cloneSnapshot().integration.mockMode,
          autoDetectEnabled: patch.autoDetectWirePod ?? cloneSnapshot().integration.autoDetectEnabled,
          reconnectOnStartup:
            patch.reconnectOnStartup ?? patch.autoReconnect ?? cloneSnapshot().integration.reconnectOnStartup
        }
      })
    );
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
      const interval = Math.max(2000, getContext().settings.pollingIntervalMs || 6000);
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

    const poll = async () => {
      try {
        const context = getContext();
        const response = await getJson<StatusApiResponse>(
          "/api/robot/status",
          "Robot status poll failed."
        );
        stopMockTelemetry();
        onUpdate(mapRobotEnvelope(response, context.robot, context.integration));
      } catch (error) {
        const context = getContext();
        if (shouldUseFallback(error) && (context.settings.mockMode || context.integration.source === "mock")) {
          ensureMockTelemetry();
        } else {
          stopMockTelemetry();
          onUpdate(buildOfflineWirePodState(context.robot, context.integration));
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
