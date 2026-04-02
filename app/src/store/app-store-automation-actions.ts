import { robotService } from "@/services/robotService";

import type { AppState, AppStoreGet, AppStoreSet } from "./app-store-types";
import {
  appendLog,
  appendToast,
  attachRoamSimulation,
  createNotification,
  getActiveRoamSession,
  runAction,
  stopRoamSimulation
} from "./app-store-utils";

export const createAutomationActions = (
  set: AppStoreSet,
  get: AppStoreGet
): Pick<
  AppState,
  "updateAutomationControl" | "startRoam" | "pauseRoam" | "resumeRoam" | "stopRoam"
> => ({
  updateAutomationControl: (patch) =>
    set((state) => ({
      automationControl: {
        ...state.automationControl,
        ...patch,
        targetArea:
          patch.targetArea === undefined
            ? state.automationControl.targetArea
            : patch.targetArea.trim() || "Desk perimeter",
        autoDockThreshold:
          patch.autoDockThreshold === undefined
            ? state.automationControl.autoDockThreshold
            : Math.min(70, Math.max(10, Math.round(patch.autoDockThreshold)))
      }
    })),

  startRoam: async () => {
    await runAction("automation", set, async () => {
      const state = get();
      const activeSession = getActiveRoamSession(state);

      if (activeSession && activeSession.status !== "completed") {
        throw new Error("A roam session is already active.");
      }

      const result = await robotService.startRoam(
        state.robot,
        state.automationControl,
        state.roamSessions.length
      );

      if (!result.data) {
        throw new Error("Roam did not return a session.");
      }

      const session = result.data;
      attachRoamSimulation(get, set);

      set((current) => ({
        roamSessions: [session, ...current.roamSessions].slice(0, 18),
        robot: {
          ...current.robot,
          mood: "focused",
          isCharging: false,
          lastSeen: session.startedAt
        },
        automationControl: {
          ...current.automationControl,
          status: "running",
          activeSessionId: session.id,
          startedAt: session.startedAt,
          lastHeartbeatAt: session.startedAt
        },
        notifications: [
          createNotification(
            "Autonomous roam started",
            `${current.robot.nickname ?? current.robot.name} is roaming ${current.automationControl.targetArea}.`,
            "info",
            "robot"
          ),
          ...current.notifications
        ].slice(0, 20),
        logs: [
          appendLog(
            "automation-start",
            {
              sessionId: session.id,
              behavior: session.behavior,
              targetArea: session.targetArea
            },
            "success",
            result.message
          ),
          ...current.logs
        ].slice(0, 60),
        toasts: [appendToast("Roam running", result.message, "success"), ...current.toasts].slice(0, 5)
      }));

      return result.message;
    });
  },

  pauseRoam: async () => {
    await runAction("automation", set, async () => {
      const activeSession = getActiveRoamSession(get());
      if (!activeSession) {
        throw new Error("There is no active roam session to pause.");
      }

      const result = await robotService.pauseRoam(activeSession);
      if (!result.data) {
        throw new Error("Pause did not return an updated session.");
      }

      const session = result.data;
      stopRoamSimulation();

      set((state) => ({
        roamSessions: state.roamSessions.map((item) =>
          item.id === activeSession.id ? session : item
        ),
        automationControl: {
          ...state.automationControl,
          status: "paused",
          lastHeartbeatAt: new Date().toISOString()
        },
        logs: [
          appendLog("automation-pause", { sessionId: activeSession.id }, "success", result.message),
          ...state.logs
        ].slice(0, 60),
        toasts: [appendToast("Roam paused", result.message, "info"), ...state.toasts].slice(0, 5)
      }));

      return result.message;
    });
  },

  resumeRoam: async () => {
    await runAction("automation", set, async () => {
      const activeSession = getActiveRoamSession(get());
      if (!activeSession) {
        throw new Error("There is no paused roam session to resume.");
      }

      const result = await robotService.resumeRoam(activeSession);
      if (!result.data) {
        throw new Error("Resume did not return an updated session.");
      }

      const session = result.data;
      attachRoamSimulation(get, set);

      set((state) => ({
        roamSessions: state.roamSessions.map((item) =>
          item.id === activeSession.id ? session : item
        ),
        robot: {
          ...state.robot,
          mood: "focused",
          isCharging: false
        },
        automationControl: {
          ...state.automationControl,
          status: "running",
          lastHeartbeatAt: new Date().toISOString()
        },
        logs: [
          appendLog("automation-resume", { sessionId: activeSession.id }, "success", result.message),
          ...state.logs
        ].slice(0, 60),
        toasts: [appendToast("Roam resumed", result.message, "success"), ...state.toasts].slice(0, 5)
      }));

      return result.message;
    });
  },

  stopRoam: async () => {
    await runAction("automation", set, async () => {
      const state = get();
      const activeSession = getActiveRoamSession(state);
      if (!activeSession) {
        throw new Error("There is no roam session to stop.");
      }

      const result = await robotService.stopRoam(activeSession, state.robot);
      if (!result.data) {
        throw new Error("Stop did not return a completed roam session.");
      }

      const session = result.data;
      stopRoamSimulation();

      set((current) => ({
        roamSessions: current.roamSessions.map((item) =>
          item.id === activeSession.id ? session : item
        ),
        robot: {
          ...current.robot,
          mood: current.robot.isCharging ? "charging" : "ready",
          lastSeen: session.endedAt ?? new Date().toISOString()
        },
        automationControl: {
          ...current.automationControl,
          status: "idle",
          activeSessionId: undefined,
          lastHeartbeatAt: session.endedAt ?? new Date().toISOString()
        },
        notifications: [
          createNotification(
            "Roam saved locally",
            `${session.name} finished and its telemetry is stored on this device.`,
            "success",
            "system"
          ),
          ...current.notifications
        ].slice(0, 20),
        logs: [
          appendLog("automation-stop", { sessionId: activeSession.id }, "success", result.message),
          ...current.logs
        ].slice(0, 60),
        toasts: [appendToast("Roam stored", result.message, "success"), ...current.toasts].slice(0, 5)
      }));

      return result.message;
    });
  }
});
