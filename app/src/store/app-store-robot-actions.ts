import { robotService } from "@/services/robotService";
import type { CameraSnapshot, PairingCandidate } from "@/types";

import type { AppState, AppStoreGet, AppStoreSet } from "./app-store-types";
import {
  appendLog,
  appendToast,
  attachRoamSimulation,
  attachTelemetrySubscription,
  createNotification,
  exportSnapshot,
  mergePersistedState,
  runAction
} from "./app-store-utils";

const toTrimmedSerial = (value: string | undefined) => value?.trim();

const findSerialFromCandidates = (state: AppState, candidates: PairingCandidate[]) => {
  if (toTrimmedSerial(state.settings.robotSerial)) {
    return undefined;
  }

  const discoveredSerials = candidates
    .map((candidate) => toTrimmedSerial(candidate.serial))
    .filter((serial): serial is string => Boolean(serial));

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
    const selected = toTrimmedSerial(state.integration.selectedSerial);
    if (selected && discoveredSerials.includes(selected)) {
      return selected;
    }
  }

  if (state.robot.serial) {
    const current = toTrimmedSerial(state.robot.serial);
    if (current && discoveredSerials.includes(current) && current !== "vector-local") {
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

const buildRobotWithAutoSerial = (
  state: AppState,
  serial: string
): { robotSerial: string; robot: AppState["robot"] } => {
  const serialCandidate = findCandidateBySerial(state.availableRobots, serial);
  const robotHasValidSerial = Boolean(toTrimmedSerial(state.robot.serial));

  return {
    robotSerial: serial,
    robot: robotHasValidSerial
      ? state.robot
      : {
          ...state.robot,
          serial,
          ipAddress: serialCandidate?.ipAddress || state.robot.ipAddress
        }
  };
};

const mergeSnapshotWithPersistedUi = (freshState: AppState, persistedState: AppState) => {
  const merged = mergePersistedState(freshState, persistedState);

  return {
    ...merged,
    robot: freshState.robot,
    integration: freshState.integration,
    settings: {
      ...merged.settings,
      ...freshState.settings,
      theme: merged.settings.theme,
      colorTheme: merged.settings.colorTheme,
      appBackendUrl: merged.settings.appBackendUrl,
      robotNickname: freshState.settings.robotNickname || merged.settings.robotNickname
    },
    savedProfiles: freshState.savedProfiles.length ? freshState.savedProfiles : merged.savedProfiles,
    routines: freshState.routines,
    logs: freshState.logs,
    availableRobots: freshState.availableRobots,
    supportReports: freshState.supportReports,
    snapshots: freshState.snapshots.length ? freshState.snapshots : merged.snapshots
  };
};

const isSameSavedProfile = (left: { id: string; serial?: string; ipAddress: string }, right: { id: string; serial?: string; ipAddress: string }) =>
  Boolean(left.serial && right.serial)
    ? left.serial === right.serial
    : left.id === right.id || left.ipAddress === right.ipAddress;

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
      if (!get().telemetryActive) {
        attachTelemetrySubscription(get, set);
      }
      if (get().automationControl.status === "running") {
        attachRoamSimulation(get, set);
      }
      return;
    }

    await runAction("bootstrap", set, async () => {
      const snapshot = await robotService.bootstrap();
      const existingState = get();
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

      set(() => ({
        ...nextState,
        initialized: true,
        telemetryActive: true,
        robot: {
          ...nextState.robot,
          nickname: nextState.settings.robotNickname || nextState.robot.nickname || nextState.robot.name
        }
      }));

      attachTelemetrySubscription(get, set);

      if (mergedState.automationControl.status === "running") {
        attachRoamSimulation(get, set);
      }

      return mergedState.integration.note || "Vector dashboard initialized.";
    });
  },

  dismissToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId)
    })),

  scanForRobots: async () => {
    await runAction("scan", set, async () => {
      const result = await robotService.scanNetwork();
      const autoRobotSerial = findSerialFromCandidates(get(), result.robots);

      const nextSettings = autoRobotSerial ? { ...get().settings, robotSerial: autoRobotSerial } : get().settings;
      const nextRobot = autoRobotSerial ? buildRobotWithAutoSerial(get(), autoRobotSerial).robot : get().robot;

      set((state) => ({
        availableRobots: result.robots,
        robot: autoRobotSerial ? nextRobot : state.robot,
        settings: autoRobotSerial ? nextSettings : state.settings,
        integration: result.integration,
        logs: [
          appendLog(
            "scan",
            { count: result.robots.length, autoSelectedSerial: autoRobotSerial ?? null },
            "success",
            autoRobotSerial ? "Local robot scan complete and serial auto-selected." : "Local robot scan complete."
          ),
          ...state.logs
        ].slice(0, 60),
        toasts: [
          appendToast(
            "Scan complete",
            autoRobotSerial
              ? `Found ${result.robots.length} nearby robot profiles. Auto-selected ${autoRobotSerial}.`
              : `Found ${result.robots.length} nearby robot profiles.`,
            "success"
          ),
          ...state.toasts
        ].slice(0, 5)
      }));
      return result.integration.note || "Local network scan complete.";
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
      const state = get();
      const resolvedSerial = toTrimmedSerial(
        state.robot.serial || state.settings.robotSerial || state.integration.selectedSerial
      );
      const robot = resolvedSerial
        ? { ...state.robot, serial: state.robot.serial || resolvedSerial }
        : state.robot;
      const shouldPersistSerial = Boolean(resolvedSerial && resolvedSerial !== toTrimmedSerial(state.settings.robotSerial));

      const result = await robotService.connect(robot, state.integration, state.settings);
      if (!result.data) {
        throw new Error("Robot did not return connection details.");
      }
      const data = result.data;

      set((current) => ({
        robot: {
          ...data.robot,
          nickname:
            current.settings.robotNickname ||
            data.robot.nickname ||
            data.robot.name
        },
        settings: shouldPersistSerial
          ? {
              ...current.settings,
              robotSerial: resolvedSerial || current.settings.robotSerial
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
          appendToast(data.robot.isConnected ? "Connected" : "Vector brain offline", result.message, data.robot.isConnected ? "success" : "warning"),
          ...current.toasts
        ].slice(0, 5)
      }));

      return result.message;
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
      const state = get();
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
        logs: snapshot.logs,
        diagnosticReports: [report, ...current.diagnosticReports].slice(0, 12),
        notifications: [
          createNotification("Diagnostics finished", result.message, level, "system"),
          ...current.notifications
        ].slice(0, 20),
        toasts: [appendToast("Diagnostics stored", result.message, level), ...current.toasts].slice(0, 5)
      }));
      return result.message;
    });
  },

  repairVoiceSetup: async () => {
    await runAction("voice", set, async () => {
      const state = get();
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
      const state = get();
      const result = await robotService.quickRepair(state);
      if (!result.data) {
        throw new Error("Quick repair did not return a result.");
      }
      const data = result.data;

      set((current) => ({
        robot: data.snapshot.robot,
        integration: data.snapshot.integration,
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
    });
  },

  reportProblem: async ({ summary, details, contactEmail }) => {
    await runAction("support", set, async () => {
      const state = get();
      const result = await robotService.reportProblem(state, {
        summary,
        details,
        contactEmail
      });
      if (!result.data) {
        throw new Error("Problem report did not return a saved report.");
      }
      const data = result.data;

      set((current) => ({
        robot: data.snapshot.robot,
        integration: data.snapshot.integration,
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
