import { createBaseSnapshot } from "@/services/mockData";
import { robotService } from "@/services/robotService";
import {
  sanitizeAvailableRobotsForMode,
  sanitizeIntegrationForMode,
  sanitizeRobotForMode,
  sanitizeSavedProfilesForMode,
  sanitizeSettingsForMode
} from "@/lib/robot-serial";
import type {
  ActionFeedback,
  AppSnapshot,
  NotificationItem,
  RoamSession,
  ToastItem
} from "@/types";

import type { AppState, AppStoreGet, AppStoreSet, PersistedSlice } from "./app-store-types";

export const baseSnapshot = createBaseSnapshot();

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
  voice: { status: "idle" },
  support: { status: "idle" },
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

const exactLegacyCopyMap = new Map<string, string>([
  ["Vector brain offline", "Local bridge offline"],
  ["Local brain ready", "Local bridge ready"],
  ["Diagnostics failed.", "The diagnostics request did not finish."],
  ["Action failed", "Needs attention"]
]);

const legacyCopyReplacements: Array<[string, string]> = [
  ["Vector is not responding through WirePod right now.", "The local bridge is online, but Vector is not responding right now."],
  ["WirePod compatibility bridge answered the backend.", "The local bridge answered the backend."],
  ["Connected through local WirePod.", "Connected through the local bridge."],
  ["local WirePod bridge", "local bridge"],
  ["Local brain", "Local bridge"],
  ["local brain", "local bridge"]
];

const normalizeLegacyCopy = (value?: string) => {
  if (!value) {
    return value;
  }

  let next = exactLegacyCopyMap.get(value) ?? value;

  for (const [before, after] of legacyCopyReplacements) {
    if (next.includes(before)) {
      next = next.split(before).join(after);
    }
  }

  return next;
};

const actionFailureTitles: Record<string, string> = {
  bootstrap: "Startup needs attention",
  scan: "Scan needs attention",
  pair: "Setup needs attention",
  connect: "Connection needs attention",
  disconnect: "Disconnect needs attention",
  drive: "Drive command needs attention",
  speak: "Speech command needs attention",
  animation: "Animation command needs attention",
  diagnostics: "Diagnostics need attention",
  voice: "Voice setup needs attention",
  support: "Repair needs attention",
  automation: "Automation needs attention",
  dock: "Dock command needs attention",
  wake: "Wake command needs attention",
  photo: "Photo action needs attention",
  routine: "Routine update needs attention",
  settings: "Settings update needs attention"
};

export class ActionFeedbackError extends Error {
  readonly title?: string;

  constructor(message: string, title?: string) {
    super(message);
    this.name = "ActionFeedbackError";
    this.title = title;
  }
}

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
    const title =
      error instanceof ActionFeedbackError && error.title
        ? error.title
        : actionFailureTitles[key] || "Needs attention";
    set((state) => ({
      actionStates: {
        ...state.actionStates,
        [key]: { status: "error", message, updatedAt: new Date().toISOString() }
      },
      logs: [appendLog(key, {}, "error", message), ...state.logs].slice(0, 60),
      toasts: [appendToast(title, message, "warning"), ...state.toasts].slice(0, 5)
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

  const persistedAnimations = Array.isArray(persistedState.animations)
    ? (persistedState.animations as AppState["animations"])
    : [];
  const persistedAnimationById = new Map(
    persistedAnimations
      .filter((item): item is AppState["animations"][number] => Boolean(item?.id))
      .map((item) => [item.id, item])
  );
  const animations = [
    ...currentState.animations.map((item) => ({
      ...item,
      ...(persistedAnimationById.get(item.id) ?? {})
    })),
    ...persistedAnimations.filter(
      (item) => item?.id && !currentState.animations.some((currentItem) => currentItem.id === item.id)
    )
  ];
  const animationIds = new Set(animations.map((item) => item.id));
  const queuedAnimations = Array.isArray(persistedState.queuedAnimations)
    ? persistedState.queuedAnimations.filter(
        (item): item is string => typeof item === "string" && animationIds.has(item)
      )
    : currentState.queuedAnimations.filter((item) => animationIds.has(item));

  const mergedState: AppState = {
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
    supportReports: Array.isArray(persistedState.supportReports)
      ? persistedState.supportReports
      : currentState.supportReports,
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
    queuedAnimations,
    animations,
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

  const normalizedState: AppState = {
    ...mergedState,
    robot: {
      ...mergedState.robot,
      currentActivity: normalizeLegacyCopy(mergedState.robot.currentActivity) ?? mergedState.robot.currentActivity
    },
    integration: {
      ...mergedState.integration,
      note: normalizeLegacyCopy(mergedState.integration.note),
      bridgeLabel: normalizeLegacyCopy(mergedState.integration.bridgeLabel) ?? mergedState.integration.bridgeLabel
    },
    logs: mergedState.logs.map((item) => ({
      ...item,
      resultMessage: normalizeLegacyCopy(item.resultMessage) ?? item.resultMessage
    })),
    notifications: mergedState.notifications.map((item) => ({
      ...item,
      title: normalizeLegacyCopy(item.title) ?? item.title,
      description: normalizeLegacyCopy(item.description) ?? item.description
    })),
    diagnosticReports: mergedState.diagnosticReports.map((report) => ({
      ...report,
      summary: normalizeLegacyCopy(report.summary) ?? report.summary,
      troubleshooting: report.troubleshooting.map((entry) => normalizeLegacyCopy(entry) ?? entry)
    })),
    supportReports: mergedState.supportReports.map((report) => ({
      ...report,
      summary: normalizeLegacyCopy(report.summary) ?? report.summary,
      details: normalizeLegacyCopy(report.details) ?? report.details,
      integrationNote: normalizeLegacyCopy(report.integrationNote)
    }))
  };

  return sanitizeSnapshotState(normalizedState);
};

const sanitizeSnapshotState = <T extends Pick<AppState, "robot" | "integration" | "settings" | "savedProfiles" | "availableRobots">>(
  state: T
): T => {
  const allowPlaceholder = state.settings.mockMode;
  const shouldResetMockConnection =
    !allowPlaceholder &&
    (
      state.integration.mockMode ||
      state.integration.source === "mock" ||
      state.robot.connectionSource === "mock"
    );

  const settings = sanitizeSettingsForMode(state.settings);
  const savedProfiles = sanitizeSavedProfilesForMode(state.savedProfiles, allowPlaceholder);
  const availableRobots = sanitizeAvailableRobotsForMode(state.availableRobots, allowPlaceholder);
  const integration = sanitizeIntegrationForMode(
    {
      ...state.integration,
      source: allowPlaceholder ? "mock" : shouldResetMockConnection ? "wirepod" : state.integration.source,
      mockMode: state.settings.mockMode,
      robotReachable: shouldResetMockConnection ? false : state.integration.robotReachable
    },
    allowPlaceholder
  );
  const robot = sanitizeRobotForMode(
    allowPlaceholder
      ? state.robot
      : shouldResetMockConnection
        ? {
          ...state.robot,
          connectionSource: "wirepod",
          isConnected: false,
          connectionState: "error",
          systemStatus:
            state.robot.isCharging
              ? "charging"
              : state.robot.isDocked
                ? "docked"
                : "offline",
          currentActivity: "Waiting for connection."
        }
        : state.robot,
    allowPlaceholder
  );

  return {
    ...state,
    robot,
    integration,
    settings,
    savedProfiles,
    availableRobots
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

export const partializeState = (state: AppState): PersistedSlice => {
  const sanitizedState = sanitizeSnapshotState(state);

  return {
    robot: sanitizedState.robot,
    integration: sanitizedState.integration,
    savedProfiles: sanitizedState.savedProfiles,
    routines: state.routines,
    logs: state.logs,
    notifications: state.notifications,
    diagnosticReports: state.diagnosticReports,
    supportReports: state.supportReports,
    roamSessions: state.roamSessions,
    automationControl: state.automationControl,
    queuedAnimations: state.queuedAnimations,
    driveState: state.driveState,
    settings: sanitizedState.settings,
    aiCommandHistory: state.aiCommandHistory,
    animations: state.animations,
    savedPhrases: state.savedPhrases,
    snapshots: state.snapshots,
    visionEvents: state.visionEvents,
    availableRobots: sanitizedState.availableRobots
  };
};

export const exportSnapshot = (state: AppSnapshot) =>
  JSON.stringify(
    {
      robot: sanitizeRobotForMode(state.robot, state.settings.mockMode),
      savedProfiles: sanitizeSavedProfilesForMode(state.savedProfiles, state.settings.mockMode),
      routines: state.routines,
      logs: state.logs,
      notifications: state.notifications,
      diagnosticReports: state.diagnosticReports,
      supportReports: state.supportReports,
      roamSessions: state.roamSessions,
      automationControl: state.automationControl,
      snapshots: state.snapshots,
      visionEvents: state.visionEvents,
      queuedAnimations: state.queuedAnimations,
      settings: sanitizeSettingsForMode(state.settings)
    },
    null,
    2
  );
