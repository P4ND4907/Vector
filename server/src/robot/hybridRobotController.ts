import { Buffer } from "node:buffer";
import { buildOfflineRobot, createLocalStore } from "../db/localStore.js";
import {
  inferSuggestedArea,
  isRecentDuplicateGap,
  normalizeCommandPrompt
} from "../services/commandGapService.js";
import { saveAiMemory as mergeAiMemory } from "../services/aiBrainService.js";
import {
  deleteLearnedCommand as removeLearnedCommand,
  upsertLearnedCommand
} from "../services/learnedCommandsService.js";
import {
  buildChargingProtectionMessage,
  CHARGING_PROTECTION_RELEASE_PERCENT,
  isAnimationSafeWhileCharging,
  isChargingProtectionActive
} from "../services/chargingProtectionService.js";
import { buildBridgeWatchdogStatus } from "../services/bridgeWatchdogService.js";
import { createLocalRepairService } from "../services/localRepairService.js";
import {
  createLocalRobotBridgeService,
  batteryVoltageToPercent
} from "../services/localRobotBridge.js";
import { createLocalBridgeManager } from "../services/localBridgeManager.js";
import { buildVoiceDiagnostics } from "../services/voiceDiagnosticsService.js";
import { buildWirePodSetupStatus } from "../services/wirepodSetupService.js";
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
import { pickRobotSerial, sanitizeRobotSerial } from "./serials.js";
import type {
  AutomationControlRecord,
  CameraImageAsset,
  CameraSnapshotRecord,
  CameraSyncResult,
  BridgeWatchdogStatusRecord,
  CommandGapRecord,
  CommandLogRecord,
  DiagnosticCheckRecord,
  DiagnosticReportRecord,
  DiscoveredRobot,
  RepairResultRecord,
  RepairStepRecord,
  RobotController,
  RobotIntegrationInfo,
  RoamEventRecord,
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
  const managedBridge = createLocalBridgeManager({
    endpoint: options.wirePodBaseUrl
  });

  let lastIntegration: RobotIntegrationInfo = {
    source: store.getState().settings.mockMode ? "mock" : "wirepod",
    wirePodReachable: false,
    wirePodBaseUrl: store.getState().settings.savedWirePodEndpoint || options.wirePodBaseUrl,
    bridgeProvider: "wirepod",
    bridgeLabel: "WirePod compatibility bridge",
    bridgeReachable: false,
    bridgeBaseUrl: store.getState().settings.savedWirePodEndpoint || options.wirePodBaseUrl,
    managedBridge: managedBridge.getCachedStatus(),
    note: store.getState().settings.mockMode ? "Mock mode is active." : "Local bridge offline",
    robotReachable: false,
    mockMode: store.getState().settings.mockMode,
    autoDetectEnabled: store.getState().settings.autoDetectWirePod,
    reconnectOnStartup: store.getState().settings.reconnectOnStartup,
    customEndpoint: store.getState().settings.customWirePodEndpoint || undefined,
    lastCheckedAt: new Date().toISOString(),
    probes: []
  };

  const wirePod = createLocalRobotBridgeService({
    initialEndpoint: store.getState().settings.savedWirePodEndpoint || options.wirePodBaseUrl,
    timeoutMs: options.wirePodTimeoutMs,
    getSettings: () => store.getState().settings,
    beforeDetectEndpoints: async () => {
      await managedBridge.ensureRunning().catch(() => managedBridge.getCachedStatus());
    },
    getManagedBridgeStatus: () => managedBridge.getCachedStatus(),
    onEndpointResolved: (endpoint, probes) => {
      const currentState = store.getState();
      store.saveSettings({ savedWirePodEndpoint: endpoint });
      lastIntegration = {
        ...lastIntegration,
        source: currentState.settings.mockMode ? "mock" : "wirepod",
        wirePodReachable: true,
        wirePodBaseUrl: endpoint,
        bridgeProvider: wirePod.provider,
        bridgeLabel: wirePod.label,
        bridgeReachable: true,
        bridgeBaseUrl: endpoint,
        mockMode: currentState.settings.mockMode,
        autoDetectEnabled: currentState.settings.autoDetectWirePod,
        reconnectOnStartup: currentState.settings.reconnectOnStartup,
        customEndpoint: currentState.settings.customWirePodEndpoint || undefined,
        lastCheckedAt: new Date().toISOString(),
        probes,
        managedBridge: managedBridge.getCachedStatus(),
        note:
          managedBridge.getCachedStatus().source === "bundled"
            ? "Bundled local bridge detected."
            : `${wirePod.label} detected.`
      };
    },
    onEndpointFailure: (probes, error) => {
      const currentState = store.getState();
      lastIntegration = {
        ...lastIntegration,
        source: currentState.settings.mockMode ? "mock" : "wirepod",
        wirePodReachable: false,
        bridgeProvider: wirePod.provider,
        bridgeLabel: wirePod.label,
        bridgeReachable: false,
        bridgeBaseUrl:
          wirePod.getActiveEndpoint() ||
          currentState.settings.savedWirePodEndpoint ||
          options.wirePodBaseUrl,
        robotReachable: false,
        mockMode: currentState.settings.mockMode,
        autoDetectEnabled: currentState.settings.autoDetectWirePod,
        reconnectOnStartup: currentState.settings.reconnectOnStartup,
        customEndpoint: currentState.settings.customWirePodEndpoint || undefined,
        lastCheckedAt: new Date().toISOString(),
        probes,
        managedBridge: managedBridge.getCachedStatus(),
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
  const getLearnedCommands = () => store.getState().learnedCommands;
  const getCommandGaps = () => store.getState().commandGaps;
  const getAutomationControl = () => store.getState().automationControl;
  const getRoamSessions = () => store.getState().roamSessions;
  const getSelectedSerial = () =>
    pickRobotSerial(
      getSettings().serial,
      cachedRobot.serial,
      getProfile().selectedSerial,
      lastIntegration.selectedSerial
    );

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

  const chargingProtectionEnabled = (robot: RobotStatus) =>
    isChargingProtectionActive(getSettings(), robot, cachedRobot);

  const applyChargingSafeState = (robot: RobotStatus, currentActivity: string) =>
    applyRobotState({
      ...robot,
      isCharging: robot.isCharging || cachedRobot.isCharging,
      isDocked: robot.isDocked || cachedRobot.isDocked,
      mood: robot.isCharging || cachedRobot.isCharging ? "charging" : robot.mood,
      currentActivity,
      lastSeen: new Date().toISOString()
    });

  const selectSerial = (...values: Array<string | undefined>) => pickRobotSerial(...values);

  const blockWhileCharging = (
    type: string,
    payload: Record<string, unknown>,
    robot: RobotStatus,
    actionLabel: string,
    currentActivity = "Staying on the charger until nearly full."
  ) => {
    busyUntil = 0;
    busyActivity = currentActivity;
    return pushLog(
      makeLog(type, payload, "success", buildChargingProtectionMessage(actionLabel)),
      applyChargingSafeState(robot, currentActivity)
    );
  };

  const buildOfflineFromCached = (message: string) =>
    applyRobotState({
      ...buildOfflineRobot(getProfile(), message, "wirepod"),
      batteryPercent: cachedRobot.batteryPercent,
      isCharging: cachedRobot.isCharging,
      isDocked: cachedRobot.isDocked,
      mood: cachedRobot.isCharging ? "charging" : "sleepy",
      currentActivity: cachedRobot.isCharging
        ? "Charging safely while the local bridge is offline."
        : message
    });

  const buildFallbackDiscoveredRobots = (): DiscoveredRobot[] => {
    const settings = getSettings();
    const profile = getProfile();
    const serial = selectSerial(
      settings.serial,
      profile.selectedSerial,
      cachedRobot.serial,
      lastIntegration.selectedSerial
    );

    if (!serial) {
      return [];
    }

    const alias = profile.aliases[serial] || cachedRobot.nickname || cachedRobot.name;

    return [
      {
        id: serial,
        serial,
        name: buildWirePodRobotName(serial, alias),
        ipAddress:
          cachedRobot.ipAddress && cachedRobot.ipAddress !== "Unavailable"
            ? cachedRobot.ipAddress
            : "Unavailable",
        signalStrength: cachedRobot.wifiStrength || 0,
        secure: true,
        activated: true,
        lastSeen: cachedRobot.lastSeen || new Date().toISOString()
      }
    ];
  };

  const rememberSelectedRobot = (serial: string, alias?: string, token?: string) => {
    store.saveRobotProfile({
      selectedSerial: serial,
      aliases: alias ? { [serial]: alias } : {},
      token: token || getProfile().token
    });
    store.saveSettings({ serial });
    syncIntegration({ selectedSerial: serial });
  };

  const resolveAutoSelectedRobot = (robots: Array<{ esn: string; activated: boolean; ip_address: string }>) => {
    const selectedSerial = selectSerial(
      getSettings().serial,
      getProfile().selectedSerial,
      cachedRobot.serial,
      lastIntegration.selectedSerial
    );

    if (selectedSerial) {
      return robots.find((robot) => robot.esn === selectedSerial);
    }

    const uniqueRobots = Array.from(
      new Map(
        robots
          .filter((robot) => sanitizeRobotSerial(robot.esn))
          .map((robot) => [robot.esn, robot])
      ).values()
    );

    if (uniqueRobots.length === 1) {
      return uniqueRobots[0];
    }

    const activatedRobots = uniqueRobots.filter((robot) => robot.activated);
    if (activatedRobots.length === 1) {
      return activatedRobots[0];
    }

    const reachableRobots = uniqueRobots.filter((robot) => Boolean(robot.ip_address));
    if (reachableRobots.length === 1) {
      return reachableRobots[0];
    }

    return undefined;
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
      currentActivity: isConnected ? "Ready for commands." : "Local bridge offline"
    });
  };

  const syncIntegration = (patch?: Partial<RobotIntegrationInfo>) => {
    const settings = getSettings();
    const resolvedBridgeBaseUrl =
      patch?.bridgeBaseUrl ||
      patch?.wirePodBaseUrl ||
      wirePod.getActiveEndpoint() ||
      settings.savedWirePodEndpoint ||
      options.wirePodBaseUrl;

    lastIntegration = {
      ...lastIntegration,
      source: settings.mockMode ? "mock" : "wirepod",
      mockMode: settings.mockMode,
      autoDetectEnabled: settings.autoDetectWirePod,
      reconnectOnStartup: settings.reconnectOnStartup,
      customEndpoint: settings.customWirePodEndpoint || undefined,
      wirePodBaseUrl: resolvedBridgeBaseUrl,
      bridgeProvider: patch?.bridgeProvider || lastIntegration.bridgeProvider || wirePod.provider,
      bridgeLabel: patch?.bridgeLabel || lastIntegration.bridgeLabel || wirePod.label,
      bridgeReachable:
        patch?.bridgeReachable ?? patch?.wirePodReachable ?? lastIntegration.bridgeReachable ?? false,
      bridgeBaseUrl: resolvedBridgeBaseUrl,
      lastCheckedAt: new Date().toISOString(),
      managedBridge: managedBridge.getCachedStatus(),
      probes: wirePod.getLastProbes(),
      ...patch
    };
    lastIntegration.selectedSerial = sanitizeRobotSerial(lastIntegration.selectedSerial);
    lastIntegration.bridgeProvider = lastIntegration.bridgeProvider || wirePod.provider;
    lastIntegration.bridgeLabel = lastIntegration.bridgeLabel || wirePod.label;
    lastIntegration.bridgeReachable = lastIntegration.bridgeReachable ?? lastIntegration.wirePodReachable;
    lastIntegration.bridgeBaseUrl = lastIntegration.bridgeBaseUrl || lastIntegration.wirePodBaseUrl;

    if (!patch?.note) {
      if (settings.mockMode) {
        lastIntegration.note = "Mock mode is active.";
      } else if (lastIntegration.note === "Mock mode is active.") {
        lastIntegration.note = lastIntegration.robotReachable
          ? "Connected through the local bridge."
          : "Local bridge offline";
      }
    }

    return lastIntegration;
  };

  const buildTroubleshooting = () => {
    const suggestions: string[] = [];
    if (getSettings().mockMode) {
      suggestions.push("Mock mode is on. Turn it off in Settings to talk to the real robot.");
    }
    if (!lastIntegration.wirePodReachable) {
      suggestions.push("Local bridge offline. Make sure the local bridge is running on this computer.");
      suggestions.push("Open http://127.0.0.1:8080 on this PC to confirm the local bridge server is alive.");
      if (lastIntegration.managedBridge.available) {
        suggestions.push("A bundled local bridge is available. The app will try to start it automatically when needed.");
      }
    }
    if (lastIntegration.wirePodReachable && !lastIntegration.robotReachable) {
      suggestions.push("The local bridge is online, but Vector is not responding on local Wi-Fi yet.");
      suggestions.push("If Vector just restarted, wait a moment and try reconnect again.");
      suggestions.push("Make sure Vector and this PC are on the same local Wi-Fi and not on a guest or isolated network.");
      suggestions.push("If disconnects keep returning, reserve a static IP for Vector in your router.");
      suggestions.push("If setup stalls right after Bluetooth pairing, mDNS or local-name discovery may be blocked by the router.");
    }
    if (!getSettings().serial) {
      suggestions.push("No serial is saved yet. Scan for robots or enter the serial in Settings.");
    }
    if (cachedRobot.isDocked && !cachedRobot.isCharging && cachedRobot.batteryPercent < CHARGING_PROTECTION_RELEASE_PERCENT) {
      suggestions.push("Vector is docked but not actively charging. Reseat him on the charger and clean the charging contacts if this keeps happening.");
    }
    if (getSettings().protectChargingUntilFull && (cachedRobot.isCharging || cachedRobot.isDocked)) {
      suggestions.push(
        `Charging protection is on. Wake, drive, roam, and bigger movement routines stay blocked until Vector is around ${CHARGING_PROTECTION_RELEASE_PERCENT}% or you turn that setting off.`
      );
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

  const getCurrentBridgeWatchdogStatus = async (): Promise<BridgeWatchdogStatusRecord> => {
    if (getSettings().mockMode) {
      return fallback.getBridgeWatchdogStatus() as BridgeWatchdogStatusRecord;
    }

    let debugLogsText = "";
    try {
      debugLogsText = await wirePod.getDebugLogs();
    } catch {
      debugLogsText = "";
    }

    return buildBridgeWatchdogStatus({
      integration: syncIntegration(),
      managedBridge: managedBridge.getCachedStatus(),
      debugLogs: debugLogsText,
      selectedSerial: getSelectedSerial(),
      autoRecoveryAvailable: managedBridge.getCachedStatus().available || localRepair.hasKnownInstall()
    });
  };

  const getCurrentWirePodSetupStatus = async (): Promise<WirePodSetupStatusRecord> => {
    if (getSettings().mockMode) {
      return fallback.getWirePodSetupStatus() as WirePodSetupStatusRecord;
    }

    await managedBridge.refreshStatus().catch(() => managedBridge.getCachedStatus());

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
        sdkInfo,
        savedSerial: getSelectedSerial()
      });
    } catch {
      return buildWirePodSetupStatus({
        reachable: false,
        savedSerial: getSelectedSerial()
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

    await managedBridge.refreshStatus().catch(() => managedBridge.getCachedStatus());

    try {
      const sdkInfo = await wirePod.getSdkInfo();
      const robots = sdkInfo.robots.filter((item) => item.activated || item.ip_address);

      if (!robots.length) {
        syncIntegration({
          source: "wirepod",
          wirePodReachable: true,
          robotReachable: false,
          note: "The local bridge is online, but no authenticated Vector robots were found."
        });
        cachedRobot = buildOfflineFromCached("Local bridge offline");
        return cachedRobot;
      }

      const settings = getSettings();
      const selectedRobot = chooseRobot({
        payload: {
          ...payload,
          serial: selectSerial(payload?.serial, settings.serial, getProfile().selectedSerial)
        },
        robots,
        selectedSerial: selectSerial(settings.serial, getProfile().selectedSerial)
      });

      if (!selectedRobot) {
        cachedRobot = buildOfflineFromCached("Local bridge offline");
        return cachedRobot;
      }

      const alias = payload?.nickname || payload?.name || getProfile().aliases[selectedRobot.esn];
      rememberSelectedRobot(selectedRobot.esn, alias, payload?.token);

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
          note:
            managedBridge.getCachedStatus().source === "bundled"
              ? "Connected through the bundled local bridge."
              : "Connected through the local bridge."
        });
        return nextRobot;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Local bridge offline";
        const nextRobot = buildRealRobot({
          alias,
          serial: selectedRobot.esn,
          ipAddress: selectedRobot.ip_address || payload?.ipAddress || "Unavailable",
          batteryPercent: cachedRobot.batteryPercent || 0,
          isCharging: cachedRobot.isCharging,
          isDocked: cachedRobot.isDocked,
          isConnected: false
        });

        syncIntegration({
          source: "wirepod",
          wirePodReachable: true,
          robotReachable: false,
          selectedSerial: selectedRobot.esn,
          note: message || "The local bridge is online, but Vector is not responding right now."
        });
        return nextRobot;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Local bridge offline";
      const wirePodReachable = Boolean(wirePod.getActiveEndpoint());
      const fallbackSerial = selectSerial(
        payload?.serial,
        getSettings().serial,
        getProfile().selectedSerial,
        cachedRobot.serial,
        lastIntegration.selectedSerial
      );
      syncIntegration({
        source: "wirepod",
        wirePodReachable,
        robotReachable: false,
        selectedSerial: fallbackSerial,
        note: wirePodReachable
          ? "The local bridge is online, but the robot routes are not responding. Try Quick repair or restart the desktop service."
          : message || "Local bridge offline"
      });
      cachedRobot = applyRobotState({
        ...buildOfflineRobot(
          {
            ...getProfile(),
            selectedSerial: fallbackSerial || getProfile().selectedSerial
          },
          message,
          "wirepod"
        ),
        batteryPercent: cachedRobot.batteryPercent,
        isCharging: cachedRobot.isCharging,
        isDocked: cachedRobot.isDocked,
        lastSeen: cachedRobot.lastSeen || new Date().toISOString(),
        currentActivity: "WirePod answered, but the robot SDK routes timed out."
      });
      return cachedRobot;
    }
  };

  const withRealRobot = async <T>(
    activity: string,
    action: (serial: string, robot: RobotStatus) => Promise<T>
  ) => {
    const robot = await refreshWirePodStatus();
    const fallbackSerial = selectSerial(
      robot.serial,
      cachedRobot.serial,
      getSettings().serial,
      getProfile().selectedSerial,
      lastIntegration.selectedSerial
    );

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
      throw new Error(lastIntegration.note || "Local bridge offline");
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

  const AUTOMATION_EVENT_LIMIT = 18;
  const automationHeartbeatIntervalMs = {
    patrol: 14_000,
    explore: 11_000,
    quiet: 18_000
  } as const satisfies Record<AutomationControlRecord["behavior"], number>;
  let automationHeartbeatRunning = false;

  const roundMetric = (value: number) => Math.round(value * 100) / 100;

  const pushRoamEvent = (
    session: RoamSessionRecord,
    event: RoamEventRecord,
    summary: string
  ): RoamSessionRecord => ({
    ...session,
    summary,
    events: [event, ...session.events].slice(0, AUTOMATION_EVENT_LIMIT)
  });

  const updateActiveRoamSession = (
    sessionId: string,
    updater: (session: RoamSessionRecord) => RoamSessionRecord
  ) => {
    let updatedSession: RoamSessionRecord | undefined;
    const nextSessions = getRoamSessions().map((session) => {
      if (session.id !== sessionId) {
        return session;
      }

      updatedSession = updater(session);
      return updatedSession;
    });
    saveRoamSessions(nextSessions);
    return updatedSession;
  };

  const runAutomationHeartbeat = async (robotOverride?: RobotStatus) => {
    const automation = getAutomationControl();
    const activeSession = getActiveRoamSession();

    if (
      getSettings().mockMode ||
      automation.status !== "running" ||
      !activeSession ||
      activeSession.status !== "running"
    ) {
      return robotOverride ?? cachedRobot;
    }

    const lastHeartbeatMs = new Date(automation.lastHeartbeatAt || activeSession.startedAt).getTime();
    const intervalMs = automationHeartbeatIntervalMs[automation.behavior];
    if (Number.isFinite(lastHeartbeatMs) && Date.now() - lastHeartbeatMs < intervalMs) {
      return robotOverride ?? cachedRobot;
    }

    if (automationHeartbeatRunning) {
      return robotOverride ?? cachedRobot;
    }

    automationHeartbeatRunning = true;

    try {
      const nowIso = new Date().toISOString();
      let robot = robotOverride ?? (await refreshWirePodStatus());
      const serial = selectSerial(
        robot.serial,
        cachedRobot.serial,
        getSettings().serial,
        getProfile().selectedSerial,
        lastIntegration.selectedSerial
      );
      const baseDataGain = automation.dataCollectionEnabled
        ? automation.behavior === "explore"
          ? 4
          : 3
        : 0;

      if (!serial || !lastIntegration.wirePodReachable) {
        const summary = "Autonomy is waiting for the local bridge to respond.";
        const event: RoamEventRecord = {
          id: crypto.randomUUID(),
          createdAt: nowIso,
          type: "status",
          message: "Roam heartbeat paused because the local backend is not reachable.",
          batteryPercent: robot.batteryPercent,
          dataPointsCollected: activeSession.dataPointsCollected
        };
        updateActiveRoamSession(activeSession.id, (session) =>
          pushRoamEvent(session, event, summary)
        );
        saveAutomationControl({ lastHeartbeatAt: nowIso });
        return applyRobotState({
          ...robot,
          currentActivity: summary,
          lastSeen: nowIso
        });
      }

      if (!robot.isConnected) {
        await wirePod.wake(serial).catch(() => undefined);
        await wait(900);
        robot = await refreshWirePodStatus({ serial });
      }

      if (automation.safeReturnEnabled && robot.batteryPercent <= automation.autoDockThreshold) {
        await wirePod.stop(serial).catch(() => undefined);
        await wirePod.dock(serial).catch(() => undefined);

        const summary = `Auto-return triggered at ${robot.batteryPercent}% battery.`;
        const event: RoamEventRecord = {
          id: crypto.randomUUID(),
          createdAt: nowIso,
          type: "battery",
          message: `Battery reached ${robot.batteryPercent}%. Returning to the charger automatically.`,
          batteryPercent: robot.batteryPercent,
          dataPointsCollected: activeSession.dataPointsCollected
        };

        updateActiveRoamSession(activeSession.id, (session) =>
          pushRoamEvent(
            {
              ...session,
              status: "completed",
              endedAt: nowIso,
              batteryEnd: robot.batteryPercent
            },
            event,
            summary
          )
        );
        saveAutomationControl({
          status: "idle",
          activeSessionId: undefined,
          lastHeartbeatAt: nowIso
        });
        pushLog(
          makeLog(
            "automation-auto-dock",
            {
              sessionId: activeSession.id,
              batteryPercent: robot.batteryPercent
            },
            "success",
            summary
          )
        );

        return applyRobotState({
          ...robot,
          isDocked: true,
          isCharging: true,
          mood: "charging",
          currentActivity: "Auto-returning to the charger.",
          lastSeen: nowIso
        });
      }

      if (!robot.isConnected) {
        const summary = "Autonomy is waiting for the robot connection to recover.";
        const event: RoamEventRecord = {
          id: crypto.randomUUID(),
          createdAt: nowIso,
          type: "status",
          message: "Roam heartbeat is standing by for the robot connection to come back.",
          batteryPercent: robot.batteryPercent,
          dataPointsCollected: activeSession.dataPointsCollected
        };
        updateActiveRoamSession(activeSession.id, (session) =>
          pushRoamEvent(session, event, summary)
        );
        saveAutomationControl({ lastHeartbeatAt: nowIso });
        return applyRobotState({
          ...robot,
          currentActivity: summary,
          lastSeen: nowIso
        });
      }

      if (robot.isDocked) {
        const dockedDataGain = baseDataGain > 0 ? Math.max(1, baseDataGain - 1) : 0;
        const summary = "Roam is armed, but Vector is still on the charger.";
        const event: RoamEventRecord = {
          id: crypto.randomUUID(),
          createdAt: nowIso,
          type: "dock",
          message: `Roam heartbeat checked ${automation.targetArea}, but Vector is still docked.`,
          batteryPercent: robot.batteryPercent,
          dataPointsCollected: activeSession.dataPointsCollected + dockedDataGain
        };
        updateActiveRoamSession(activeSession.id, (session) =>
          pushRoamEvent(
            {
              ...session,
              dataPointsCollected: session.dataPointsCollected + dockedDataGain
            },
            event,
            summary
          )
        );
        saveAutomationControl({ lastHeartbeatAt: nowIso });
        return applyRobotState({
          ...robot,
          currentActivity: summary,
          lastSeen: nowIso
        });
      }

      const stepIndex = activeSession.commandsIssued % 4;
      let eventType: RoamEventRecord["type"] = "movement";
      let summary = "";
      let distanceGain = 0;
      let commandGain = 1;
      let dataGain = baseDataGain;
      let snapshotGain = 0;

      if (automation.behavior === "explore") {
        if (stepIndex === 0) {
          await wirePod.moveHead(serial, 2, 180);
          await wirePod.moveWheels(serial, 72, 54, 860);
          summary = `Explore mode pushed into a new route in ${automation.targetArea}.`;
          distanceGain = 0.52;
        } else if (stepIndex === 1) {
          await wirePod.moveWheels(serial, 64, -38, 520);
          summary = "Explore mode pivoted to a fresh angle.";
          distanceGain = 0.14;
        } else if (stepIndex === 2) {
          await wirePod.moveLift(serial, 2, 160);
          await wirePod.moveHead(serial, -2, 220);
          summary = "Explore mode paused for a curious scan.";
          distanceGain = 0.05;
          eventType = "vision";
        } else {
          await wirePod.moveWheels(serial, 68, 68, 760);
          summary = `Explore mode pressed deeper into ${automation.targetArea}.`;
          distanceGain = 0.46;
        }
      } else if (automation.behavior === "quiet") {
        if (stepIndex === 0) {
          await wirePod.moveWheels(serial, 38, 38, 320);
          summary = "Quiet patrol drifted forward softly.";
          distanceGain = 0.12;
        } else if (stepIndex === 1) {
          await wirePod.moveHead(serial, 1, 140);
          await wirePod.moveHead(serial, -1, 140);
          summary = "Quiet patrol made a small lookout check.";
          distanceGain = 0.03;
          eventType = "vision";
        } else if (stepIndex === 2) {
          await wirePod.moveWheels(serial, 34, 40, 280);
          summary = "Quiet patrol adjusted course gently.";
          distanceGain = 0.1;
        } else {
          await wirePod.stop(serial).catch(() => undefined);
          summary = "Quiet patrol paused to listen.";
          distanceGain = 0;
          eventType = "status";
        }
      } else {
        if (stepIndex === 0) {
          await wirePod.moveWheels(serial, 56, 56, 620);
          summary = `Patrol sweep forward through ${automation.targetArea}.`;
          distanceGain = 0.32;
        } else if (stepIndex === 1) {
          await wirePod.moveWheels(serial, -48, 48, 420);
          summary = `Patrol pivoted left to re-check ${automation.targetArea}.`;
          distanceGain = 0.1;
        } else if (stepIndex === 2) {
          await wirePod.moveWheels(serial, 56, 56, 620);
          summary = `Patrol continued through ${automation.targetArea}.`;
          distanceGain = 0.32;
        } else {
          await wirePod.moveHead(serial, 2, 180);
          await wirePod.moveHead(serial, -2, 220);
          summary = "Patrol visual sweep complete.";
          distanceGain = 0.05;
          eventType = "vision";
        }
      }

      const shouldCaptureSnapshot =
        automation.captureSnapshots &&
        robot.cameraAvailable &&
        (activeSession.commandsIssued + 1) % (automation.behavior === "explore" ? 3 : 4) === 0;

      if (shouldCaptureSnapshot) {
        await wirePod.takePhoto(serial).catch(() => undefined);
        snapshotGain = 1;
        dataGain += 2;
        summary = `${summary} Snapshot captured for the session log.`;
        eventType = "vision";
      }

      robot = await refreshWirePodStatus({ serial });
      const nextDataPoints = activeSession.dataPointsCollected + dataGain;
      const event: RoamEventRecord = {
        id: crypto.randomUUID(),
        createdAt: nowIso,
        type: eventType,
        message: summary,
        batteryPercent: robot.batteryPercent,
        dataPointsCollected: nextDataPoints
      };

      updateActiveRoamSession(activeSession.id, (session) =>
        pushRoamEvent(
          {
            ...session,
            distanceMeters: roundMetric(session.distanceMeters + distanceGain),
            commandsIssued: session.commandsIssued + commandGain,
            snapshotsTaken: session.snapshotsTaken + snapshotGain,
            dataPointsCollected: nextDataPoints
          },
          event,
          summary
        )
      );
      saveAutomationControl({ lastHeartbeatAt: nowIso });

      return applyRobotState({
        ...robot,
        mood: "focused",
        currentActivity: summary,
        lastSeen: nowIso
      });
    } catch {
      return robotOverride ?? cachedRobot;
    } finally {
      automationHeartbeatRunning = false;
    }
  };

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

  const buildSavedRobotTarget = (robot?: Partial<RobotStatus>): Partial<RobotStatus> | undefined => {
    const serial = selectSerial(
      robot?.serial,
      cachedRobot.serial,
      getSettings().serial,
      getProfile().selectedSerial,
      lastIntegration.selectedSerial
    );

    if (!serial) {
      return undefined;
    }

    const ipAddress =
      robot?.ipAddress && robot.ipAddress !== "Unavailable"
        ? robot.ipAddress
        : cachedRobot.ipAddress && cachedRobot.ipAddress !== "Unavailable"
          ? cachedRobot.ipAddress
          : undefined;

    return {
      serial,
      ipAddress,
      token: robot?.token || cachedRobot.token || getProfile().token,
      name: robot?.name || cachedRobot.name,
      nickname: robot?.nickname || cachedRobot.nickname || getProfile().aliases[serial]
    };
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
    const watchdogBefore = await getCurrentBridgeWatchdogStatus();
    const savedRobotTarget = buildSavedRobotTarget(robot);
    const savedSerial = savedRobotTarget?.serial;

    steps.push(
      buildRepairStep(
        "Watchdog assessment",
        watchdogBefore.overallStatus === "healthy"
          ? "success"
          : watchdogBefore.autoRecoveryLikelyHelpful
            ? "warn"
            : "fail",
        watchdogBefore.summary
      )
    );

    if (watchdogBefore.issueCode === "bridge-offline" && managedBridge.getCachedStatus().available) {
      const managedStatus = await managedBridge.ensureRunning().catch(() => managedBridge.getCachedStatus());
      steps.push(
        buildRepairStep(
          "Start bundled bridge",
          managedStatus.running ? "success" : "warn",
          managedStatus.running
            ? `The bundled bridge is running at ${managedStatus.endpoint}.`
            : managedStatus.note
        )
      );
      robot = await refreshWirePodStatus(savedRobotTarget);
    }

    if (
      (watchdogBefore.issueCode === "sdk-session-timeout" ||
        watchdogBefore.issueCode === "reconnect-loop") &&
      !managedBridge.getCachedStatus().available &&
      localRepair.hasKnownInstall()
    ) {
      const restartResult = await localRepair.tryStartWirePod();
      steps.push(
        buildRepairStep(
          "Relaunch bridge session",
          restartResult.launched ? "success" : restartResult.attempted ? "warn" : "fail",
          restartResult.executablePath
            ? `${restartResult.message} (${restartResult.executablePath})`
            : restartResult.message
        )
      );

      if (restartResult.launched) {
        await wait(1_250);
        robot = await refreshWirePodStatus(savedRobotTarget);
      }
    }

    if (
      savedRobotTarget &&
      (watchdogBefore.issueCode === "sdk-session-timeout" ||
        watchdogBefore.issueCode === "reconnect-loop" ||
        watchdogBefore.issueCode === "robot-routes-quiet")
    ) {
      robot = await refreshWirePodStatus(savedRobotTarget);
      steps.push(
        buildRepairStep(
          "Re-target saved robot",
          robot.isConnected ? "success" : "warn",
          robot.isConnected
            ? `${robot.nickname ?? robot.name} answered after the saved robot target was refreshed.`
            : "The saved robot target was refreshed, but the live routes are still settling."
        )
      );

      if (!robot.isConnected && savedSerial) {
        try {
          await wirePod.wake(savedSerial);
          await wait(1_200);
          robot = await refreshWirePodStatus(savedRobotTarget);
          steps.push(
            buildRepairStep(
              "Wake saved robot",
              robot.isConnected ? "success" : "warn",
              robot.isConnected
                ? `${robot.nickname ?? robot.name} answered after the wake signal.`
                : "The wake signal was sent, but the saved robot still is not answering yet."
            )
          );
        } catch (error) {
          steps.push(
            buildRepairStep(
              "Wake saved robot",
              "warn",
              error instanceof Error ? error.message : "The wake signal could not be sent."
            )
          );
        }
      }
    }

    if (!lastIntegration.wirePodReachable) {
      const startResult = await localRepair.tryStartWirePod();
      steps.push(
        buildRepairStep(
          "Start local bridge",
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
          "Local bridge",
          "success",
          "The local bridge was already reachable, so no restart was needed."
        )
      );
    }

    robot = await refreshWirePodStatus();
    steps.push(
      buildRepairStep(
        "Detect local bridge",
        lastIntegration.wirePodReachable ? "success" : "fail",
        lastIntegration.wirePodReachable
          ? `The app can reach the local bridge at ${lastIntegration.wirePodBaseUrl}.`
          : lastIntegration.note || "The local bridge is still offline after the repair attempt."
      )
    );

    if (lastIntegration.wirePodReachable) {
      if (
        !lastIntegration.robotReachable &&
        lastIntegration.note?.toLowerCase().includes("routes are not responding")
      ) {
        steps.push(
          buildRepairStep(
            "Robot SDK routes",
            "warn",
            "The local bridge answered, but its robot SDK routes timed out. Retry connection first, then restart WirePod or the desktop backend if it keeps failing."
          )
        );
      }

      if (!robot.isConnected) {
        if (savedRobotTarget) {
          robot = await refreshWirePodStatus(savedRobotTarget);
          steps.push(
            buildRepairStep(
              "Reconnect saved robot",
              robot.isConnected ? "success" : "warn",
              robot.isConnected
                ? `${robot.nickname ?? robot.name} responded after re-targeting the saved robot serial.`
                : "The saved robot target was applied, but Vector still is not answering local status checks."
            )
          );
        }

        if (!robot.isConnected && savedSerial) {
          try {
            await wirePod.wake(savedSerial);
            await wait(1_200);
            robot = await refreshWirePodStatus(savedRobotTarget);
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
        } else if (!robot.isConnected) {
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
    const bridgeRoutesStalled =
      lastIntegration.wirePodReachable &&
      !lastIntegration.robotReachable &&
      Boolean(lastIntegration.note?.toLowerCase().includes("routes are not responding"));
    const summary =
      overallStatus === "repaired"
        ? `${finalRobot.nickname ?? finalRobot.name} is back online and ready.`
        : overallStatus === "partial"
          ? bridgeRoutesStalled
            ? "The local bridge is online, but Vector's SDK routes are timing out. Restart WirePod or the desktop backend, then retry connection."
            : "The local bridge came back, but Vector still needs attention."
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

      const robot = await refreshWirePodStatus();
      return runAutomationHeartbeat(robot);
    },

    getIntegrationInfo: () => ({
      ...syncIntegration(),
      note:
        lastIntegration.note ||
        (lastIntegration.wirePodReachable ? "Connected through the local bridge." : "Local bridge offline")
    }),

    getBridgeWatchdogStatus: async () => getCurrentBridgeWatchdogStatus(),

    getSettings: () => getSettings(),

    updateSettings: (patch) => {
      const nextSettings = store.saveSettings(patch).settings;
      if (patch.serial !== undefined) {
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
        const autoSelectedRobot = resolveAutoSelectedRobot(sdkInfo.robots);
        const preferredSerial = selectSerial(
          autoSelectedRobot?.esn,
          getSettings().serial,
          getProfile().selectedSerial,
          lastIntegration.selectedSerial
        );

        if (autoSelectedRobot) {
          rememberSelectedRobot(
            autoSelectedRobot.esn,
            getProfile().aliases[autoSelectedRobot.esn]
          );
        }

        if (preferredSerial) {
          await refreshWirePodStatus({ serial: preferredSerial }).catch(() => undefined);
        }

        syncIntegration({
          source: "wirepod",
          wirePodReachable: true,
          robotReachable: lastIntegration.robotReachable,
          selectedSerial: preferredSerial ?? lastIntegration.selectedSerial,
          note: sdkInfo.robots.length
            ? "Authenticated Vector robots were found through the local bridge."
            : "The local bridge is online, but no authenticated Vector robots were found yet."
        });
        return sdkInfo.robots.map((robot) =>
          toDiscoveredRobot(robot, getProfile().aliases[robot.esn])
        );
      } catch (error) {
        const fallbackRobots = buildFallbackDiscoveredRobots();
        const wirePodReachable = Boolean(wirePod.getActiveEndpoint());
        if (fallbackRobots.length === 1 && fallbackRobots[0]?.serial) {
          rememberSelectedRobot(fallbackRobots[0].serial, fallbackRobots[0].name);
        }
        syncIntegration({
          source: "wirepod",
          wirePodReachable,
          robotReachable: false,
          selectedSerial:
            fallbackRobots.length === 1 ? fallbackRobots[0]?.serial : lastIntegration.selectedSerial,
          note: fallbackRobots.length
            ? wirePodReachable
              ? "The local bridge is online, but robot discovery is not responding. Showing the saved target instead."
              : "Local bridge offline. Showing the saved target instead."
            : error instanceof Error
              ? error.message
              : "Robot discovery is not responding through the local bridge right now."
        });
        return fallbackRobots;
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
            : lastIntegration.note || nextRobot.currentActivity || "Local bridge offline"
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
          if (direction !== "stop" && chargingProtectionEnabled(robot)) {
            return blockWhileCharging(
              "drive",
              { direction, speed, durationMs },
              robot,
              "Drive commands"
            );
          }

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
          const needsWake =
            !robot.isConnected || robot.mood === "sleepy" || robot.connectionState !== "connected";
          if (needsWake) {
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
        async (serial, robot) => {
          const intent =
            animationIntentMap[animationId] ??
            (animationId.startsWith("intent_") || animationId.startsWith("explore_")
              ? animationId
              : "intent_imperative_dance");
          const needsWake =
            intent !== "intent_system_sleep" &&
            (!robot.isConnected || robot.mood === "sleepy" || robot.connectionState !== "connected");
          const safeWhileCharging = isAnimationSafeWhileCharging(intent);
          const canWakeWhileCharging =
            safeWhileCharging && (robot.isDocked || robot.isCharging || cachedRobot.isDocked || cachedRobot.isCharging);
          if (
            chargingProtectionEnabled(robot) &&
            (!safeWhileCharging || (needsWake && !canWakeWhileCharging))
          ) {
            return blockWhileCharging(
              "animation",
              { animationId, intent },
              robot,
              "Movement-heavy animations"
            );
          }
          setBusy("Playing animation.", 6_500);
          if (needsWake) {
            await wirePod.wake(serial).catch(() => undefined);
            await wait(1_200);
          }
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
          if (chargingProtectionEnabled(robot)) {
            return blockWhileCharging("wake", { serial }, robot, "Wake requests");
          }

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
        if (chargingProtectionEnabled(robot)) {
          throw new Error(buildChargingProtectionMessage("Photo capture"));
        }

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
        const canArmWhileDocked =
          chargingProtectionEnabled(robot) && (robot.isDocked || robot.isCharging);

        if (chargingProtectionEnabled(robot) && !canArmWhileDocked) {
          throw new Error(buildChargingProtectionMessage("Roam automation"));
        }

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
          summary: robot.isDocked || robot.isCharging
            ? "Roam armed. Vector will wait on the charger until it is ready to move."
            : `Roam started in ${automation.behavior} mode.`,
          events: [
            {
              id: crypto.randomUUID(),
              createdAt: startedAt,
              type: "status",
              message: robot.isDocked || robot.isCharging
                ? `Roam started for ${automation.targetArea}, but Vector is still waiting on the charger.`
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
      const serial = selectSerial(
        robot.serial,
        cachedRobot.serial,
        getSettings().serial,
        getProfile().selectedSerial,
        lastIntegration.selectedSerial
      );

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
      const serial = selectSerial(
        robot.serial,
        cachedRobot.serial,
        getSettings().serial,
        getProfile().selectedSerial,
        lastIntegration.selectedSerial
      );

      if (!serial) {
        throw new Error("No robot serial is saved yet.");
      }

      if (!lastIntegration.wirePodReachable) {
        throw new Error("Local bridge offline");
      }

      return wirePod.getImage(serial, photoId, variant) as Promise<CameraImageAsset>;
    },

    deletePhoto: async (photoId) => {
      if (getSettings().mockMode) {
        return fallback.deletePhoto(photoId) as CameraSyncResult;
      }

      const robot = await refreshWirePodStatus();
      const serial = selectSerial(
        robot.serial,
        cachedRobot.serial,
        getSettings().serial,
        getProfile().selectedSerial,
        lastIntegration.selectedSerial
      );

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
        "Refreshing local bridge voice defaults.",
        async (serial, robot) => {
          const targetVolume = await refreshVoiceDefaultsInline(serial, robot);

          return pushLog(
            makeLog(
              "voice-repair",
              { serial, locale: "en-US", wakeWordMode: "Hey Vector", volume: targetVolume },
              "success",
              "Re-applied local bridge voice defaults: Hey Vector button mode, English (US), and speaker volume."
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

    getLearnedCommands: () => getLearnedCommands(),

    saveLearnedCommand: async ({ phrase, targetPrompt }) => {
      const nextLearnedCommands = upsertLearnedCommand(getLearnedCommands(), phrase, targetPrompt);
      store.saveLearnedCommands(nextLearnedCommands.commands);
      pushLog(
        makeLog(
          "learned-command-save",
          {
            phrase: nextLearnedCommands.record.phrase,
            targetPrompt: nextLearnedCommands.record.targetPrompt
          },
          "success",
          `Saved learned phrase ${nextLearnedCommands.record.phrase}.`
        )
      );
      return nextLearnedCommands.record;
    },

    deleteLearnedCommand: async ({ phrase }) => {
      const nextLearnedCommands = removeLearnedCommand(getLearnedCommands(), phrase);
      if (!nextLearnedCommands.record) {
        return undefined;
      }

      store.saveLearnedCommands(nextLearnedCommands.commands);
      pushLog(
        makeLog(
          "learned-command-delete",
          {
            phrase: nextLearnedCommands.record.phrase
          },
          "success",
          `Removed learned phrase ${nextLearnedCommands.record.phrase}.`
        )
      );
      return nextLearnedCommands.record;
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

      let robot = await refreshWirePodStatus();
      const savedRobotTarget = buildSavedRobotTarget(robot);
      if (!robot.isConnected && lastIntegration.wirePodReachable && savedRobotTarget) {
        robot = await refreshWirePodStatus(savedRobotTarget);
      }
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
            : "The local bridge did not respond, so the app is marking the bridge offline until it comes back."
        },
        {
          id: crypto.randomUUID(),
          label: "Robot connectivity",
          category: "network" as const,
          status: robot.isConnected ? "pass" : "warn",
          metric: robot.isConnected ? "Online" : "Offline",
          details: robot.isConnected
            ? "Vector responded through the local bridge."
            : lastIntegration.note || "The local bridge is online, but the robot is not reachable yet."
        },
        {
          id: crypto.randomUUID(),
          label: "Battery",
          category: "power" as const,
          status:
            robot.isDocked && !robot.isCharging
              ? "warn"
              : robot.batteryPercent > 20
                ? "pass"
                : "warn",
          metric: `${robot.batteryPercent}%`,
          details: robot.isCharging
            ? "Vector is currently charging on the dock."
            : robot.isDocked
              ? "Vector is docked, but the charger is not feeding power right now. Reseat the robot and check the contacts."
              : robot.batteryPercent > 20
                ? "Battery is healthy enough for local movement."
                : "Battery is low. Dock soon."
        },
        {
          id: crypto.randomUUID(),
          label: "Charging protection",
          category: "power" as const,
          status: getSettings().protectChargingUntilFull ? "pass" : "warn",
          metric: getSettings().protectChargingUntilFull ? "On" : "Off",
          details: getSettings().protectChargingUntilFull
            ? `Wake, drive, roam, and larger animations stay blocked on the charger until Vector is around ${CHARGING_PROTECTION_RELEASE_PERCENT}%.`
            : "Vector can still be woken or moved while on the charger."
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
            ? "Local bridge offline."
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
