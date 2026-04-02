import { cloneSnapshot } from "@/services/mockData";
import { robotService } from "@/services/robotService";
import type {
  ActionFeedback,
  AppSnapshot,
  NotificationItem,
  RoamSession,
  ToastItem
} from "@/types";

import type { AppState, AppStoreGet, AppStoreSet, PersistedSlice } from "./app-store-types";

export const baseSnapshot = cloneSnapshot();

export const actionDefaults = (): Record<string, ActionFeedback> => ({
  bootstrap: { status: "idle" },
  scan: { status: "idle" },
  pair: { status: "idle" },
  connect: { status: "idle" },
  disconnect: { status: "idle" },
  drive: { status: "idle" },
  speak: { status: "idle" },
  animation: { status: "idle" },
  diagnostics: { status: "idle" },
  automation: { status: "idle" },
  dock: { status: "idle" },
  wake: { status: "idle" },
  photo: { status: "idle" },
  routine: { status: "idle" },
  settings: { status: "idle" }
});

export const makeId = () => crypto.randomUUID();

export const appendLog = (
  type: string,
  payload: Record<string, unknown>,
  status: "success" | "error" | "queued",
  resultMessage: string
) => ({
  id: makeId(),
  type,
  payload,
  status,
  createdAt: new Date().toISOString(),
  resultMessage
});

export const appendToast = (
  title: string,
  description: string,
  level: ToastItem["level"]
): ToastItem => ({
  id: makeId(),
  title,
  description,
  level
});

export const createNotification = (
  title: string,
  description: string,
  level: NotificationItem["level"],
  channel: NotificationItem["channel"]
): NotificationItem => ({
  id: makeId(),
  title,
  description,
  level,
  createdAt: new Date().toISOString(),
  read: false,
  channel
});

export const getActiveRoamSession = (state: Pick<AppState, "roamSessions" | "automationControl">) =>
  state.roamSessions.find((session) => session.id === state.automationControl.activeSessionId);

export const runAction = async (
  key: string,
  set: AppStoreSet,
  action: () => Promise<string>
) => {
  set((state) => ({
    actionStates: {
      ...state.actionStates,
      [key]: { status: "loading", updatedAt: new Date().toISOString() }
    }
  }));

  try {
    const message = await action();
    set((state) => ({
      actionStates: {
        ...state.actionStates,
        [key]: { status: "success", message, updatedAt: new Date().toISOString() }
      }
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected robot error.";
    set((state) => ({
      actionStates: {
        ...state.actionStates,
        [key]: { status: "error", message, updatedAt: new Date().toISOString() }
      },
      logs: [appendLog(key, {}, "error", message), ...state.logs].slice(0, 60),
      toasts: [appendToast("Action failed", message, "warning"), ...state.toasts].slice(0, 5)
    }));
  }
};

export const mergePersistedState = (
  currentState: AppState,
  persistedState: PersistedSlice | undefined
): AppState => {
  if (!persistedState || typeof persistedState !== "object") {
    return currentState;
  }

  return {
    ...currentState,
    ...persistedState,
    robot: {
      ...currentState.robot,
      ...(persistedState.robot ?? {})
    },
    integration: {
      ...currentState.integration,
      ...(persistedState.integration ?? {})
    },
    driveState: {
      ...currentState.driveState,
      ...(persistedState.driveState ?? {})
    },
    settings: {
      ...currentState.settings,
      ...(persistedState.settings ?? {})
    },
    savedProfiles: Array.isArray(persistedState.savedProfiles)
      ? persistedState.savedProfiles
      : currentState.savedProfiles,
    routines: Array.isArray(persistedState.routines) ? persistedState.routines : currentState.routines,
    logs: Array.isArray(persistedState.logs) ? persistedState.logs : currentState.logs,
    notifications: Array.isArray(persistedState.notifications)
      ? persistedState.notifications
      : currentState.notifications,
    diagnosticReports: Array.isArray(persistedState.diagnosticReports)
      ? persistedState.diagnosticReports
      : currentState.diagnosticReports,
    roamSessions: Array.isArray(persistedState.roamSessions)
      ? persistedState.roamSessions
      : currentState.roamSessions,
    automationControl: {
      ...currentState.automationControl,
      ...(persistedState.automationControl ?? {})
    },
    aiCommandHistory: Array.isArray(persistedState.aiCommandHistory)
      ? persistedState.aiCommandHistory
      : currentState.aiCommandHistory,
    queuedAnimations: Array.isArray(persistedState.queuedAnimations)
      ? persistedState.queuedAnimations
      : currentState.queuedAnimations,
    animations: Array.isArray(persistedState.animations) ? persistedState.animations : currentState.animations,
    savedPhrases: Array.isArray(persistedState.savedPhrases)
      ? persistedState.savedPhrases
      : currentState.savedPhrases,
    snapshots: Array.isArray(persistedState.snapshots) ? persistedState.snapshots : currentState.snapshots,
    visionEvents: Array.isArray(persistedState.visionEvents)
      ? persistedState.visionEvents
      : currentState.visionEvents,
    availableRobots: Array.isArray(persistedState.availableRobots)
      ? persistedState.availableRobots
      : currentState.availableRobots
  };
};

let telemetryStopper: (() => void) | null = null;
let roamStopper: (() => void) | null = null;

export const stopRoamSimulation = () => {
  roamStopper?.();
  roamStopper = null;
};

export const attachTelemetrySubscription = (get: AppStoreGet, set: AppStoreSet) => {
  telemetryStopper?.();
  telemetryStopper = robotService.subscribeTelemetry(
    () => ({
      robot: get().robot,
      integration: get().integration,
      settings: get().settings
    }),
    ({ robot: nextRobot, integration }) => {
    set((state) => {
      const batteryAlertExists = state.notifications.some(
        (item) => item.title === "Low battery" && !item.read
      );

      const notifications =
        batteryAlertExists || nextRobot.batteryPercent > 20
          ? state.notifications
          : [
              createNotification(
                "Low battery",
                "Vector battery is under 20%. Consider docking soon.",
                "warning",
                "push"
              ),
              ...state.notifications
            ].slice(0, 20);

      return {
        robot: {
          ...nextRobot,
          nickname: state.settings.robotNickname || nextRobot.nickname || nextRobot.name
        },
        integration,
        notifications,
        telemetryActive: true
      };
    });
    }
  );
};

export const attachRoamSimulation = (get: AppStoreGet, set: AppStoreSet) => {
  stopRoamSimulation();
  roamStopper = robotService.subscribeRoam(
    () => getActiveRoamSession(get()),
    () => get().robot,
    () => get().automationControl,
    ({ session, robot, event, snapshot, shouldAutoDock }) => {
      set((state) => {
        const activeSession = getActiveRoamSession(state);
        if (!activeSession) {
          return {};
        }

        const nextSessions = state.roamSessions.map((item) =>
          item.id === activeSession.id ? session : item
        );

        if (!shouldAutoDock) {
          return {
            roamSessions: nextSessions,
            robot,
            automationControl: {
              ...state.automationControl,
              status: "running",
              lastHeartbeatAt: event.createdAt
            },
            snapshots: snapshot ? [snapshot, ...state.snapshots].slice(0, 12) : state.snapshots
          };
        }

        const completedSession: RoamSession = {
          ...session,
          status: "completed",
          endedAt: event.createdAt,
          batteryEnd: robot.batteryPercent,
          summary: "Roam stopped automatically and returned to a safe charging posture."
        };

        stopRoamSimulation();

        return {
          roamSessions: nextSessions.map((item) =>
            item.id === activeSession.id ? completedSession : item
          ),
          robot: {
            ...robot,
            isCharging: true,
            mood: "charging"
          },
          automationControl: {
            ...state.automationControl,
            status: "idle",
            activeSessionId: undefined,
            lastHeartbeatAt: event.createdAt
          },
          snapshots: snapshot ? [snapshot, ...state.snapshots].slice(0, 12) : state.snapshots,
          notifications: [
            createNotification(
              "Roam auto-docked",
              "Battery hit the auto-dock threshold, so the roam session was wrapped and stored locally.",
              "warning",
              "system"
            ),
            ...state.notifications
          ].slice(0, 20),
          logs: [
            appendLog(
              "automation-auto-dock",
              { sessionId: activeSession.id, batteryPercent: robot.batteryPercent },
              "success",
              "Autonomous roam stopped and returned to dock automatically."
            ),
            ...state.logs
          ].slice(0, 60),
          toasts: [
            appendToast(
              "Auto-docked",
              "Roam session ended safely at the battery threshold.",
              "warning"
            ),
            ...state.toasts
          ].slice(0, 5)
        };
      });
    }
  );
};

export const partializeState = (state: AppState): PersistedSlice => ({
  robot: state.robot,
  integration: state.integration,
  savedProfiles: state.savedProfiles,
  routines: state.routines,
  logs: state.logs,
  notifications: state.notifications,
  diagnosticReports: state.diagnosticReports,
  roamSessions: state.roamSessions,
  automationControl: state.automationControl,
  queuedAnimations: state.queuedAnimations,
  driveState: state.driveState,
  settings: state.settings,
  aiCommandHistory: state.aiCommandHistory,
  animations: state.animations,
  savedPhrases: state.savedPhrases,
  snapshots: state.snapshots,
  visionEvents: state.visionEvents,
  availableRobots: state.availableRobots
});

export const exportSnapshot = (state: AppSnapshot) =>
  JSON.stringify(
    {
      robot: state.robot,
      savedProfiles: state.savedProfiles,
      routines: state.routines,
      logs: state.logs,
      notifications: state.notifications,
      diagnosticReports: state.diagnosticReports,
      roamSessions: state.roamSessions,
      automationControl: state.automationControl,
      snapshots: state.snapshots,
      visionEvents: state.visionEvents,
      queuedAnimations: state.queuedAnimations,
      settings: state.settings
    },
    null,
    2
  );
