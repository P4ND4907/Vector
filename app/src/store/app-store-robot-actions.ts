import { robotService } from "@/services/robotService";
import { mobileBackendDiscoveryService } from "@/services/mobileBackendDiscovery";
import { getStoredAppBackendUrl, mobileRuntimeNeedsManualBackendUrl } from "@/lib/runtime-target";
import { sanitizeRobotSerial, selectRobotSerial } from "@/lib/robot-serial";
import { isNetworkError } from "@/services/apiClient";
import type { CameraSnapshot, PairingCandidate } from "@/types";

import type { AppState, AppStoreGet, AppStoreSet } from "./app-store-types";
import {
  ActionFeedbackError,
  appendLog,
  appendToast,
  attachRoamSimulation,
  attachTelemetrySubscription,
  createNotification,
  exportSnapshot,
  mergePersistedState,
  runAction,
  stopRoamSimulation
} from "./app-store-utils";

const toTrimmedSerial = (value: string | undefined) => value?.trim();

const findSerialFromCandidates = (state: AppState, candidates: PairingCandidate[]) => {
  if (sanitizeRobotSerial(state.settings.robotSerial)) {
    return undefined;
  }

  const discoveredSerials = candidates
    .map((candidate) => sanitizeRobotSerial(candidate.serial))
    .filter((serial): serial is string => Boolean(serial))
    .filter((serial, index, values) => values.indexOf(serial) === index);

  if (!discoveredSerials.length) {
    return undefined;
  }

  const savedSerial = state.savedProfiles
    .map((profile) => toTrimmedSerial(profile.serial))
    .find(Boolean) as string | undefined;

  if (savedSerial && discoveredSerials.includes(savedSerial)) {
    return savedSerial;
  }

  if (state.integration.selectedSerial) {
    const selected = sanitizeRobotSerial(state.integration.selectedSerial);
    if (selected && discoveredSerials.includes(selected)) {
      return selected;
    }
  }

  if (state.robot.serial) {
    const current = sanitizeRobotSerial(state.robot.serial);
    if (current && discoveredSerials.includes(current)) {
      return current;
    }
  }

  if (discoveredSerials.length === 1) {
    return discoveredSerials[0];
  }

  return undefined;
};

const findCandidateBySerial = (candidates: PairingCandidate[], serial: string) =>
  candidates.find((candidate) => toTrimmedSerial(candidate.serial) === serial);

const getSavedTargetProfile = (
  state: Pick<AppState, "savedProfiles" | "settings" | "integration" | "robot">
) => {
  const preferredSerial = sanitizeRobotSerial(
    selectRobotSerial(
      state.settings.robotSerial,
      state.integration.selectedSerial,
      state.robot.serial
    )
  );

  if (preferredSerial) {
    const matchingProfile = state.savedProfiles.find(
      (profile) => sanitizeRobotSerial(profile.serial) === preferredSerial
    );
    if (matchingProfile) {
      return matchingProfile;
    }
  }

  return state.savedProfiles[0];
};

const buildSavedTargetCandidate = (state: Pick<AppState, "savedProfiles" | "settings" | "integration" | "robot">) => {
  const savedTarget = getSavedTargetProfile(state);
  const serial = sanitizeRobotSerial(
    selectRobotSerial(
      state.settings.robotSerial,
      state.integration.selectedSerial,
      state.robot.serial,
      savedTarget?.serial
    )
  );

  if (!savedTarget && !serial) {
    return undefined;
  }

  return {
    id: savedTarget?.id || serial || state.robot.id,
    serial: serial || state.robot.serial,
    name: savedTarget?.name || state.robot.nickname || state.robot.name,
    ipAddress: savedTarget?.ipAddress || state.robot.ipAddress,
    signalStrength: 0,
    secure: true,
    activated: true,
    lastSeen: new Date().toISOString()
  };
};

const hydrateSavedTargetContext = <T extends Pick<AppState, "robot" | "integration" | "settings" | "savedProfiles">>(
  state: T
): T => {
  const savedTarget = getSavedTargetProfile(state);
  const resolvedSerial = sanitizeRobotSerial(
    selectRobotSerial(
      state.settings.robotSerial,
      state.integration.selectedSerial,
      state.robot.serial,
      savedTarget?.serial
    )
  );

  if (!savedTarget && !resolvedSerial) {
    return state;
  }

  const currentSerial = sanitizeRobotSerial(state.robot.serial);
  const shouldReuseCurrentIdentity = Boolean(currentSerial && currentSerial === resolvedSerial);

  return {
    ...state,
    robot: {
      ...state.robot,
      serial: resolvedSerial || state.robot.serial,
      name:
        shouldReuseCurrentIdentity || !savedTarget?.name
          ? state.robot.name
          : savedTarget.name,
      nickname:
        state.settings.robotNickname ||
        state.robot.nickname ||
        savedTarget?.name ||
        state.robot.name,
      ipAddress: savedTarget?.ipAddress || state.robot.ipAddress,
      token: savedTarget?.token || state.robot.token,
      connectionSource: state.settings.mockMode ? state.robot.connectionSource : "wirepod"
    },
    integration: {
      ...state.integration,
      selectedSerial: resolvedSerial || state.integration.selectedSerial
    },
    settings: {
      ...state.settings,
      robotSerial: resolvedSerial || state.settings.robotSerial
    }
  };
};

const buildRobotWithAutoSerial = (
  state: AppState,
  serial: string,
  candidates: PairingCandidate[] = state.availableRobots
): { robotSerial: string; robot: AppState["robot"] } => {
  const serialCandidate = findCandidateBySerial(candidates, serial);
  const currentSerial = sanitizeRobotSerial(state.robot.serial);
  const shouldReuseRobotSerial = Boolean(currentSerial && currentSerial === serial);

  return {
    robotSerial: serial,
    robot: shouldReuseRobotSerial
      ? state.robot
      : {
          ...state.robot,
          serial,
          ipAddress: serialCandidate?.ipAddress || state.robot.ipAddress
        }
  };
};

const buildPendingMobileBackendState = (state: AppState, note?: string): AppState => {
  const fallbackSerial = selectRobotSerial(
    state.settings.robotSerial,
    state.integration.selectedSerial,
    state.robot.serial
  );
  const savedTarget = state.savedProfiles[0];

  return {
    ...state,
    robot: {
      ...state.robot,
      serial: fallbackSerial || state.robot.serial,
      name: state.robot.name || savedTarget?.name || "Vector",
      ipAddress: savedTarget?.ipAddress || state.robot.ipAddress,
      isConnected: false,
      connectionState: "error",
      connectionSource: "wirepod",
      wifiStrength: 0,
      systemStatus:
        state.robot.isDocked
          ? state.robot.isCharging
            ? "charging"
            : "docked"
          : "offline",
      currentActivity: "Waiting for the desktop backend URL.",
      lastSeen: state.robot.lastSeen || new Date().toISOString(),
      mood: state.robot.isCharging ? "charging" : state.robot.isDocked ? "sleepy" : "ready"
    },
    integration: {
      ...state.integration,
      source: "wirepod",
      selectedSerial: fallbackSerial,
      mockMode: false,
      wirePodReachable: false,
      robotReachable: false,
      note: note || "Save the desktop backend URL in Settings first.",
      lastCheckedAt: new Date().toISOString(),
      managedBridge: {
        ...state.integration.managedBridge,
        running: false,
        note: "Waiting for the mobile app to reach the desktop backend."
      }
    },
    settings: {
      ...state.settings,
      mockMode: false
    },
    automationControl:
      state.automationControl.status === "running"
        ? {
            ...state.automationControl,
            status: "idle",
            activeSessionId: undefined
          }
        : state.automationControl
  };
};

const buildOfflineBootstrapState = (state: AppState, note?: string): AppState => {
  const hydratedState = hydrateSavedTargetContext(state);
  const savedTarget = getSavedTargetProfile(hydratedState);
  const fallbackSerial = selectRobotSerial(
    hydratedState.settings.robotSerial,
    hydratedState.integration.selectedSerial,
    hydratedState.robot.serial,
    savedTarget?.serial
  );

  return {
    ...hydratedState,
    robot: {
      ...hydratedState.robot,
      serial: fallbackSerial || hydratedState.robot.serial,
      name: savedTarget?.name || hydratedState.robot.name || "Vector",
      nickname:
        hydratedState.settings.robotNickname ||
        hydratedState.robot.nickname ||
        savedTarget?.name ||
        hydratedState.robot.name,
      ipAddress: savedTarget?.ipAddress || hydratedState.robot.ipAddress,
      token: savedTarget?.token || hydratedState.robot.token,
      isConnected: false,
      connectionState: "error",
      connectionSource: "wirepod",
      wifiStrength: 0,
      systemStatus:
        hydratedState.robot.isCharging
          ? "charging"
          : hydratedState.robot.isDocked
            ? "docked"
            : "offline",
      currentActivity: "Offline mode. Showing the last saved setup.",
      lastSeen: hydratedState.robot.lastSeen || new Date().toISOString(),
      mood: hydratedState.robot.isCharging
        ? "charging"
        : hydratedState.robot.isDocked
          ? "sleepy"
          : "ready"
    },
    integration: {
      ...hydratedState.integration,
      source: "wirepod",
      selectedSerial: fallbackSerial || hydratedState.integration.selectedSerial,
      mockMode: false,
      wirePodReachable: false,
      robotReachable: false,
      note: note || "Desktop backend offline. Showing the last saved setup.",
      lastCheckedAt: new Date().toISOString(),
      managedBridge: {
        ...hydratedState.integration.managedBridge,
        running: false,
        note: "Offline mode is using the last saved setup until the desktop backend returns."
      }
    },
    settings: {
      ...hydratedState.settings,
      mockMode: false
    },
    automationControl:
      hydratedState.automationControl.status === "running"
        ? {
            ...hydratedState.automationControl,
            status: "idle",
            activeSessionId: undefined
          }
        : hydratedState.automationControl
  };
};

const mergeSnapshotWithPersistedUi = (freshState: AppState, persistedState: AppState) => {
  const merged = mergePersistedState(freshState, persistedState);
  const resolvedAppBackendUrl =
    getStoredAppBackendUrl() || freshState.settings.appBackendUrl || merged.settings.appBackendUrl;
  const resolvedRobotSerial = selectRobotSerial(
    freshState.settings.robotSerial,
    freshState.integration.selectedSerial,
    freshState.robot.serial,
    merged.settings.robotSerial
  );

  return hydrateSavedTargetContext({
    ...merged,
    robot: freshState.robot,
    integration: freshState.integration,
    settings: {
      ...merged.settings,
      ...freshState.settings,
      theme: merged.settings.theme,
      colorTheme: merged.settings.colorTheme,
      appBackendUrl: resolvedAppBackendUrl,
      robotNickname: freshState.settings.robotNickname || merged.settings.robotNickname,
      robotSerial: resolvedRobotSerial || merged.settings.robotSerial
    },
    savedProfiles: freshState.savedProfiles.length ? freshState.savedProfiles : merged.savedProfiles,
    routines: freshState.routines,
    logs: freshState.logs,
    availableRobots: freshState.availableRobots,
    supportReports: freshState.supportReports,
    snapshots: freshState.snapshots.length ? freshState.snapshots : merged.snapshots
  });
};

const isSameSavedProfile = (left: { id: string; serial?: string; ipAddress: string }, right: { id: string; serial?: string; ipAddress: string }) =>
  Boolean(left.serial && right.serial)
    ? left.serial === right.serial
    : left.id === right.id || left.ipAddress === right.ipAddress;

const shouldAttemptStartupReconnect = (
  state: Pick<AppState, "robot" | "integration" | "settings" | "savedProfiles">
) => {
  if (state.settings.mockMode || !state.settings.reconnectOnStartup) {
    return false;
  }

  if (!state.integration.wirePodReachable) {
    return false;
  }

  const resolvedSerial = sanitizeRobotSerial(
    selectRobotSerial(
      state.settings.robotSerial,
      state.integration.selectedSerial,
      state.robot.serial,
      getSavedTargetProfile(state)?.serial
    )
  );

  if (!resolvedSerial) {
    return false;
  }

  return !(state.robot.isConnected && state.integration.robotReachable);
};

const attemptStartupReconnect = async (state: AppState) => {
  const hadLocalReconnectTarget = Boolean(
    sanitizeRobotSerial(state.settings.robotSerial) ||
      sanitizeRobotSerial(getSavedTargetProfile(state)?.serial)
  );
  const hydratedState = hydrateSavedTargetContext(state);

  if (!hadLocalReconnectTarget || !shouldAttemptStartupReconnect(hydratedState)) {
    return {
      attempted: false,
      reconnected: false,
      state: hydratedState,
      message: undefined as string | undefined
    };
  }

  try {
    const result = await robotService.connect(
      hydratedState.robot,
      hydratedState.integration,
      hydratedState.settings
    );

    if (!result.data) {
      return {
        attempted: true,
        reconnected: false,
        state: {
          ...hydratedState,
          logs: [
            appendLog(
              "connect-auto",
              {
                source: "startup",
                serial:
                  hydratedState.settings.robotSerial ||
                  hydratedState.integration.selectedSerial ||
                  hydratedState.robot.serial ||
                  null
              },
              "error",
              "Startup reconnect did not return robot details."
            ),
            ...hydratedState.logs
          ].slice(0, 60)
        },
        message: "Startup reconnect did not return robot details."
      };
    }

    const data = result.data;
    const discoveredSerial = selectRobotSerial(
      data.robot.serial,
      data.integration.selectedSerial,
      hydratedState.settings.robotSerial,
      hydratedState.robot.serial
    );
    const nextState = hydrateSavedTargetContext({
      ...hydratedState,
      robot: {
        ...data.robot,
        nickname:
          hydratedState.settings.robotNickname ||
          data.robot.nickname ||
          data.robot.name
      },
      integration: data.integration,
      settings: discoveredSerial
        ? {
            ...hydratedState.settings,
            robotSerial: discoveredSerial
          }
        : hydratedState.settings,
      logs: [
        appendLog(
          "connect-auto",
          {
            source: "startup",
            serial: discoveredSerial || hydratedState.settings.robotSerial || hydratedState.robot.serial || null
          },
          data.robot.isConnected ? "success" : "error",
          result.message
        ),
        ...hydratedState.logs
      ].slice(0, 60)
    });

    return {
      attempted: true,
      reconnected: data.robot.isConnected && data.integration.robotReachable,
      state: nextState,
      message: result.message
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Startup reconnect did not finish cleanly.";

    return {
      attempted: true,
      reconnected: false,
      state: {
        ...hydratedState,
        logs: [
          appendLog(
            "connect-auto",
            {
              source: "startup",
              serial:
                hydratedState.settings.robotSerial ||
                hydratedState.integration.selectedSerial ||
                hydratedState.robot.serial ||
                null
            },
            "error",
            message
          ),
          ...hydratedState.logs
        ].slice(0, 60)
      },
      message
    };
  }
};

const syncSavedTargetWithBackend = async (
  state: AppState,
  set: AppStoreSet,
  options?: { force?: boolean }
) => {
  const hydratedState = hydrateSavedTargetContext(state);

  if (hydratedState.settings.mockMode) {
    return hydratedState;
  }

  const resolvedSerial = sanitizeRobotSerial(
    selectRobotSerial(
      hydratedState.settings.robotSerial,
      hydratedState.integration.selectedSerial,
      hydratedState.robot.serial,
      getSavedTargetProfile(hydratedState)?.serial
    )
  );

  if (!resolvedSerial) {
    return hydratedState;
  }

  const selectedSerial = sanitizeRobotSerial(hydratedState.integration.selectedSerial);
  const settingsSerial = sanitizeRobotSerial(hydratedState.settings.robotSerial);

  if (!options?.force && resolvedSerial === selectedSerial && resolvedSerial === settingsSerial) {
    return hydratedState;
  }

  const result = await robotService.updateSettings(
    { robotSerial: resolvedSerial },
    hydratedState.settings,
    hydratedState.integration,
    hydratedState.robot
  );
  const nextRobot = result.robot ?? hydratedState.robot;
  const nextState = hydrateSavedTargetContext({
    ...hydratedState,
    robot: {
      ...nextRobot,
      nickname:
        result.settings.robotNickname ||
        nextRobot.nickname ||
        nextRobot.name
    },
    integration: result.integration,
    settings: {
      ...hydratedState.settings,
      ...result.settings,
      robotSerial: resolvedSerial
    }
  });

  set(() => ({
    robot: nextState.robot,
    integration: nextState.integration,
    settings: nextState.settings
  }));

  return nextState;
};

export const createRobotActions = (
  set: AppStoreSet,
  get: AppStoreGet
): Pick<
  AppState,
  | "initialize"
  | "dismissToast"
  | "scanForRobots"
  | "pairRobot"
  | "connectRobot"
  | "disconnectRobot"
  | "driveRobot"
  | "moveHead"
  | "moveLift"
  | "wakeRobot"
  | "setRobotVolume"
  | "setSpeed"
  | "togglePrecisionMode"
  | "speakText"
  | "playAnimation"
  | "queueAnimation"
  | "playQueuedAnimations"
  | "playRandomAnimation"
  | "runDiagnostics"
  | "repairVoiceSetup"
  | "quickRepair"
  | "reportProblem"
  | "returnToDock"
  | "toggleMute"
  | "takeSnapshot"
  | "syncPhotos"
  | "deleteSnapshot"
  | "clearLogs"
  | "exportState"
> => ({
  initialize: async () => {
    if (get().initialized) {
      if (mobileRuntimeNeedsManualBackendUrl()) {
        stopRoamSimulation();
        return;
      }

      if (!get().telemetryActive) {
        attachTelemetrySubscription(get, set);
      }
      if (get().automationControl.status === "running") {
        attachRoamSimulation(get, set);
      }
      return;
    }

    await runAction("bootstrap", set, async () => {
      const existingState = get();

      if (mobileRuntimeNeedsManualBackendUrl()) {
        const discovery = await mobileBackendDiscoveryService
          .discoverDesktopBackendWithRetry({
            attempts: 3,
            retryDelayMs: 1_200
          })
          .catch(() => null);

        if (discovery?.status === "found" && discovery.target) {
          const savedBackendState = await robotService.updateSettings(
            { appBackendUrl: discovery.target.url },
            existingState.settings,
            existingState.integration,
            existingState.robot
          );
          const snapshot = await robotService.bootstrap();
          const mergedState = mergeSnapshotWithPersistedUi(
            {
              ...existingState,
              ...snapshot,
              settings: {
                ...existingState.settings,
                ...savedBackendState.settings
              },
              integration: savedBackendState.integration,
              robot: savedBackendState.robot ?? existingState.robot
            },
            existingState
          );
          const autoRobotSerial = findSerialFromCandidates(mergedState, mergedState.availableRobots);
          const nextState = autoRobotSerial
            ? (() => {
                const { robotSerial, robot } = buildRobotWithAutoSerial(mergedState, autoRobotSerial);
                return {
                  ...mergedState,
                  robot,
                  settings: {
                    ...mergedState.settings,
                    robotSerial
                  }
                };
              })()
            : mergedState;

          const startupReconnect = await attemptStartupReconnect(nextState);
          const finalState = startupReconnect.state;

          set(() => ({
            ...finalState,
            initialized: true,
            telemetryActive: true,
            robot: {
              ...finalState.robot,
              nickname: finalState.settings.robotNickname || finalState.robot.nickname || finalState.robot.name
            }
          }));

          attachTelemetrySubscription(get, set);

          if (finalState.automationControl.status === "running") {
            attachRoamSimulation(get, set);
          }

          if (startupReconnect.reconnected && startupReconnect.message) {
            return `Found and saved ${discovery.target.url} automatically. ${startupReconnect.message}`;
          }

          if (startupReconnect.attempted && startupReconnect.message) {
            return `Found and saved ${discovery.target.url} automatically. ${startupReconnect.message}`;
          }

          return `Found and saved ${discovery.target.url} automatically.`;
        }

        const nextState = buildPendingMobileBackendState(existingState, discovery?.note);

        set(() => ({
          ...nextState,
          initialized: true,
          telemetryActive: false,
          robot: {
            ...nextState.robot,
            nickname: nextState.settings.robotNickname || nextState.robot.nickname || nextState.robot.name
          }
        }));

        stopRoamSimulation();

        return nextState.integration.note || "Save the desktop backend URL in Settings first.";
      }

      try {
        const snapshot = await robotService.bootstrap();
        const mergedState = mergeSnapshotWithPersistedUi(
          {
            ...existingState,
            ...snapshot
          },
          existingState
        );
        const autoRobotSerial = findSerialFromCandidates(mergedState, mergedState.availableRobots);
        const nextState = autoRobotSerial
          ? (() => {
              const { robotSerial, robot } = buildRobotWithAutoSerial(mergedState, autoRobotSerial);
              return {
                ...mergedState,
                robot,
                settings: {
                  ...mergedState.settings,
                  robotSerial
                }
              };
            })()
          : mergedState;

        const startupReconnect = await attemptStartupReconnect(nextState);
        const finalState = startupReconnect.state;

        set(() => ({
          ...finalState,
          initialized: true,
          telemetryActive: true,
          robot: {
            ...finalState.robot,
            nickname: finalState.settings.robotNickname || finalState.robot.nickname || finalState.robot.name
          }
        }));

        attachTelemetrySubscription(get, set);

        if (finalState.automationControl.status === "running") {
          attachRoamSimulation(get, set);
        }

        return (
          startupReconnect.message ||
          finalState.integration.note ||
          mergedState.integration.note ||
          "Vector dashboard initialized."
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Desktop backend offline. Showing the last saved setup.";
        const offlineState = buildOfflineBootstrapState(
          existingState,
          isNetworkError(error) ? "Desktop backend offline. Showing the last saved setup." : message
        );

        set(() => ({
          ...offlineState,
          initialized: true,
          telemetryActive: false,
          robot: {
            ...offlineState.robot,
            nickname:
              offlineState.settings.robotNickname ||
              offlineState.robot.nickname ||
              offlineState.robot.name
          }
        }));

        stopRoamSimulation();

        return offlineState.integration.note || "Desktop backend offline. Showing the last saved setup.";
      }
    });
  },

  dismissToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId)
    })),

  scanForRobots: async () => {
    await runAction("scan", set, async () => {
      try {
        const result = await robotService.scanNetwork();
        const hydratedState = hydrateSavedTargetContext(get());
        const savedCandidate = buildSavedTargetCandidate(hydratedState);
        const usingSavedFallback = result.robots.length === 0 && Boolean(savedCandidate);
        const visibleRobots = usingSavedFallback && savedCandidate ? [savedCandidate] : result.robots;
        const visibleIntegration =
          usingSavedFallback && savedCandidate
            ? {
                ...result.integration,
                selectedSerial: savedCandidate.serial || result.integration.selectedSerial,
                note:
                  result.integration.note ||
                  "The local bridge is online, but no live robot answered right now. Showing the saved target instead."
              }
            : result.integration;
        const autoRobotSerial = findSerialFromCandidates(hydratedState, visibleRobots);

        const nextSettings = autoRobotSerial
          ? { ...hydratedState.settings, robotSerial: autoRobotSerial }
          : hydratedState.settings;
        const nextRobot = autoRobotSerial
          ? buildRobotWithAutoSerial(hydratedState, autoRobotSerial, visibleRobots).robot
          : hydratedState.robot;
        const scanMessage = usingSavedFallback
          ? "Local robot scan did not find a live robot, so the saved target stayed available."
          : autoRobotSerial
            ? "Local robot scan complete and serial auto-selected."
            : "Local robot scan complete.";

        set((state) => ({
          availableRobots: visibleRobots,
          robot: autoRobotSerial ? nextRobot : state.robot,
          settings: autoRobotSerial ? nextSettings : state.settings,
          integration: visibleIntegration,
          logs: [
            appendLog(
              "scan",
              {
                count: visibleRobots.length,
                autoSelectedSerial: autoRobotSerial ?? null,
                fallback: usingSavedFallback ? "saved-profile" : null
              },
              "success",
              scanMessage
            ),
            ...state.logs
          ].slice(0, 60),
          toasts: [
            appendToast(
              usingSavedFallback ? "Using saved robot" : "Scan complete",
              usingSavedFallback
                ? "No live robot answered the scan, so the saved robot profile stayed available."
                : autoRobotSerial
                  ? `Found ${visibleRobots.length} nearby robot profiles. Auto-selected ${autoRobotSerial}.`
                  : `Found ${visibleRobots.length} nearby robot profiles.`,
              "success"
            ),
            ...state.toasts
          ].slice(0, 5)
        }));
        return visibleIntegration.note || "Local network scan complete.";
      } catch (error) {
        const state = hydrateSavedTargetContext(get());
        const savedCandidate = buildSavedTargetCandidate(state);

        if (!savedCandidate) {
          if (!isNetworkError(error)) {
            throw error;
          }

          const message = "Desktop backend offline. Start it on your PC, then scan again.";

          set((current) => ({
            robot: {
              ...current.robot,
              isConnected: false,
              connectionState: "error",
              systemStatus: current.robot.isDocked
                ? current.robot.isCharging
                  ? "charging"
                  : "docked"
                : "offline",
              currentActivity: "Waiting for the desktop backend to come back online."
            },
            integration: {
              ...current.integration,
              wirePodReachable: false,
              robotReachable: false,
              note: message
            },
            notifications: [
              createNotification("Scan waiting", message, "warning", "system"),
              ...current.notifications
            ].slice(0, 20)
          }));

          throw new ActionFeedbackError(message, "Scan waiting");
        }

        set((current) => ({
          availableRobots: [savedCandidate],
          robot: {
            ...current.robot,
            serial: savedCandidate.serial,
            ipAddress: savedCandidate.ipAddress || current.robot.ipAddress,
            isConnected: false,
            connectionState: "error",
            systemStatus: current.robot.isDocked
              ? current.robot.isCharging
                ? "charging"
                : "docked"
              : "offline",
            currentActivity: "Waiting for the desktop backend to come back online."
          },
          integration: {
            ...current.integration,
            wirePodReachable: false,
            robotReachable: false,
            selectedSerial: savedCandidate.serial || current.integration.selectedSerial,
            note: "Desktop backend offline. Showing the saved robot profile until the backend comes back."
          },
          settings: savedCandidate.serial
            ? {
                ...current.settings,
                robotSerial: savedCandidate.serial
              }
            : current.settings,
          logs: [
            appendLog(
              "scan",
              { count: 1, autoSelectedSerial: savedCandidate.serial ?? null, fallback: "saved-profile" },
              "success",
              "Desktop backend offline. Showing the saved robot profile until the backend comes back."
            ),
            ...current.logs
          ].slice(0, 60),
          toasts: [
            appendToast(
              "Using saved robot",
              "Desktop backend offline. Showing the saved robot profile until the backend comes back.",
              "info"
            ),
            ...current.toasts
          ].slice(0, 5)
        }));

        return "Desktop backend offline. Showing the saved robot profile until the backend comes back.";
      }
    });
  },

  pairRobot: async (input) => {
    await runAction("pair", set, async () => {
      const result = await robotService.pairRobot(input);
      if (!result.data) {
        throw new Error("Pairing did not return a robot profile.");
      }
      const { profile, robot, integration } = result.data;

      set((state) => ({
        robot: {
          ...robot,
          nickname: state.settings.robotNickname || robot.nickname || robot.name
        },
        integration,
        savedProfiles: [
          profile,
          ...state.savedProfiles.filter((savedProfile) => !isSameSavedProfile(savedProfile, profile))
        ].slice(0, 5),
        settings: {
          ...state.settings,
          autoReconnect: input.autoReconnect,
          reconnectOnStartup: input.autoReconnect,
          robotNickname: input.name,
          robotSerial: input.serial ?? robot.serial ?? state.settings.robotSerial
        },
        logs: [
          appendLog("pair", input as unknown as Record<string, unknown>, "success", result.message),
          ...state.logs
        ].slice(0, 60),
        toasts: [appendToast("Robot saved", result.message, "success"), ...state.toasts].slice(0, 5)
      }));

      return result.message;
    });
  },

  connectRobot: async () => {
    await runAction("connect", set, async () => {
      let state = hydrateSavedTargetContext(get());
      try {
        state = await syncSavedTargetWithBackend(state, set, { force: true });
      } catch {
        state = hydrateSavedTargetContext(get());
      }
      const currentRobotSerial = sanitizeRobotSerial(state.robot.serial);
      const resolvedSerial = selectRobotSerial(
        currentRobotSerial,
        state.settings.robotSerial,
        state.integration.selectedSerial,
        getSavedTargetProfile(state)?.serial
      );
      const robot = resolvedSerial
        ? { ...state.robot, serial: resolvedSerial }
        : state.robot;
      const shouldPersistSerial = Boolean(
        resolvedSerial && resolvedSerial !== sanitizeRobotSerial(state.settings.robotSerial)
      );

      try {
        const result = await robotService.connect(robot, state.integration, state.settings);
        if (!result.data) {
          throw new Error("Robot did not return connection details.");
        }
        const data = result.data;
        const discoveredSerial = selectRobotSerial(
          data.robot.serial,
          data.integration.selectedSerial,
          resolvedSerial,
          state.settings.robotSerial
        );

        set((current) => ({
          robot: {
            ...data.robot,
            nickname:
              current.settings.robotNickname ||
              data.robot.nickname ||
              data.robot.name
          },
          settings:
            shouldPersistSerial || (discoveredSerial && discoveredSerial !== current.settings.robotSerial)
              ? {
                  ...current.settings,
                  robotSerial: discoveredSerial || resolvedSerial || current.settings.robotSerial
                }
              : current.settings,
          integration: data.integration,
          logs: [
            appendLog(
              "connect",
              { ipAddress: current.robot.ipAddress, serial: data.robot.serial },
              data.robot.isConnected ? "success" : "error",
              result.message
            ),
            ...current.logs
          ].slice(0, 60),
          toasts: [
            appendToast(
              data.robot.isConnected
                ? "Connected"
                : data.integration.wirePodReachable
                  ? "Robot still offline"
                  : "Local bridge offline",
              result.message,
              data.robot.isConnected ? "success" : "warning"
            ),
            ...current.toasts
          ].slice(0, 5)
        }));

        if (!get().telemetryActive) {
          attachTelemetrySubscription(get, set);
        }

        return result.message;
      } catch (error) {
        const fallbackState = hydrateSavedTargetContext(get());
        const savedCandidate = buildSavedTargetCandidate(fallbackState);
        const savedSerial = savedCandidate?.serial || "";
        const savedIpAddress = savedCandidate?.ipAddress || "";
        const message =
          isNetworkError(error)
            ? savedCandidate
              ? "Desktop backend offline. The saved robot is still ready and will reconnect when the backend comes back."
              : "Desktop backend offline. Start it on your PC or update the saved backend URL, then try again."
            : error instanceof Error
              ? error.message
              : "Connection did not finish cleanly.";

        if (!savedCandidate && !isNetworkError(error)) {
          throw error;
        }

        set((current) => ({
          robot: {
            ...current.robot,
            serial: savedSerial || current.robot.serial,
            ipAddress: savedIpAddress || current.robot.ipAddress,
            isConnected: false,
            connectionState: "error",
            systemStatus: current.robot.isDocked
              ? current.robot.isCharging
                ? "charging"
                : "docked"
              : "offline",
            currentActivity: "Waiting for the desktop backend to reconnect."
          },
          integration: {
            ...current.integration,
            wirePodReachable: isNetworkError(error) ? false : current.integration.wirePodReachable,
            robotReachable: false,
            selectedSerial: savedSerial || current.integration.selectedSerial,
            note: message
          },
          settings: savedSerial
            ? {
                ...current.settings,
                robotSerial: savedSerial
              }
            : current.settings,
          notifications: [
            createNotification("Connection waiting", message, "warning", "system"),
            ...current.notifications
          ].slice(0, 20)
        }));

        throw new ActionFeedbackError(
          message,
          isNetworkError(error) ? "Connection waiting" : "Robot still offline"
        );
      }
    });
  },

  disconnectRobot: async () => {
    await runAction("disconnect", set, async () => {
      const state = get();
      const result = await robotService.disconnect(state.robot, state.integration);
      if (!result.data) {
        throw new Error("Disconnect did not return robot status.");
      }
      const data = result.data;

      set((current) => ({
        robot: data.robot,
        integration: data.integration,
        logs: [
          appendLog("disconnect", { robotId: current.robot.id }, "success", result.message),
          ...current.logs
        ].slice(0, 60),
        toasts: [appendToast("Disconnected", result.message, "info"), ...current.toasts].slice(0, 5)
      }));

      return result.message;
    });
  },

  driveRobot: async (direction) => {
    await runAction("drive", set, async () => {
      const state = get();
      const result = await robotService.sendDriveCommand(direction, state.driveState.speed, state.driveState.precisionMode, {
        robot: state.robot,
        integration: state.integration
      });

      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot } : current.robot,
        integration: result.integration ?? current.integration,
        logs: [
          appendLog("drive", { direction, speed: state.driveState.speed }, "success", result.message),
          ...current.logs
        ].slice(0, 60),
        toasts: [appendToast("Drive command sent", result.message, "info"), ...current.toasts].slice(0, 5)
      }));

      return result.message;
    });
  },

  moveHead: async (angle) => {
    set((state) => ({
      driveState: { ...state.driveState, headAngle: angle }
    }));

    await runAction("drive", set, async () => {
      const state = get();
      const result = await robotService.setHead(angle, {
        robot: state.robot,
        integration: state.integration
      });
      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot } : current.robot,
        integration: result.integration ?? current.integration,
        logs: [appendLog("head", { angle }, "success", result.message), ...current.logs].slice(0, 60)
      }));
      return result.message;
    });
  },

  moveLift: async (height) => {
    set((state) => ({
      driveState: { ...state.driveState, liftHeight: height }
    }));

    await runAction("drive", set, async () => {
      const state = get();
      const result = await robotService.setLift(height, {
        robot: state.robot,
        integration: state.integration
      });
      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot } : current.robot,
        integration: result.integration ?? current.integration,
        logs: [appendLog("lift", { height }, "success", result.message), ...current.logs].slice(0, 60)
      }));
      return result.message;
    });
  },

  wakeRobot: async () => {
    await runAction("wake", set, async () => {
      const state = get();
      const result = await robotService.wake({
        robot: state.robot,
        integration: state.integration
      });
      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot } : current.robot,
        integration: result.integration ?? current.integration,
        logs: [appendLog("wake", {}, "success", result.message), ...current.logs].slice(0, 60),
        toasts: [appendToast("Wake signal sent", result.message, "info"), ...current.toasts].slice(0, 5)
      }));
      return result.message;
    });
  },

  setRobotVolume: async (volume) => {
    await runAction("settings", set, async () => {
      const state = get();
      const result = await robotService.setVolume(volume, {
        robot: state.robot,
        integration: state.integration
      });
      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot, volume } : { ...current.robot, volume },
        integration: result.integration ?? current.integration,
        settings: { ...current.settings, volume },
        logs: [appendLog("volume", { volume }, "success", result.message), ...current.logs].slice(0, 60),
        toasts: [appendToast("Volume updated", result.message, "info"), ...current.toasts].slice(0, 5)
      }));
      return result.message;
    });
  },

  setSpeed: (speed) =>
    set((state) => ({
      driveState: { ...state.driveState, speed }
    })),

  togglePrecisionMode: () =>
    set((state) => ({
      driveState: { ...state.driveState, precisionMode: !state.driveState.precisionMode }
    })),

  speakText: async (text) => {
    await runAction("speak", set, async () => {
      const state = get();
      const result = await robotService.speak(text, {
        robot: state.robot,
        integration: state.integration
      });
      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot } : current.robot,
        integration: result.integration ?? current.integration,
        logs: [appendLog("speak", { text }, "success", result.message), ...current.logs].slice(0, 60),
        toasts: [appendToast("Voice sent", result.message, "success"), ...current.toasts].slice(0, 5)
      }));
      return result.message;
    });
  },

  playAnimation: async (animationId) => {
    await runAction("animation", set, async () => {
      const animation = get().animations.find((item) => item.id === animationId);
      if (!animation) {
        throw new Error("That animation was not found.");
      }

      const state = get();
      const result = await robotService.playAnimation(animation, {
        robot: state.robot,
        integration: state.integration
      });
      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot } : current.robot,
        integration: result.integration ?? current.integration,
        logs: [
          appendLog("animation", { animationId }, "success", result.message),
          ...current.logs
        ].slice(0, 60),
        queuedAnimations: current.queuedAnimations.filter((item) => item !== animationId),
        toasts: [appendToast("Animation played", result.message, "success"), ...current.toasts].slice(0, 5)
      }));
      return result.message;
    });
  },

  queueAnimation: (animationId) =>
    set((state) => ({
      queuedAnimations: [...state.queuedAnimations, animationId].slice(-8),
      logs: [
        appendLog("animation-queue", { animationId }, "queued", "Animation queued."),
        ...state.logs
      ].slice(0, 60),
      toasts: [appendToast("Queued", "Animation added to the queue.", "info"), ...state.toasts].slice(0, 5)
    })),

  playQueuedAnimations: async () => {
    const queue = [...get().queuedAnimations];
    for (const animationId of queue) {
      await get().playAnimation(animationId);
    }
  },

  playRandomAnimation: async () => {
    const animations = get().animations;
    const random = animations[Math.floor(Math.random() * animations.length)];
    if (random) {
      await get().playAnimation(random.id);
    }
  },

  runDiagnostics: async () => {
    await runAction("diagnostics", set, async () => {
      const state = await syncSavedTargetWithBackend(get(), set, { force: true });
      try {
        const result = await robotService.runDiagnostics(state);
        if (!result.data) {
          throw new Error("Diagnostics finished without a report.");
        }
        const { report, snapshot } = result.data;
        const level =
          report.overallStatus === "healthy"
            ? "success"
            : report.overallStatus === "critical"
              ? "warning"
              : "info";

        set((current) => ({
          robot: snapshot.robot,
          integration: snapshot.integration,
          settings: {
            ...current.settings,
            robotSerial:
              selectRobotSerial(
                snapshot.robot.serial,
                snapshot.integration.selectedSerial,
                current.settings.robotSerial
              ) || current.settings.robotSerial
          },
          logs: snapshot.logs,
          diagnosticReports: [report, ...current.diagnosticReports].slice(0, 12),
          notifications: [
            createNotification("Diagnostics finished", result.message, level, "system"),
            ...current.notifications
          ].slice(0, 20),
          toasts: [appendToast("Diagnostics stored", result.message, level), ...current.toasts].slice(0, 5)
        }));
        return result.message;
      } catch (error) {
        const fallbackState = hydrateSavedTargetContext(get());
        const savedCandidate = buildSavedTargetCandidate(fallbackState);
        const savedSerial = savedCandidate?.serial || "";
        const savedIpAddress = savedCandidate?.ipAddress || "";
        const bridgeOffline = isNetworkError(error) || !fallbackState.integration.wirePodReachable;
        const message = bridgeOffline
          ? "Desktop backend offline. Start it on your PC, then run diagnostics again."
          : "The local bridge is up, but Vector is still offline. Retry connection or Quick repair before diagnostics.";

        set((current) => ({
          robot: {
            ...current.robot,
            serial: savedSerial || current.robot.serial,
            ipAddress: savedIpAddress || current.robot.ipAddress,
            isConnected: false,
            connectionState: "error",
            systemStatus: current.robot.isDocked
              ? current.robot.isCharging
                ? "charging"
                : "docked"
              : "offline",
            currentActivity: bridgeOffline
              ? "Diagnostics are waiting for the desktop backend."
              : "Diagnostics are waiting for the robot to answer again."
          },
          integration: {
            ...current.integration,
            wirePodReachable: bridgeOffline ? false : current.integration.wirePodReachable,
            robotReachable: false,
            selectedSerial: savedSerial || current.integration.selectedSerial,
            note: message
          },
          settings: savedSerial
            ? {
                ...current.settings,
                robotSerial: savedSerial
              }
            : current.settings,
          notifications: [
            createNotification(
              bridgeOffline ? "Diagnostics waiting" : "Robot still offline",
              message,
              "warning",
              "system"
            ),
            ...current.notifications
          ].slice(0, 20)
        }));

        throw new ActionFeedbackError(
          message,
          bridgeOffline ? "Diagnostics waiting" : "Robot still offline"
        );
      }
    });
  },

  repairVoiceSetup: async () => {
    await runAction("voice", set, async () => {
      const state = await syncSavedTargetWithBackend(get(), set, { force: true });
      const result = await robotService.repairVoiceSetup({
        robot: state.robot,
        integration: state.integration
      });

      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot } : current.robot,
        integration: result.integration ?? current.integration,
        logs: [
          appendLog("voice-repair", {}, "success", result.message),
          ...current.logs
        ].slice(0, 60),
        notifications: [
          createNotification("Voice setup refreshed", result.message, "info", "system"),
          ...current.notifications
        ].slice(0, 20),
        toasts: [appendToast("Voice defaults refreshed", result.message, "success"), ...current.toasts].slice(0, 5)
      }));

      return result.message;
    });
  },

  quickRepair: async () => {
    await runAction("support", set, async () => {
      const state = await syncSavedTargetWithBackend(get(), set, { force: true });
      try {
        const result = await robotService.quickRepair(state);
        if (!result.data) {
          throw new Error("Quick repair did not return a result.");
        }
        const data = result.data;
        const repairedSerial = selectRobotSerial(
          data.snapshot.robot.serial,
          data.snapshot.integration.selectedSerial,
          state.settings.robotSerial
        );

        set((current) => ({
          robot: data.snapshot.robot,
          integration: data.snapshot.integration,
          settings: repairedSerial
            ? {
                ...current.settings,
                robotSerial: repairedSerial
              }
            : current.settings,
          logs: data.snapshot.logs,
          diagnosticReports: current.diagnosticReports,
          notifications: [
            createNotification("Quick repair finished", result.message, data.repair.overallStatus === "failed" ? "warning" : "info", "system"),
            ...current.notifications
          ].slice(0, 20),
          toasts: [
            appendToast(
              data.repair.overallStatus === "repaired" ? "Quick repair worked" : "Quick repair finished",
              result.message,
              data.repair.overallStatus === "failed" ? "warning" : "success"
            ),
            ...current.toasts
          ].slice(0, 5)
        }));

        return result.message;
      } catch (error) {
        const fallbackState = hydrateSavedTargetContext(get());
        const savedCandidate = buildSavedTargetCandidate(fallbackState);
        const savedSerial = savedCandidate?.serial || "";
        const savedIpAddress = savedCandidate?.ipAddress || "";
        const message = "Desktop backend offline. Quick repair needs the desktop backend running on your PC.";

        if (!savedCandidate && !isNetworkError(error)) {
          throw error;
        }

        set((current) => ({
          robot: {
            ...current.robot,
            serial: savedSerial || current.robot.serial,
            ipAddress: savedIpAddress || current.robot.ipAddress,
            isConnected: false,
            connectionState: "error",
            systemStatus: current.robot.isDocked
              ? current.robot.isCharging
                ? "charging"
                : "docked"
              : "offline",
            currentActivity: "Quick repair is waiting for the desktop backend."
          },
          integration: {
            ...current.integration,
            wirePodReachable: false,
            robotReachable: false,
            selectedSerial: savedSerial || current.integration.selectedSerial,
            note: message
          },
          settings: savedSerial
            ? {
                ...current.settings,
                robotSerial: savedSerial
              }
            : current.settings,
          notifications: [
            createNotification(
              "Quick repair waiting",
              message,
              "warning",
              "system"
            ),
            ...current.notifications
          ].slice(0, 20)
        }));

        throw new ActionFeedbackError(message, "Quick repair waiting");
      }
    });
  },

  reportProblem: async ({ summary, details, contactEmail }) => {
    await runAction("support", set, async () => {
      const state = await syncSavedTargetWithBackend(get(), set, { force: true });
      const result = await robotService.reportProblem(state, {
        summary,
        details,
        contactEmail
      });
      if (!result.data) {
        throw new Error("Problem report did not return a saved report.");
      }
      const data = result.data;
      const repairedSerial = selectRobotSerial(
        data.snapshot.robot.serial,
        data.snapshot.integration.selectedSerial,
        state.settings.robotSerial
      );

      set((current) => ({
        robot: data.snapshot.robot,
        integration: data.snapshot.integration,
        settings: repairedSerial
          ? {
              ...current.settings,
              robotSerial: repairedSerial
            }
          : current.settings,
        logs: data.snapshot.logs,
        supportReports: data.reports,
        notifications: [
          createNotification("Problem report saved", result.message, "info", "system"),
          ...current.notifications
        ].slice(0, 20),
        toasts: [appendToast("Problem report saved", result.message, "success"), ...current.toasts].slice(0, 5)
      }));

      return result.message;
    });
  },

  returnToDock: async () => {
    await runAction("dock", set, async () => {
      const state = get();
      const result = await robotService.dock({
        robot: state.robot,
        integration: state.integration
      });
      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot } : current.robot,
        integration: result.integration ?? current.integration,
        notifications: [
          createNotification(
            "Charging sequence started",
            result.message,
            "success",
            "system"
          ),
          ...current.notifications
        ].slice(0, 20),
        logs: [appendLog("dock", {}, "success", result.message), ...current.logs].slice(0, 60),
        toasts: [appendToast("Returning to charger", result.message, "success"), ...current.toasts].slice(0, 5)
      }));
      return result.message;
    });
  },

  toggleMute: async () => {
    const nextMuted = !get().robot.isMuted;
    await runAction("settings", set, async () => {
      const state = get();
      const result = await robotService.toggleMute(nextMuted, {
        robot: state.robot,
        integration: state.integration
      });
      set((current) => ({
        robot: result.robot ? { ...current.robot, ...result.robot, isMuted: nextMuted } : { ...current.robot, isMuted: nextMuted },
        integration: result.integration ?? current.integration,
        logs: [
          appendLog("mute", { isMuted: nextMuted }, "success", result.message),
          ...current.logs
        ].slice(0, 60),
        toasts: [appendToast("Audio updated", result.message, "info"), ...current.toasts].slice(0, 5)
      }));
      return result.message;
    });
  },

  takeSnapshot: async () => {
    await runAction("photo", set, async () => {
      const result = await robotService.takePhoto(get().snapshots.length);
      if (!result.data) {
        throw new Error("Snapshot failed.");
      }

      const photoData = result.data;
      const snapshot: CameraSnapshot | undefined = photoData.latestSnapshot;
      set((state) => ({
        snapshots:
          photoData.snapshots.length > 0
            ? photoData.snapshots.slice(0, 12)
            : snapshot
              ? [snapshot, ...state.snapshots].slice(0, 12)
              : state.snapshots,
        visionEvents: snapshot
          ? [
              {
                id: crypto.randomUUID(),
                label:
                  photoData.syncedCount > 0
                    ? `Synced ${photoData.syncedCount} robot photo${photoData.syncedCount === 1 ? "" : "s"}`
                    : "Photo library checked",
                createdAt: new Date().toISOString(),
                confidence: 1
              },
              ...state.visionEvents
            ].slice(0, 12)
          : state.visionEvents,
        logs: [
          appendLog("photo", { syncedCount: photoData.syncedCount }, "success", result.message),
          ...state.logs
        ].slice(0, 60),
        toasts: [
          appendToast(
            photoData.syncedCount > 0 ? "Photos synced" : "Library checked",
            result.message,
            "success"
          ),
          ...state.toasts
        ].slice(0, 5)
      }));
      return result.message;
    });
  },

  syncPhotos: async () => {
    await runAction("photo", set, async () => {
      const result = await robotService.syncPhotos();
      if (!result.data) {
        throw new Error("Photo sync did not return any library data.");
      }

      const photoData = result.data;
      const snapshot: CameraSnapshot | undefined = photoData.latestSnapshot;

      set((state) => ({
        snapshots:
          photoData.snapshots.length > 0
            ? photoData.snapshots.slice(0, 12)
            : state.snapshots,
        visionEvents: snapshot
          ? [
              {
                id: crypto.randomUUID(),
                label:
                  photoData.syncedCount > 0
                    ? `Synced ${photoData.syncedCount} robot photo${photoData.syncedCount === 1 ? "" : "s"}`
                    : "Photo library checked",
                createdAt: new Date().toISOString(),
                confidence: 1
              },
              ...state.visionEvents
            ].slice(0, 12)
          : state.visionEvents,
        logs: [
          appendLog("photo-sync", { syncedCount: photoData.syncedCount }, "success", result.message),
          ...state.logs
        ].slice(0, 60),
        toasts: [
          appendToast(
            photoData.syncedCount > 0 ? "Photos synced" : "Library checked",
            result.message,
            "success"
          ),
          ...state.toasts
        ].slice(0, 5)
      }));

      return result.message;
    });
  },

  deleteSnapshot: async (photoId) => {
    await runAction("photo", set, async () => {
      const state = get();
      const result = await robotService.deletePhoto(photoId, state.snapshots);
      if (!result.data) {
        throw new Error("Photo delete did not return an updated library.");
      }

      const photoData = result.data;
      set((current) => ({
        snapshots: photoData.snapshots.slice(0, 12),
        logs: [
          appendLog("photo-delete", { photoId }, "success", result.message),
          ...current.logs
        ].slice(0, 60),
        toasts: [appendToast("Photo deleted", result.message, "success"), ...current.toasts].slice(0, 5)
      }));

      return result.message;
    });
  },

  clearLogs: () => set(() => ({ logs: [] })),

  exportState: () => exportSnapshot(get())
});
