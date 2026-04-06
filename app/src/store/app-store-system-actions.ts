import { robotService } from "@/services/robotService";

import type { AppState, AppStoreGet, AppStoreSet } from "./app-store-types";
import {
  appendLog,
  appendToast,
  attachRoamSimulation,
  createNotification,
  runAction,
  stopRoamSimulation
} from "./app-store-utils";

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
      const result = await robotService.updateSettings(patch, state.settings, state.integration);
      set((current) => ({
        settings: {
          ...current.settings,
          ...result.settings
        },
        integration: result.integration,
        robot: {
          ...current.robot,
          nickname:
            result.settings.robotNickname ||
            current.robot.nickname ||
            current.robot.name,
          serial: result.settings.robotSerial || current.robot.serial
        }
      }));
      return result.integration.note || "Settings updated.";
    });
  },

  recordAiCommandHistory: (item) =>
    set((state) => ({
      aiCommandHistory: [item, ...state.aiCommandHistory].slice(0, 20)
    })),

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
