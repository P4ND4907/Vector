import { Buffer } from "node:buffer";
import { buildOfflineRobot, createLocalStore } from "../db/localStore.js";
import {
  inferSuggestedArea,
  isRecentDuplicateGap,
  normalizeCommandPrompt
} from "../services/commandGapService.js";
import { saveAiMemory as mergeAiMemory } from "../services/aiBrainService.js";
import { createLocalRepairService } from "../services/localRepairService.js";
import { buildVoiceDiagnostics } from "../services/voiceDiagnosticsService.js";
import { buildWirePodSetupStatus } from "../services/wirepodSetupService.js";
import { createWirePodService, batteryVoltageToPercent } from "../services/wirepodService.js";
import { createMockRobotController } from "./mockRobotController.js";
import {
  animationIntentMap,
  buildWirePodRobotName,
  chooseRobot,
  clampNumber,
  deriveSystemStatus,
  makeLog,
  toDiscoveredRobot
} from "./hybridRobotSupport.js";
import type {
  AutomationControlRecord,
  CameraImageAsset,
  CameraSnapshotRecord,
  CameraSyncResult,
  CommandGapRecord,
  CommandLogRecord,
  DiagnosticCheckRecord,
  DiagnosticReportRecord,
  DiscoveredRobot,
  RepairResultRecord,
  RepairStepRecord,
  RobotController,
  RobotIntegrationInfo,
  RobotStatus,
  RoamSessionRecord,
  RoutineRecord,
  SupportReportRecord,
  WirePodSetupStatusRecord,
  WirePodWeatherConfigRecord,
  VoiceDiagnosticsRecord
} from "./types.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const createHybridRobotController = (options: {
  dataFilePath: string;
  wirePodBaseUrl: string;
  wirePodTimeoutMs?: number;
}): RobotController => {
  const store = createLocalStore(options.dataFilePath);
  const fallback = createMockRobotController();
  const localRepair = createLocalRepairService();
  let busyUntil = 0;
  let busyActivity = "Awaiting your next command.";
  let lastHeadAngle = 0;
  let lastLiftHeight = 50;

  let lastIntegration: RobotIntegrationInfo = {
    source: store.getState().settings.mockMode ? "mock" : "wirepod",
    wirePodReachable: false,
    wirePodBaseUrl: store.getState().settings.savedWirePodEndpoint || options.wirePodBaseUrl,
    note: store.getState().settings.mockMode ? "Mock mode is active." : "Vector brain offline",
    robotReachable: false,
    mockMode: store.getState().settings.mockMode,
    autoDetectEnabled: store.getState().settings.autoDetectWirePod,
    reconnectOnStartup: store.getState().settings.reconnectOnStartup,
    customEndpoint: store.getState().settings.customWirePodEndpoint || undefined,
    lastCheckedAt: new Date().toISOString(),
    probes: []
  };

  const wirePod = createWirePodService({
    initialEndpoint: store.getState().settings.savedWirePodEndpoint || options.wirePodBaseUrl,
    timeoutMs: options.wirePodTimeoutMs,
    getSettings: () => store.getState().settings,
    onEndpointResolved: (endpoint, probes) => {
      const currentState = store.getState();
      store.saveSettings({ savedWirePodEndpoint: endpoint });
      lastIntegration = {
        ...lastIntegration,
        source: currentState.settings.mockMode ? "mock" : "wirepod",
        wirePodReachable: true,
        wirePodBaseUrl: endpoint,
        mockMode: currentState.settings.mockMode,
        autoDetectEnabled: currentState.settings.autoDetectWirePod,
        reconnectOnStartup: currentState.settings.reconnectOnStartup,
        customEndpoint: currentState.settings.customWirePodEndpoint || undefined,
        lastCheckedAt: new Date().toISOString(),
        probes,
        note: "WirePod detected."
      };
    },
    onEndpointFailure: (probes, error) => {
      const currentState = store.getState();
      lastIntegration = {
        ...lastIntegration,
        source: currentState.settings.mockMode ? "mock" : "wirepod",
        wirePodReachable: false,
        robotReachable: false,
        mockMode: currentState.settings.mockMode,
        autoDetectEnabled: currentState.settings.autoDetectWirePod,
        reconnectOnStartup: currentState.settings.reconnectOnStartup,
        customEndpoint: currentState.settings.customWirePodEndpoint || undefined,
        lastCheckedAt: new Date().toISOString(),
        probes,
        note: error
      };
    }
  });

  let cachedRobot = buildOfflineRobot(store.getState().robotProfile, lastIntegration.note);

  const getSettings = () => store.getState().settings;
  const getProfile = () => store.getState().robotProfile;
  const getLogs = () => store.getState().logs;
  const getRoutines = () => store.getState().routines;
  const getSnapshots = () => store.getState().snapshots;
  const getSupportReports = () => store.getState().supportReports;
  const getAiMemory = () => store.getState().aiMemory;
  const getCommandGaps = () => store.getState().commandGaps;
  const getAutomationControl = () => store.getState().automationControl;
  const getRoamSessions = () => store.getState().roamSessions;
  const getSelectedSerial = () =>
    getSettings().serial ||
    cachedRobot.serial ||
    getProfile().selectedSerial ||
    lastIntegration.selectedSerial;

  const latestSuccessfulCommand = () => getLogs().find((log) => log.status === "success");
  const latestFailedCommand = () => getLogs().find((log) => log.status === "error");

  const setBusy = (activity: string, durationMs = 2500) => {
    busyActivity = activity;
    busyUntil = Date.now() + durationMs;
  };

  const applyRobotState = (robot: RobotStatus) => {
    const isBusy = Date.now() < busyUntil && robot.isConnected;
    cachedRobot = {
      ...robot,
      systemStatus: isBusy ? "busy" : deriveSystemStatus(robot),
      currentActivity: isBusy ? busyActivity : robot.currentActivity
    };
    return cachedRobot;
  };

  const pushLog = (log: CommandLogRecord, nextRobot?: RobotStatus) => {
    store.appendLog(log);
    if (nextRobot) {
      applyRobotState(nextRobot);
    } else {
      applyRobotState({
        ...cachedRobot,
        lastSeen: new Date().toISOString()
      });
    }
    return log;
  };

  const saveCommandGap = (payload: {
    source: CommandGapRecord["source"];
    prompt: string;
    normalizedPrompt?: string;
    category: CommandGapRecord["category"];
    note: string;
    suggestedArea?: string;
    heardAt?: string;
    matchedIntent?: string;
  }) => {
    const normalizedPrompt = payload.normalizedPrompt || normalizeCommandPrompt(payload.prompt);
    const recentDuplicate = isRecentDuplicateGap(getCommandGaps(), {
      source: payload.source,
      category: payload.category,
      normalizedPrompt,
      matchedIntent: payload.matchedIntent
    });

    if (recentDuplicate) {
      return recentDuplicate;
    }

    const record: CommandGapRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      source: payload.source,
      prompt: payload.prompt.trim(),
      normalizedPrompt,
      category: payload.category,
      note: payload.note.trim(),
      suggestedArea: payload.suggestedArea || inferSuggestedArea(payload.prompt),
      heardAt: payload.heardAt,
      matchedIntent: payload.matchedIntent
    };

    store.saveCommandGaps([record, ...getCommandGaps()]);
    return record;
  };

  const buildRealRobot = ({
    alias,
    batteryPercent,
    isCharging,
    isConnected,
    isDocked,
    ipAddress,
    serial
  }: {
    alias?: string;
    batteryPercent: number;
    isCharging: boolean;
    isConnected: boolean;
    isDocked: boolean;
    ipAddress: string;
    serial: string;
  }): RobotStatus => {
    const mood = !isConnected
      ? "sleepy"
      : isCharging
        ? "charging"
        : batteryPercent < 20
          ? "focused"
          : batteryPercent > 80
            ? "playful"
            : "ready";
    const profile = getProfile();

    return applyRobotState({
      id: `wirepod-${serial}`,
      serial,
      name: buildWirePodRobotName(serial, alias),
      nickname: alias?.trim() || cachedRobot.nickname,
      ipAddress: ipAddress || cachedRobot.ipAddress,
      token: profile.token || cachedRobot.token || "wirepod-managed",
      batteryPercent,
      isCharging,
      isConnected,
      isDocked,
      lastSeen: new Date().toISOString(),
      firmwareVersion: isConnected ? "WirePod local" : "WirePod robot offline",
      mood,
      connectionState: isConnected ? "connected" : "error",
      wifiStrength: isConnected ? 100 : 0,
      isMuted: cachedRobot.isMuted,
      volume: cachedRobot.volume || 3,
      cameraAvailable: isConnected,
      connectionSource: "wirepod",
      systemStatus: "ready",
      currentActivity: isConnected ? "Ready for commands." : "Vector brain offline"
    });
  };

  const syncIntegration = (patch?: Partial<RobotIntegrationInfo>) => {
    const settings = getSettings();
    lastIntegration = {
      ...lastIntegration,
      source: settings.mockMode ? "mock" : "wirepod",
      mockMode: settings.mockMode,
      autoDetectEnabled: settings.autoDetectWirePod,
      reconnectOnStartup: settings.reconnectOnStartup,
      customEndpoint: settings.customWirePodEndpoint || undefined,
      wirePodBaseUrl:
        patch?.wirePodBaseUrl ||
        wirePod.getActiveEndpoint() ||
        settings.savedWirePodEndpoint ||
        options.wirePodBaseUrl,
      lastCheckedAt: new Date().toISOString(),
      probes: wirePod.getLastProbes(),
      ...patch
    };
    return lastIntegration;
  };

  const buildTroubleshooting = () => {
    const suggestions: string[] = [];
    if (getSettings().mockMode) {
      suggestions.push("Mock mode is on. Turn it off in Settings to talk to the real robot.");
    }
    if (!lastIntegration.wirePodReachable) {
      suggestions.push("Vector brain offline. Make sure WirePod is running on this computer.");
      suggestions.push("Open http://127.0.0.1:8080 on this PC to confirm the local WirePod server is alive.");
    }
    if (lastIntegration.wirePodReachable && !lastIntegration.robotReachable) {
      suggestions.push("WirePod is online, but Vector is not responding on local Wi-Fi yet.");
      suggestions.push("If Vector just restarted, wait a moment and try reconnect again.");
      suggestions.push("Make sure Vector and this PC are on the same local Wi-Fi and not on a guest or isolated network.");
      suggestions.push("If disconnects keep returning, reserve a static IP for Vector in your router.");
      suggestions.push("If setup stalls right after Bluetooth pairing, mDNS or local-name discovery may be blocked by the router.");
    }
    if (!getSettings().serial) {
      suggestions.push("No serial is saved yet. Scan for robots or enter the serial in Settings.");
    }
    return suggestions;
  };

  const buildCurrentVoiceDiagnostics = async (robotOverride?: RobotStatus): Promise<VoiceDiagnosticsRecord> => {
    if (getSettings().mockMode) {
      return fallback.getVoiceDiagnostics() as VoiceDiagnosticsRecord;
    }

    const robot = robotOverride ?? cachedRobot;
    const serial = getSelectedSerial();

    if (!serial) {
      return {
        wakeWordMode: "unknown",
        locale: "Unknown",
        volume: robot.volume ?? 0,
        status: "attention",
        summary: "No robot serial is saved yet, so voice settings cannot be checked.",
        troubleshooting: ["Save the robot serial first so voice setup can be targeted correctly."]
      };
    }

    let sdkSettings;
    let logsText = "";
    let debugLogsText = "";

    try {
      sdkSettings = await wirePod.getSdkSettings(serial);
    } catch {
      sdkSettings = undefined;
    }

    const [logsResult, debugResult] = await Promise.allSettled([
      wirePod.getLogs(),
      wirePod.getDebugLogs()
    ]);

    if (logsResult.status === "fulfilled") {
      logsText = logsResult.value;
    }

    if (debugResult.status === "fulfilled") {
      debugLogsText = debugResult.value;
    }

    return buildVoiceDiagnostics({
      integration: lastIntegration,
      robot,
      sdkSettings,
      logsText,
      debugLogsText
    });
  };

  const getCurrentWirePodSetupStatus = async (): Promise<WirePodSetupStatusRecord> => {
    if (getSettings().mockMode) {
      return fallback.getWirePodSetupStatus() as WirePodSetupStatusRecord;
    }

    try {
      const [config, sttInfo, sdkInfo] = await Promise.all([
        wirePod.getConfig().catch(() => undefined),
        wirePod.getSttInfo().catch(() => undefined),
        wirePod.getSdkInfo().catch(() => undefined)
      ]);

      return buildWirePodSetupStatus({
        reachable: true,
        config,
        sttInfo,
        sdkInfo
      });
    } catch {
      return buildWirePodSetupStatus({
        reachable: false
      });
    }
  };

  const refreshWirePodStatus = async (payload?: Partial<RobotStatus>) => {
    if (getSettings().mockMode) {
      syncIntegration({
        source: "mock",
        wirePodReachable: false,
        robotReachable: true,
        note: "Mock mode is active."
      });
      cachedRobot = applyRobotState(fallback.getStatus() as RobotStatus);
      return cachedRobot;
    }

    try {
      const sdkInfo = await wirePod.getSdkInfo();
      const robots = sdkInfo.robots.filter((item) => item.activated || item.ip_address);

      if (!robots.length) {
        syncIntegration({
          source: "wirepod",
          wirePodReachable: true,
          robotReachable: false,
          note: "WirePod is online, but no authenticated Vector robots were found."
        });
        cachedRobot = buildOfflineRobot(getProfile(), "Vector brain offline");
        return cachedRobot;
      }

      const settings = getSettings();
      const selectedRobot = chooseRobot({
        payload: {
          ...payload,
          serial: payload?.serial || settings.serial || getProfile().selectedSerial
        },
        robots,
        selectedSerial: settings.serial || getProfile().selectedSerial
      });

      if (!selectedRobot) {
        cachedRobot = buildOfflineRobot(getProfile(), "Vector brain offline");
        return cachedRobot;
      }

      const alias = payload?.nickname || payload?.name || getProfile().aliases[selectedRobot.esn];
      store.saveRobotProfile({
        selectedSerial: selectedRobot.esn,
        aliases: alias ? { [selectedRobot.esn]: alias } : {},
        token: payload?.token || getProfile().token
      });
      store.saveSettings({ serial: selectedRobot.esn });

      try {
        const battery = await wirePod.getBattery(selectedRobot.esn);
        const nextRobot = buildRealRobot({
          alias,
          serial: selectedRobot.esn,
          ipAddress: selectedRobot.ip_address || payload?.ipAddress || "Unavailable",
          batteryPercent: batteryVoltageToPercent(battery.battery_volts),
          isCharging: Boolean(battery.is_charging),
          isDocked: Boolean(battery.is_on_charger_platform),
          isConnected: true
        });

        syncIntegration({
          source: "wirepod",
          wirePodReachable: true,
          robotReachable: true,
          selectedSerial: selectedRobot.esn,
          note: "Connected through local WirePod."
        });
        return nextRobot;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Vector brain offline";
        const nextRobot = buildRealRobot({
          alias,
          serial: selectedRobot.esn,
          ipAddress: selectedRobot.ip_address || payload?.ipAddress || "Unavailable",
          batteryPercent: cachedRobot.batteryPercent || 0,
          isCharging: false,
          isDocked: false,
          isConnected: false
        });

        syncIntegration({
          source: "wirepod",
          wirePodReachable: true,
          robotReachable: false,
          selectedSerial: selectedRobot.esn,
          note: message || "Vector is not responding through WirePod right now."
        });
        return nextRobot;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vector brain offline";
      syncIntegration({
        source: "wirepod",
        wirePodReachable: false,
        robotReachable: false,
        note: message
      });
      cachedRobot = buildOfflineRobot(getProfile(), message, "wirepod");
      return cachedRobot;
    }
  };

  const withRealRobot = async <T>(
    activity: string,
    action: (serial: string, robot: RobotStatus) => Promise<T>
  ) => {
    const robot = await refreshWirePodStatus();
    const fallbackSerial =
      robot.serial ||
      cachedRobot.serial ||
      getSettings().serial ||
      getProfile().selectedSerial ||
      lastIntegration.selectedSerial;

    if ((!robot.isConnected || !robot.serial) && fallbackSerial && lastIntegration.wirePodReachable) {
      const fallbackRobot = applyRobotState({
        ...cachedRobot,
        serial: fallbackSerial,
        isConnected: true,
        connectionState: "connected",
        connectionSource: "wirepod",
        currentActivity: cachedRobot.currentActivity || "Ready for commands.",
        lastSeen: new Date().toISOString()
      });
      setBusy(activity);
      return action(fallbackSerial, fallbackRobot);
    }

    if (!robot.isConnected || !robot.serial) {
      throw new Error(lastIntegration.note || "Vector brain offline");
    }

    setBusy(activity);
    return action(robot.serial, robot);
  };

  const runMockOrThrow = async <T>(
    mockAction: () => T,
    activity: string,
    action: (serial: string, robot: RobotStatus) => Promise<T>
  ) => {
    if (getSettings().mockMode) {
      setBusy(activity);
      return mockAction();
    }

    return withRealRobot(activity, action);
  };

  const saveRoutines = (nextRoutines: RoutineRecord[]) => {
    store.saveRoutines(nextRoutines);
    return nextRoutines;
  };

  const saveAutomationControl = (patch: Partial<AutomationControlRecord>) =>
    store.saveAutomationControl(patch).automationControl;

  const saveRoamSessions = (nextRoamSessions: RoamSessionRecord[]) => {
    store.saveRoamSessions(nextRoamSessions);
    return nextRoamSessions;
  };

  const getActiveRoamSession = () =>
    getRoamSessions().find((session) => session.id === getAutomationControl().activeSessionId);

  const buildRepairStep = (
    label: string,
    status: RepairStepRecord["status"],
    details: string
  ): RepairStepRecord => ({
    id: crypto.randomUUID(),
    label,
    status,
    details
  });

  const refreshVoiceDefaultsInline = async (serial: string, robot: RobotStatus) => {
    const currentSettings = await wirePod.getSdkSettings(serial).catch(() => undefined);
    const targetVolume = Math.max(
      4,
      Math.min(5, currentSettings?.master_volume ?? robot.volume ?? 4)
    );

    await wirePod.setButtonHeyVector(serial);
    await wait(250);
    await wirePod.setLocale(serial, "en-US");
    await wait(250);
    await wirePod.setVolume(serial, targetVolume);

    return targetVolume;
  };

  const runQuickRepair = async (): Promise<RepairResultRecord> => {
    if (getSettings().mockMode) {
      const result: RepairResultRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        overallStatus: "repaired",
        summary: "Mock mode is active, so the quick repair path only refreshed local test state.",
        steps: [
          buildRepairStep(
            "Mock mode",
            "success",
            "No live Vector repair was needed because the app is currently running in mock mode."
          )
        ]
      };
      pushLog(makeLog("quick-repair", { mode: "mock" }, "success", result.summary));
      return result;
    }

    const steps: RepairStepRecord[] = [];
    let robot = await refreshWirePodStatus();

    if (!lastIntegration.wirePodReachable) {
      const startResult = await localRepair.tryStartWirePod();
      steps.push(
        buildRepairStep(
          "Start local Vector brain",
          startResult.launched ? "success" : startResult.attempted ? "warn" : "fail",
          startResult.executablePath
            ? `${startResult.message} (${startResult.executablePath})`
            : startResult.message
        )
      );

      if (startResult.launched) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          await wait(1_250);
          robot = await refreshWirePodStatus();
          if (lastIntegration.wirePodReachable) {
            break;
          }
        }
      }
    } else {
      steps.push(
        buildRepairStep(
          "Local Vector brain",
          "success",
          "WirePod was already reachable, so no restart was needed."
        )
      );
    }

    robot = await refreshWirePodStatus();
    steps.push(
      buildRepairStep(
        "Detect WirePod",
        lastIntegration.wirePodReachable ? "success" : "fail",
        lastIntegration.wirePodReachable
          ? `The app can reach WirePod at ${lastIntegration.wirePodBaseUrl}.`
          : lastIntegration.note || "WirePod is still offline after the repair attempt."
      )
    );

    if (lastIntegration.wirePodReachable) {
      if (!robot.isConnected) {
        const serial =
          robot.serial ||
          cachedRobot.serial ||
          getSettings().serial ||
          getProfile().selectedSerial ||
          lastIntegration.selectedSerial;

        if (serial) {
          try {
            await wirePod.wake(serial);
            await wait(1_200);
            robot = await refreshWirePodStatus();
            steps.push(
              buildRepairStep(
                "Wake robot link",
                robot.isConnected ? "success" : "warn",
                robot.isConnected
                  ? `${robot.nickname ?? robot.name} responded after a wake signal.`
                  : "Wake was sent, but Vector still is not answering local status checks."
              )
            );
          } catch (error) {
            steps.push(
              buildRepairStep(
                "Wake robot link",
                "warn",
                error instanceof Error ? error.message : "The wake signal could not be sent."
              )
            );
          }
        } else {
          steps.push(
            buildRepairStep(
              "Wake robot link",
              "warn",
              "No robot serial is saved yet, so the repair path could not target a specific Vector."
            )
          );
        }
      } else {
        steps.push(
          buildRepairStep(
            "Robot link",
            "success",
            `${robot.nickname ?? robot.name} was already responding through WirePod.`
          )
        );
      }
    }

    robot = await refreshWirePodStatus();

    if (robot.isConnected && robot.serial) {
      try {
        const targetVolume = await refreshVoiceDefaultsInline(robot.serial, robot);
        robot = applyRobotState({
          ...robot,
          volume: targetVolume,
          currentActivity: "Quick repair refreshed voice defaults."
        });
        steps.push(
          buildRepairStep(
            "Refresh voice defaults",
            "success",
            "Re-applied Hey Vector mode, English (US), and a safe speaker volume."
          )
        );
      } catch (error) {
        steps.push(
          buildRepairStep(
            "Refresh voice defaults",
            "warn",
            error instanceof Error ? error.message : "Voice defaults could not be refreshed."
          )
        );
      }
    }

    const finalRobot = await refreshWirePodStatus();
    const overallStatus: RepairResultRecord["overallStatus"] =
      finalRobot.isConnected && lastIntegration.robotReachable
        ? "repaired"
        : lastIntegration.wirePodReachable
          ? "partial"
          : "failed";
    const summary =
      overallStatus === "repaired"
        ? `${finalRobot.nickname ?? finalRobot.name} is back online and ready.`
        : overallStatus === "partial"
          ? "The local brain came back, but Vector still needs attention."
          : "Quick repair could not restore the local Vector stack automatically.";

    pushLog(
      makeLog(
        "quick-repair",
        { overallStatus, wirePodReachable: lastIntegration.wirePodReachable, robotReachable: lastIntegration.robotReachable },
        overallStatus === "failed" ? "error" : "success",
        summary
      )
    );

    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      overallStatus,
      summary,
      steps
    };
  };

  return {
    getStatus: async () => {
      if (Date.now() < busyUntil) {
        return applyRobotState({
          ...cachedRobot,
          lastSeen: cachedRobot.lastSeen || new Date().toISOString()
        });
      }

      return refreshWirePodStatus();
    },

    getIntegrationInfo: () => ({
      ...syncIntegration(),
      note:
        lastIntegration.note ||
        (lastIntegration.wirePodReachable ? "Connected through local WirePod." : "Vector brain offline")
    }),

    getSettings: () => getSettings(),

    updateSettings: (patch) => {
      const nextSettings = store.saveSettings(patch).settings;
      if (patch.serial) {
        store.saveRobotProfile({ selectedSerial: patch.serial });
      }
      syncIntegration();
      return nextSettings;
    },

    discoverRobots: async () => {
      if (getSettings().mockMode) {
        return fallback.discoverRobots() as DiscoveredRobot[];
      }

      try {
        const sdkInfo = await wirePod.getSdkInfo();
        syncIntegration({
          source: "wirepod",
          wirePodReachable: true,
          robotReachable: lastIntegration.robotReachable,
          note: sdkInfo.robots.length
            ? "Authenticated Vector robots were found through local WirePod."
            : "WirePod is online, but no authenticated Vector robots were found yet."
        });
        return sdkInfo.robots.map((robot) =>
          toDiscoveredRobot(robot, getProfile().aliases[robot.esn])
        );
      } catch (error) {
        syncIntegration({
          source: "wirepod",
          wirePodReachable: false,
          robotReachable: false,
          note: error instanceof Error ? error.message : "Vector brain offline"
        });
        return [];
      }
    },

    connect: async (payload) => {
      if (getSettings().mockMode) {
        const nextRobot = fallback.connect(payload) as RobotStatus;
        pushLog(
          makeLog("connect", payload ?? {}, "success", `Connected to ${nextRobot.name} in mock mode.`),
          nextRobot
        );
        return applyRobotState(nextRobot);
      }

      const nextRobot = await refreshWirePodStatus(payload);
      pushLog(
        makeLog(
          "connect",
          { ipAddress: payload?.ipAddress, serial: nextRobot.serial },
          nextRobot.isConnected ? "success" : "error",
          nextRobot.isConnected
            ? `Connected to ${nextRobot.nickname ?? nextRobot.name}.`
            : "Vector brain offline"
        ),
        nextRobot
      );
      return nextRobot;
    },

    disconnect: async () => {
      if (getSettings().mockMode) {
        const nextRobot = fallback.disconnect() as RobotStatus;
        pushLog(makeLog("disconnect", {}, "success", "Disconnected safely."), nextRobot);
        return applyRobotState(nextRobot);
      }

      const nextRobot = applyRobotState({
        ...cachedRobot,
        isConnected: false,
        isCharging: false,
        isDocked: false,
        connectionState: "disconnected",
        systemStatus: "offline",
        currentActivity: "Disconnected from local WirePod.",
        lastSeen: new Date().toISOString()
      });
      pushLog(makeLog("disconnect", {}, "success", "Disconnected safely."), nextRobot);
      return nextRobot;
    },

    drive: async ({ direction, speed, durationMs }) =>
      runMockOrThrow(
        () => fallback.drive({ direction, speed, durationMs }) as CommandLogRecord,
        `Running ${direction} drive command.`,
        async (serial, robot) => {
          const wheelSpeed = Math.round(clampNumber(speed, 10, 100) * 1.9);
          const commands =
            direction === "forward"
              ? { left: wheelSpeed, right: wheelSpeed, message: `Driving forward at ${speed}% speed.` }
              : direction === "reverse"
                ? { left: -wheelSpeed, right: -wheelSpeed, message: `Driving backward at ${speed}% speed.` }
                : direction === "left"
                  ? { left: -wheelSpeed, right: wheelSpeed, message: "Turning left." }
                  : direction === "right"
                    ? { left: wheelSpeed, right: -wheelSpeed, message: "Turning right." }
                    : { left: 0, right: 0, message: "Stop command sent." };

          if (direction === "stop") {
            await wirePod.stop(serial);
          } else {
            await wirePod.moveWheels(
              serial,
              commands.left,
              commands.right,
              durationMs && durationMs > 0 ? durationMs : undefined
            );
          }
          const message =
            robot.isDocked && direction !== "stop"
              ? `${commands.message} Vector is still on the charger, so wheel movement may stay limited until you take it off the dock.`
              : commands.message;
          return pushLog(makeLog("drive", { direction, speed, durationMs }, "success", message));
        }
      ),

    head: async ({ angle }) =>
      runMockOrThrow(
        () => fallback.head({ angle }) as CommandLogRecord,
        "Adjusting head position.",
        async (serial) => {
          const delta = angle - lastHeadAngle;
          if (Math.abs(delta) < 1) {
            return pushLog(makeLog("head", { angle }, "success", `Head already near ${angle} degrees.`));
          }

          const speed = delta > 0 ? 2 : -2;
          const durationMs = Math.min(900, Math.max(180, Math.round(Math.abs(delta) * 14)));
          await wirePod.moveHead(serial, speed, durationMs);
          lastHeadAngle = angle;
          return pushLog(makeLog("head", { angle }, "success", `Head adjusted to ${angle} degrees.`));
        }
      ),

    lift: async ({ height }) =>
      runMockOrThrow(
        () => fallback.lift({ height }) as CommandLogRecord,
        "Adjusting lift height.",
        async (serial) => {
          const delta = height - lastLiftHeight;
          if (Math.abs(delta) < 1) {
            return pushLog(makeLog("lift", { height }, "success", `Lift already near ${height}%.`));
          }

          const speed = delta > 0 ? 2 : -2;
          const durationMs = Math.min(1200, Math.max(180, Math.round(Math.abs(delta) * 10)));
          await wirePod.moveLift(serial, speed, durationMs);
          lastLiftHeight = height;
          return pushLog(makeLog("lift", { height }, "success", `Lift adjusted to ${height}%.`));
        }
      ),

    speak: async ({ text }) =>
      runMockOrThrow(
        () => fallback.speak({ text }) as CommandLogRecord,
        "Sending speech to Vector.",
        async (serial, robot) => {
          setBusy("Speaking through Vector.", 9_500);
          if (!robot.isConnected || robot.mood === "sleepy" || robot.connectionState !== "connected") {
            await wirePod.wake(serial).catch(() => undefined);
            await wait(1800);
          }
          await wirePod.sayText(serial, text);
          return pushLog(makeLog("speak", { text }, "success", `Speaking: ${text}`));
        }
      ),

    animation: async ({ animationId }) =>
      runMockOrThrow(
        () => fallback.animation({ animationId }) as CommandLogRecord,
        "Playing animation.",
        async (serial) => {
          const intent =
            animationIntentMap[animationId] ??
            (animationId.startsWith("intent_") || animationId.startsWith("explore_")
              ? animationId
              : "intent_imperative_dance");
          await wirePod.playAnimation(serial, intent);
          return pushLog(
            makeLog("animation", { animationId, intent }, "success", `Animation intent sent for ${animationId}.`)
          );
        }
      ),

    dock: async () =>
      runMockOrThrow(
        () => fallback.dock() as CommandLogRecord,
        "Returning to dock.",
        async (serial, robot) => {
          if (robot.isDocked) {
            return pushLog(
              makeLog("dock", { serial }, "success", "Vector is already on the charger."),
              applyRobotState({
                ...robot,
                isCharging: robot.isCharging,
                isDocked: true,
                mood: robot.isCharging ? "charging" : robot.mood,
                currentActivity: "Already on the charger."
              })
            );
          }

          if (robot.mood === "sleepy") {
            await wirePod.wake(serial).catch(() => undefined);
            await wait(800);
          }

          await wirePod.dock(serial);
          return pushLog(
            makeLog("dock", { serial }, "success", "Vector is returning to the charger."),
            applyRobotState({
              ...robot,
              isCharging: true,
              isDocked: true,
              mood: "charging",
              currentActivity: "Returning to the charger."
            })
          );
        }
      ),

    wake: async () =>
      runMockOrThrow(
        () => fallback.wake() as CommandLogRecord,
        "Waking Vector.",
        async (serial, robot) => {
          await wirePod.wake(serial);
          return pushLog(
            makeLog("wake", { serial }, "success", "Wake command sent."),
            applyRobotState({
              ...robot,
              isCharging: false,
              isDocked: false,
              currentActivity: "Waking up."
            })
          );
        }
      ),

    toggleMute: async ({ isMuted }) =>
      runMockOrThrow(
        () => fallback.toggleMute({ isMuted }) as CommandLogRecord,
        isMuted ? "Muting audio." : "Unmuting audio.",
        async (_serial, robot) =>
          pushLog(
            makeLog("mute", { isMuted }, "success", isMuted ? "Audio muted." : "Audio unmuted."),
            applyRobotState({
              ...robot,
              isMuted
            })
          )
      ),

    setVolume: async ({ volume }) =>
      runMockOrThrow(
        () => fallback.setVolume({ volume }) as CommandLogRecord,
        `Setting volume to ${volume}.`,
        async (serial, robot) => {
          await wirePod.setVolume(serial, volume);
          return pushLog(
            makeLog("volume", { volume }, "success", `Volume set to ${volume}.`),
            applyRobotState({
              ...robot,
              volume
            })
          );
        }
      ),

    getSnapshots: () => getSnapshots(),

    syncPhotos: async () => {
      if (getSettings().mockMode) {
        return fallback.syncPhotos() as CameraSyncResult;
      }

      return withRealRobot("Syncing robot photos.", async (serial) => {
        const remoteIds = Array.from(new Set(await wirePod.getImageIds(serial)))
          .sort((left, right) => Number(right) - Number(left))
          .slice(0, 12);
        const existingSnapshots = getSnapshots();
        const byRemoteId = new Map(
          existingSnapshots
            .filter((snapshot) => snapshot.remoteId)
            .map((snapshot) => [snapshot.remoteId as string, snapshot])
        );

        if (!remoteIds.length) {
          const note = "No saved robot photos yet. Ask Vector to take a photo, then sync again.";
          pushLog(makeLog("photo-sync", { serial, syncedCount: 0 }, "success", note));
          return {
            snapshots: existingSnapshots,
            syncedCount: 0,
            note
          } satisfies CameraSyncResult;
        }

        let syncedCount = 0;
        const syncedSnapshots: CameraSnapshotRecord[] = [];

        for (const remoteId of remoteIds) {
          const existing = byRemoteId.get(remoteId);
          if (existing) {
            syncedSnapshots.push(existing);
            continue;
          }

          const image = await wirePod.getImage(serial, remoteId, "thumb");
          syncedSnapshots.push({
            id: crypto.randomUUID(),
            remoteId,
            createdAt: new Date().toISOString(),
            label: `Vector photo ${remoteId}`,
            dataUrl: `data:${image.contentType};base64,${Buffer.from(image.buffer).toString("base64")}`,
            motionScore: 0,
            source: "wirepod"
          });
          syncedCount += 1;
        }

        const preservedLocalSnapshots = existingSnapshots.filter((snapshot) => !snapshot.remoteId);
        const snapshots = [...syncedSnapshots, ...preservedLocalSnapshots].slice(0, 12);
        store.saveSnapshots(snapshots);

        const note =
          syncedCount > 0
            ? `Synced ${syncedCount} robot photo${syncedCount === 1 ? "" : "s"} from Vector.`
            : "Photo library is already up to date.";

        pushLog(makeLog("photo-sync", { serial, syncedCount, total: snapshots.length }, "success", note));

        return {
          snapshots,
          latestSnapshot: syncedSnapshots[0],
          syncedCount,
          note
        } satisfies CameraSyncResult;
      });
    },

    capturePhoto: async () => {
      if (getSettings().mockMode) {
        return fallback.capturePhoto() as CameraSyncResult;
      }

      return withRealRobot("Capturing a robot photo.", async (serial, robot) => {
        if (robot.isDocked || robot.mood === "sleepy") {
          await wirePod.wake(serial).catch(() => undefined);
          await wait(1200);
        }

        await wirePod.takePhoto(serial);
        await wait(2500);
        const synced = await (async () => {
          const remoteIds = Array.from(new Set(await wirePod.getImageIds(serial)))
            .sort((left, right) => Number(right) - Number(left))
            .slice(0, 12);
          const existingSnapshots = getSnapshots();
          const byRemoteId = new Map(
            existingSnapshots
              .filter((snapshot) => snapshot.remoteId)
              .map((snapshot) => [snapshot.remoteId as string, snapshot])
          );

          let syncedCount = 0;
          const syncedSnapshots: CameraSnapshotRecord[] = [];

          for (const remoteId of remoteIds) {
            const existing = byRemoteId.get(remoteId);
            if (existing) {
              syncedSnapshots.push(existing);
              continue;
            }

            const image = await wirePod.getImage(serial, remoteId, "thumb");
            syncedSnapshots.push({
              id: crypto.randomUUID(),
              remoteId,
              createdAt: new Date().toISOString(),
              label: `Vector photo ${remoteId}`,
              dataUrl: `data:${image.contentType};base64,${Buffer.from(image.buffer).toString("base64")}`,
              motionScore: 0,
              source: "wirepod"
            });
            syncedCount += 1;
          }

          const preservedLocalSnapshots = existingSnapshots.filter((snapshot) => !snapshot.remoteId);
          const snapshots = [...syncedSnapshots, ...preservedLocalSnapshots].slice(0, 12);
          store.saveSnapshots(snapshots);
          return {
            snapshots,
            latestSnapshot: syncedSnapshots[0],
            syncedCount,
            note:
              syncedCount > 0
                ? `Vector captured a new photo and synced ${syncedCount} item${syncedCount === 1 ? "" : "s"}.`
                : "Vector captured the photo command, but the saved library did not change yet."
          } satisfies CameraSyncResult;
        })();

        pushLog(
          makeLog(
            "photo-capture",
            { serial, syncedCount: synced.syncedCount },
            "success",
            synced.note
          )
        );
        return synced;
      });
    },

    getAutomationControl: () => getAutomationControl(),

    getRoamSessions: () => getRoamSessions(),

    startRoam: async (automation) => {
      if (getSettings().mockMode) {
        return fallback.startRoam(automation) as RoamSessionRecord;
      }

      return withRealRobot("Starting roam automation.", async (serial, robot) => {
        const activeSession = getActiveRoamSession();
        if (activeSession && activeSession.status !== "completed") {
          throw new Error("A roam session is already active.");
        }

        const startedAt = new Date().toISOString();
        const session: RoamSessionRecord = {
          id: crypto.randomUUID(),
          name: `${automation.targetArea} roam ${getRoamSessions().length + 1}`,
          status: "running",
          behavior: automation.behavior,
          targetArea: automation.targetArea,
          startedAt,
          distanceMeters: 0,
          commandsIssued: 0,
          snapshotsTaken: 0,
          dataPointsCollected: 0,
          batteryStart: robot.batteryPercent,
          summary: robot.isDocked
            ? "Roam armed. Take Vector off the charger for wheel movement."
            : `Roam started in ${automation.behavior} mode.`,
          events: [
            {
              id: crypto.randomUUID(),
              createdAt: startedAt,
              type: "status",
              message: robot.isDocked
                ? `Roam started for ${automation.targetArea}, but Vector is still docked.`
                : `Autonomous ${automation.behavior} roam started in ${automation.targetArea}.`,
              batteryPercent: robot.batteryPercent,
              dataPointsCollected: 0
            }
          ]
        };

        saveRoamSessions([session, ...getRoamSessions()].slice(0, 24));
        saveAutomationControl({
          ...automation,
          status: "running",
          activeSessionId: session.id,
          startedAt,
          lastHeartbeatAt: startedAt
        });

        if (!robot.isDocked) {
          const wheelSpeed = automation.behavior === "quiet" ? 46 : automation.behavior === "explore" ? 70 : 58;
          await wirePod.moveWheels(serial, wheelSpeed, wheelSpeed, automation.behavior === "quiet" ? 380 : 620);
        }

        pushLog(
          makeLog("automation-start", { sessionId: session.id, behavior: automation.behavior }, "success", session.summary)
        );
        return session;
      });
    },

    pauseRoam: async () => {
      if (getSettings().mockMode) {
        return fallback.pauseRoam() as RoamSessionRecord;
      }

      const activeSession = getActiveRoamSession();
      if (!activeSession) {
        throw new Error("There is no active roam session to pause.");
      }

      await withRealRobot("Pausing roam automation.", async (serial) => {
        await wirePod.stop(serial);
      });

      const nextSession: RoamSessionRecord = {
        ...activeSession,
        status: "paused",
        summary: "Roam paused."
      };
      saveRoamSessions(getRoamSessions().map((session) => (session.id === activeSession.id ? nextSession : session)));
      saveAutomationControl({
        status: "paused",
        lastHeartbeatAt: new Date().toISOString()
      });
      pushLog(makeLog("automation-pause", { sessionId: activeSession.id }, "success", `${activeSession.name} paused.`));
      return nextSession;
    },

    resumeRoam: async () => {
      if (getSettings().mockMode) {
        return fallback.resumeRoam() as RoamSessionRecord;
      }

      const activeSession = getActiveRoamSession();
      if (!activeSession) {
        throw new Error("There is no paused roam session to resume.");
      }

      const nextSession: RoamSessionRecord = {
        ...activeSession,
        status: "running",
        summary: "Roam resumed."
      };

      saveRoamSessions(getRoamSessions().map((session) => (session.id === activeSession.id ? nextSession : session)));
      saveAutomationControl({
        status: "running",
        lastHeartbeatAt: new Date().toISOString()
      });
      pushLog(makeLog("automation-resume", { sessionId: activeSession.id }, "success", `${activeSession.name} resumed.`));
      return nextSession;
    },

    stopRoam: async () => {
      if (getSettings().mockMode) {
        return fallback.stopRoam() as RoamSessionRecord;
      }

      const activeSession = getActiveRoamSession();
      if (!activeSession) {
        throw new Error("There is no roam session to stop.");
      }

      const robot = await refreshWirePodStatus();
      const endedAt = new Date().toISOString();

      if (robot.isConnected && robot.serial) {
        await wirePod.stop(robot.serial).catch(() => undefined);
      }

      const nextSession: RoamSessionRecord = {
        ...activeSession,
        status: "completed",
        endedAt,
        batteryEnd: robot.batteryPercent,
        summary: "Roam finished and the session was stored locally."
      };

      saveRoamSessions(getRoamSessions().map((session) => (session.id === activeSession.id ? nextSession : session)));
      saveAutomationControl({
        status: "idle",
        activeSessionId: undefined,
        lastHeartbeatAt: endedAt
      });
      pushLog(makeLog("automation-stop", { sessionId: activeSession.id }, "success", `${activeSession.name} stopped and stored locally.`));
      return nextSession;
    },

    getCameraStreamUrl: async () => {
      if (getSettings().mockMode) {
        return fallback.getCameraStreamUrl();
      }

      const robot = await refreshWirePodStatus();
      const serial =
        robot.serial ||
        cachedRobot.serial ||
        getSettings().serial ||
        getProfile().selectedSerial ||
        lastIntegration.selectedSerial;

      if (!serial || !robot.cameraAvailable || !lastIntegration.wirePodReachable) {
        return undefined;
      }

      return wirePod.getCameraStreamUrl(serial);
    },

    getPhotoImage: async (photoId, variant = "full") => {
      if (getSettings().mockMode) {
        return fallback.getPhotoImage(photoId, variant) as CameraImageAsset;
      }

      const robot = await refreshWirePodStatus();
      const serial =
        robot.serial ||
        cachedRobot.serial ||
        getSettings().serial ||
        getProfile().selectedSerial ||
        lastIntegration.selectedSerial;

      if (!serial) {
        throw new Error("No robot serial is saved yet.");
      }

      if (!lastIntegration.wirePodReachable) {
        throw new Error("Vector brain offline");
      }

      return wirePod.getImage(serial, photoId, variant) as Promise<CameraImageAsset>;
    },

    deletePhoto: async (photoId) => {
      if (getSettings().mockMode) {
        return fallback.deletePhoto(photoId) as CameraSyncResult;
      }

      const robot = await refreshWirePodStatus();
      const serial =
        robot.serial ||
        cachedRobot.serial ||
        getSettings().serial ||
        getProfile().selectedSerial ||
        lastIntegration.selectedSerial;

      if (!serial) {
        throw new Error("No robot serial is saved yet.");
      }

      const existingSnapshots = getSnapshots();
      const targetSnapshot = existingSnapshots.find(
        (snapshot) => snapshot.id === photoId || snapshot.remoteId === photoId
      );

      if (!targetSnapshot) {
        throw new Error("That photo could not be found.");
      }

      if (targetSnapshot.remoteId && lastIntegration.wirePodReachable) {
        await wirePod.deleteImage(serial, targetSnapshot.remoteId);
      }

      const snapshots = existingSnapshots.filter((snapshot) => snapshot.id !== targetSnapshot.id);
      store.saveSnapshots(snapshots);
      pushLog(
        makeLog(
          "photo-delete",
          { photoId: targetSnapshot.remoteId ?? targetSnapshot.id },
          "success",
          "Photo deleted from the app library."
        )
      );

      return {
        snapshots,
        latestSnapshot: snapshots[0],
        syncedCount: 1,
        note: "Photo deleted from the app library."
      } satisfies CameraSyncResult;
    },

    getVoiceDiagnostics: async () => {
      if (getSettings().mockMode) {
        return fallback.getVoiceDiagnostics() as VoiceDiagnosticsRecord;
      }

      const robot = await refreshWirePodStatus();
      return buildCurrentVoiceDiagnostics(robot);
    },

    repairVoiceSetup: async () =>
      runMockOrThrow(
        () => fallback.repairVoiceSetup() as CommandLogRecord,
        "Refreshing WirePod voice defaults.",
        async (serial, robot) => {
          const targetVolume = await refreshVoiceDefaultsInline(serial, robot);

          return pushLog(
            makeLog(
              "voice-repair",
              { serial, locale: "en-US", wakeWordMode: "Hey Vector", volume: targetVolume },
              "success",
              "Re-applied WirePod voice defaults: Hey Vector button mode, English (US), and speaker volume."
            ),
            applyRobotState({
              ...robot,
              volume: targetVolume,
              currentActivity: "Voice setup refreshed."
            })
          );
        }
      ),

    getWirePodSetupStatus: async (): Promise<WirePodSetupStatusRecord> =>
      getCurrentWirePodSetupStatus(),

    finishWirePodSetup: async ({
      language,
      connectionMode,
      port
    }): Promise<WirePodSetupStatusRecord> => {
      if (getSettings().mockMode) {
        return fallback.finishWirePodSetup({
          language,
          connectionMode,
          port
        }) as WirePodSetupStatusRecord;
      }

      await wirePod.finishInitialSetup({
        language: language?.trim() || "en-US",
        connectionMode: connectionMode || "escape-pod",
        port: port?.trim() || "443"
      });
      await wait(1_000);
      await refreshWirePodStatus();

      return getCurrentWirePodSetupStatus();
    },

    getWirePodWeatherConfig: async (): Promise<WirePodWeatherConfigRecord> => {
      if (getSettings().mockMode) {
        return fallback.getWirePodWeatherConfig() as WirePodWeatherConfigRecord;
      }

      try {
        return await wirePod.getWeatherApiConfig();
      } catch {
        return {
          enable: false,
          provider: "",
          key: "",
          unit: ""
        };
      }
    },

    setWirePodWeatherConfig: async ({ provider, key, unit }): Promise<WirePodWeatherConfigRecord> => {
      if (getSettings().mockMode) {
        return fallback.setWirePodWeatherConfig({ provider, key, unit }) as WirePodWeatherConfigRecord;
      }

      return wirePod.setWeatherApiConfig({
        provider: provider.trim(),
        key: key.trim(),
        unit: unit?.trim()
      });
    },

    quickRepair: async () => runQuickRepair(),

    getSupportReports: () => getSupportReports(),

    getAiMemory: () => getAiMemory(),

    saveAiMemory: async ({ key, value }) => {
      const nextMemory = mergeAiMemory(getAiMemory(), key, value);
      store.saveAiMemory(nextMemory);
      pushLog(
        makeLog(
          "ai-memory-save",
          { key },
          "success",
          `Saved AI memory for ${key}.`
        )
      );
      return nextMemory;
    },

    getCommandGaps: () => getCommandGaps(),

    recordCommandGap: async (payload) => saveCommandGap(payload),

    reportProblem: async ({ summary, details, contactEmail }) => {
      const repairResult = await runQuickRepair();
      const robot = await refreshWirePodStatus();
      const supportReport: SupportReportRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        summary: summary.trim(),
        details: details.trim(),
        contactEmail: contactEmail?.trim() || undefined,
        robotName: robot.nickname ?? robot.name,
        integrationNote: lastIntegration.note,
        repairResult
      };

      store.saveSupportReports([supportReport, ...getSupportReports()]);
      pushLog(
        makeLog(
          "support-report",
          { reportId: supportReport.id, summary: supportReport.summary },
          "success",
          "Problem report saved locally with the latest repair attempt."
        )
      );

      return supportReport;
    },

    runDiagnostics: async () => {
      if (getSettings().mockMode) {
        const report = fallback.runDiagnostics() as DiagnosticReportRecord;
        pushLog(makeLog("diagnostics", { mode: "mock" }, "success", report.summary));
        return report;
      }

      const robot = await refreshWirePodStatus();
      const voiceDiagnostics = await buildCurrentVoiceDiagnostics(robot);
      const successLog = latestSuccessfulCommand();
      const failedLog = latestFailedCommand();
      const troubleshooting = Array.from(
        new Set([...buildTroubleshooting(), ...voiceDiagnostics.troubleshooting])
      );
      const voiceCheckStatus =
        voiceDiagnostics.status === "healthy"
          ? "pass"
          : voiceDiagnostics.status === "attention"
            ? "warn"
            : "fail";
      const checks: DiagnosticCheckRecord[] = [
        {
          id: crypto.randomUUID(),
          label: "WirePod endpoint",
          category: "network" as const,
          status: lastIntegration.wirePodReachable ? "pass" : "fail",
          metric: lastIntegration.wirePodBaseUrl,
          details: lastIntegration.wirePodReachable
            ? "WirePod responded to the local health probe."
            : "WirePod did not respond. The app will show Vector brain offline until it comes back."
        },
        {
          id: crypto.randomUUID(),
          label: "Robot connectivity",
          category: "network" as const,
          status: robot.isConnected ? "pass" : "warn",
          metric: robot.isConnected ? "Online" : "Offline",
          details: robot.isConnected
            ? "Vector responded through the local WirePod bridge."
            : lastIntegration.note || "WirePod is online, but the robot is not reachable yet."
        },
        {
          id: crypto.randomUUID(),
          label: "Battery",
          category: "power" as const,
          status: robot.batteryPercent > 20 ? "pass" : "warn",
          metric: `${robot.batteryPercent}%`,
          details: robot.isCharging
            ? "Vector is currently charging on the dock."
            : robot.batteryPercent > 20
              ? "Battery is healthy enough for local movement."
              : "Battery is low. Dock soon."
        },
        {
          id: crypto.randomUUID(),
          label: "Last successful command",
          category: "motion" as const,
          status: successLog ? "pass" : "warn",
          metric: successLog?.type ?? "None yet",
          details: successLog?.resultMessage ?? "No successful commands have been logged yet."
        },
        {
          id: crypto.randomUUID(),
          label: "Last failed command",
          category: "audio" as const,
          status: failedLog ? "warn" : "pass",
          metric: failedLog?.type ?? "None",
          details: failedLog?.resultMessage ?? "No recent failed commands."
        },
        {
          id: crypto.randomUUID(),
          label: "Wake word",
          category: "audio" as const,
          status:
            voiceDiagnostics.wakeWordMode === "hey-vector"
              ? "pass"
              : voiceDiagnostics.wakeWordMode === "unknown"
                ? "warn"
                : "fail",
          metric:
            voiceDiagnostics.wakeWordMode === "hey-vector"
              ? "Hey Vector"
              : voiceDiagnostics.wakeWordMode === "alexa"
                ? "Alexa"
                : "Unknown",
          details:
            voiceDiagnostics.wakeWordMode === "hey-vector"
              ? "The robot is configured to listen for Hey Vector."
              : "The wake-word mode should be switched back to Hey Vector for normal testing."
        },
        {
          id: crypto.randomUUID(),
          label: "Speech locale",
          category: "audio" as const,
          status: /^en(-|$)/i.test(voiceDiagnostics.locale) ? "pass" : "warn",
          metric: voiceDiagnostics.locale,
          details: /^en(-|$)/i.test(voiceDiagnostics.locale)
            ? "English locale is enabled for voice commands."
            : "Switch to English (US) first if voice commands are inconsistent."
        },
        {
          id: crypto.randomUUID(),
          label: "Speaker volume",
          category: "audio" as const,
          status:
            voiceDiagnostics.volume === 0
              ? "fail"
              : voiceDiagnostics.volume < 3
                ? "warn"
                : "pass",
          metric: `${voiceDiagnostics.volume}/5`,
          details:
            voiceDiagnostics.volume === 0
              ? "The speaker is muted, so spoken replies will seem broken."
              : voiceDiagnostics.volume < 3
                ? "Voice testing is easier at volume 4 or 5."
                : "Volume is high enough to hear spoken replies clearly."
        },
        {
          id: crypto.randomUUID(),
          label: "Voice pipeline",
          category: "audio" as const,
          status: voiceCheckStatus,
          metric: voiceDiagnostics.lastIntent ?? "No recent intent",
          details: voiceDiagnostics.summary
        },
        {
          id: crypto.randomUUID(),
          label: "Local logs",
          category: "storage" as const,
          status: getLogs().length > 0 ? "pass" : "warn",
          metric: `${getLogs().length} records`,
          details: "The app keeps a rolling local log to help with troubleshooting."
        }
      ];

      const report: DiagnosticReportRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        overallStatus: checks.some((check) => check.status === "fail")
          ? "critical"
          : checks.some((check) => check.status === "warn")
            ? "attention"
            : "healthy",
        summary:
          !lastIntegration.wirePodReachable
            ? "Vector brain offline."
            : robot.isConnected
              ? voiceDiagnostics.status === "healthy"
                ? "Diagnostics passed with the current live robot connection."
                : "Core controls are live, but voice commands still need attention."
              : "WirePod is up, but the robot is still offline.",
        robotName: robot.nickname ?? robot.name,
        checks,
        troubleshooting
      };

      pushLog(makeLog("diagnostics", { overallStatus: report.overallStatus }, "success", report.summary));
      return report;
    },

    getRoutines: () => getRoutines(),

    saveRoutine: (routine) => {
      const nextRoutines = [routine, ...getRoutines().filter((item) => item.id !== routine.id)];
      saveRoutines(nextRoutines);
      pushLog(makeLog("routine-save", { routineId: routine.id }, "success", `Saved routine ${routine.name}.`));
      return routine;
    },

    updateRoutine: (routineId, patch) => {
      const existing = getRoutines().find((item) => item.id === routineId);
      if (!existing) {
        return undefined;
      }

      const nextRoutine = { ...existing, ...patch };
      saveRoutines(getRoutines().map((item) => (item.id === routineId ? nextRoutine : item)));
      pushLog(makeLog("routine-update", { routineId }, "success", `Updated routine ${nextRoutine.name}.`));
      return nextRoutine;
    },

    deleteRoutine: (routineId) => {
      const nextRoutines = getRoutines().filter((item) => item.id !== routineId);
      const changed = nextRoutines.length !== getRoutines().length;
      if (changed) {
        saveRoutines(nextRoutines);
        pushLog(makeLog("routine-delete", { routineId }, "success", `Deleted routine ${routineId}.`));
      }
      return changed;
    },

    getLogs: () => getLogs()
  };
};
