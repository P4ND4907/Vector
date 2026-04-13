import { robotService } from "@/services/robotService";
import { mobileRuntimeNeedsManualBackendUrl } from "@/lib/runtime-target";
import { selectRobotSerial } from "@/lib/robot-serial";

import type { AppState, AppStoreGet, AppStoreSet } from "./app-store-types";
import {
  appendLog,
  appendToast,
  attachRoamSimulation,
  attachTelemetrySubscription,
  createNotification,
  mergePersistedState,
  runAction,
  stopRoamSimulation
} from "./app-store-utils";

const mergeBootstrapSnapshot = (
  currentState: AppState,
  snapshot: AppState,
  settingsOverride: AppState["settings"]
): AppState => {
  const resolvedRobotSerial = selectRobotSerial(
    snapshot.settings.robotSerial,
    snapshot.integration.selectedSerial,
    snapshot.robot.serial,
    currentState.settings.robotSerial
  );
  const merged = mergePersistedState(
    {
      ...currentState,
      ...snapshot,
      settings: {
        ...currentState.settings,
        ...snapshot.settings,
        ...settingsOverride
      }
    },
    currentState
  );

  return {
    ...merged,
    robot: {
      ...snapshot.robot,
      nickname:
        settingsOverride.robotNickname ||
        snapshot.robot.nickname ||
        snapshot.robot.name
    },
    integration: snapshot.integration,
    settings: {
      ...merged.settings,
      ...snapshot.settings,
      ...settingsOverride,
      theme: merged.settings.theme,
      colorTheme: merged.settings.colorTheme,
      appBackendUrl: settingsOverride.appBackendUrl || merged.settings.appBackendUrl,
      robotNickname: settingsOverride.robotNickname || merged.settings.robotNickname,
      robotSerial: resolvedRobotSerial || merged.settings.robotSerial
    },
    savedProfiles: snapshot.savedProfiles.length ? snapshot.savedProfiles : merged.savedProfiles,
    routines: snapshot.routines,
    logs: snapshot.logs,
    availableRobots: snapshot.availableRobots,
    supportReports: snapshot.supportReports,
    snapshots: snapshot.snapshots.length ? snapshot.snapshots : merged.snapshots
  };
};

export const createSystemActions = (
  set: AppStoreSet,
  get: AppStoreGet
): Pick<
  AppState,
  | "saveRoutine"
  | "removeRoutine"
  | "toggleRoutine"
  | "runRoutineNow"
  | "addReminder"
  | "markNotificationRead"
  | "updateSettings"
  | "clearRobot"
  | "resetSettings"
  | "switchEngineProvider"
  | "recordAiCommandHistory"
  | "importState"
> => ({
  saveRoutine: async (routine) => {
    await runAction("routine", set, async () => {
      const result = await robotService.saveRoutine(routine);
      set((state) => ({
        routines: [
          result.data ?? routine,
          ...state.routines.filter((item) => item.id !== routine.id)
        ],
        logs: [
          appendLog("routine-save", { routineId: routine.id }, "success", result.message),
          ...state.logs
        ].slice(0, 60),
        toasts: [appendToast("Routine saved", result.message, "success"), ...state.toasts].slice(0, 5)
      }));
      return result.message;
    });
  },

  removeRoutine: async (routineId) => {
    await runAction("routine", set, async () => {
      const result = await robotService.deleteRoutine(routineId);
      set((state) => ({
        routines: state.routines.filter((routine) => routine.id !== routineId),
        logs: [
          appendLog("routine-delete", { routineId }, "success", result.message),
          ...state.logs
        ].slice(0, 60),
        toasts: [appendToast("Routine deleted", result.message, "info"), ...state.toasts].slice(0, 5)
      }));
      return result.message;
    });
  },

  toggleRoutine: async (routineId) => {
    const routine = get().routines.find((item) => item.id === routineId);
    if (!routine) {
      return;
    }

    const nextEnabled = !routine.enabled;
    set((state) => ({
      routines: state.routines.map((item) =>
        item.id === routineId ? { ...item, enabled: nextEnabled } : item
      )
    }));

    try {
      const result = await robotService.updateRoutine(routineId, { enabled: nextEnabled });
      set((state) => ({
        routines: state.routines.map((item) =>
          item.id === routineId ? { ...(result.data ?? item), enabled: nextEnabled } : item
        ),
        logs: [
          appendLog("routine-toggle", { routineId, enabled: nextEnabled }, "success", result.message),
          ...state.logs
        ].slice(0, 60)
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Routine update failed.";
      set((state) => ({
        routines: state.routines.map((item) =>
          item.id === routineId ? { ...item, enabled: routine.enabled } : item
        ),
        logs: [
          appendLog("routine-toggle", { routineId, enabled: nextEnabled }, "error", message),
          ...state.logs
        ].slice(0, 60),
        toasts: [appendToast("Routine update failed", message, "warning"), ...state.toasts].slice(0, 5)
      }));
    }
  },

  runRoutineNow: async (routineId) => {
    const routine = get().routines.find((item) => item.id === routineId);
    if (!routine) {
      return;
    }

    await runAction("routine", set, async () => {
      for (const action of routine.actions) {
        if (action.type === "speak") {
          await get().speakText(action.value);
        }
        if (action.type === "animation") {
          await get().playAnimation(action.value);
        }
        if (action.type === "dock") {
          await get().returnToDock();
        }
        if (action.type === "stop") {
          await get().driveRobot("stop");
        }
      }

      set((state) => ({
        routines: state.routines.map((item) =>
          item.id === routineId ? { ...item, lastRunAt: new Date().toISOString() } : item
        ),
        notifications: [
          createNotification(
            "Routine complete",
            `"${routine.name}" finished without errors.`,
            "success",
            "system"
          ),
          ...state.notifications
        ].slice(0, 20)
      }));

      return `"${routine.name}" executed.`;
    });
  },

  addReminder: (title, description) =>
    set((state) => ({
      notifications: [
        createNotification(title, description, "info", "robot"),
        ...state.notifications
      ].slice(0, 20),
      logs: [
        appendLog(
          "reminder",
          { title },
          "success",
          "Custom reminder queued for robot voice playback."
        ),
        ...state.logs
      ].slice(0, 60)
    })),

  markNotificationRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    })),

  updateSettings: async (patch) => {
    await runAction("settings", set, async () => {
      const state = get();
      const result = await robotService.updateSettings(
        patch,
        state.settings,
        state.integration,
        state.robot
      );
      set((current) => ({
        settings: {
          ...current.settings,
          ...result.settings
        },
        integration: result.integration,
        robot: {
          ...(result.robot ?? current.robot),
          nickname:
            result.settings.robotNickname ||
            (result.robot ?? current.robot).nickname ||
            (result.robot ?? current.robot).name,
          serial: selectRobotSerial(
            result.settings.robotSerial,
            result.integration.selectedSerial,
            (result.robot ?? current.robot).serial
          )
        }
      }));

      const nextSettings = {
        ...get().settings
      };
      const shouldRefreshBackendConnection = Boolean(
        patch.appBackendUrl && nextSettings.appBackendUrl && !nextSettings.mockMode
      );

      if (shouldRefreshBackendConnection) {
        try {
          const snapshot = await robotService.bootstrap();
          const refreshedState = mergeBootstrapSnapshot(
            get(),
            {
              ...get(),
              ...snapshot
            },
            nextSettings
          );

          set(() => ({
            ...refreshedState,
            initialized: true,
            telemetryActive: true,
            robot: {
              ...refreshedState.robot,
              nickname:
                refreshedState.settings.robotNickname ||
                refreshedState.robot.nickname ||
                refreshedState.robot.name
            }
          }));

          attachTelemetrySubscription(get, set);

          if (refreshedState.automationControl.status === "running") {
            attachRoamSimulation(get, set);
          }

          return refreshedState.integration.note || "Backend URL saved and desktop backend is online.";
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "The desktop backend did not answer after saving the new URL.";

          set((current) => ({
            integration: {
              ...current.integration,
              note: `Backend URL saved, but ${message}`
            },
            robot: {
              ...current.robot,
              currentActivity:
                current.robot.currentActivity || "Waiting for the desktop backend."
            }
          }));

          return `Backend URL saved, but ${message}`;
        }
      }

      if (
        get().initialized &&
        !get().telemetryActive &&
        (result.settings.mockMode || !mobileRuntimeNeedsManualBackendUrl())
      ) {
        attachTelemetrySubscription(get, set);
      }

      return result.integration.note || "Settings updated.";
    });
  },

  recordAiCommandHistory: (item) =>
    set((state) => ({
      aiCommandHistory: [item, ...state.aiCommandHistory].slice(0, 20)
    })),

  clearRobot: async () => {
    await runAction("settings", set, async () => {
      const state = get();
      await robotService.updateSettings({ robotSerial: "" }, state.settings, state.integration, state.robot);
      set((current) => ({
        settings: { ...current.settings, robotSerial: "" },
        integration: { ...current.integration, selectedSerial: undefined }
      }));
      return "Robot target cleared. The app will need a fresh scan or connection next time.";
    });
  },

  resetSettings: async () => {
    await runAction("settings", set, async () => {
      const state = get();
      const result = await robotService.updateSettings({
        mockMode: false,
        reconnectOnStartup: true,
        autoDetectWirePod: true,
        customWirePodEndpoint: "",
        pollingIntervalMs: 6000
      }, state.settings, state.integration, state.robot);
      set((current) => ({
        settings: { ...current.settings, ...result.settings }
      }));
      return "Settings reset to defaults.";
    });
  },

  switchEngineProvider: async (provider: "embedded" | "wirepod" | "external") => {
    await runAction("settings", set, async () => {
      const { engineApi } = await import("@/services/robotService");
      await engineApi.switchProvider(provider);
      return `Engine provider switched to ${provider}.`;
    });
  },

  importState: (value) => {
    set((state) => ({
      ...state,
      ...value,
      initialized: true
    }));

    if (value.automationControl?.status === "running") {
      attachRoamSimulation(get, set);
    } else {
      stopRoamSimulation();
    }
  }
});
