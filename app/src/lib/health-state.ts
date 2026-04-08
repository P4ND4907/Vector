import type { BridgeWatchdogStatus, IntegrationStatus, Robot } from "@/types";

export type AppHealthStateId =
  | "ready"
  | "bridge-down"
  | "sdk-flapping"
  | "robot-asleep"
  | "mock-mode";

export type AppHealthTone = "healthy" | "info" | "attention" | "critical";

export interface AppHealthState {
  id: AppHealthStateId;
  label: string;
  badgeLabel: string;
  tone: AppHealthTone;
  summary: string;
  detail: string;
}

export const healthToneClassName: Record<AppHealthTone, string> = {
  healthy: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  info: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  attention: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  critical: "border-red-400/20 bg-red-400/10 text-red-100"
};

const isSdkFlapping = (watchdog?: BridgeWatchdogStatus) =>
  Boolean(
    watchdog &&
      (watchdog.issueCode === "sdk-session-timeout" || watchdog.issueCode === "reconnect-loop")
  );

export const deriveAppHealthState = ({
  robot,
  integration,
  watchdog
}: {
  robot: Robot;
  integration: IntegrationStatus;
  watchdog?: BridgeWatchdogStatus;
}): AppHealthState => {
  if (integration.mockMode) {
    return {
      id: "mock-mode",
      label: "Mock mode",
      badgeLabel: "mock mode",
      tone: "info",
      summary: "The app is in mock mode, so live robot health is paused.",
      detail: "Turn mock mode off when you want real bridge, repair, and robot health checks."
    };
  }

  if (!integration.wirePodReachable || watchdog?.issueCode === "bridge-offline") {
    return {
      id: "bridge-down",
      label: "Bridge down",
      badgeLabel: "bridge down",
      tone: "critical",
      summary: "The local bridge is offline, so live robot commands cannot settle yet.",
      detail: watchdog?.recommendedAction || integration.note || "Start or recover the local bridge first."
    };
  }

  if (isSdkFlapping(watchdog)) {
    return {
      id: "sdk-flapping",
      label: "SDK flapping",
      badgeLabel: "sdk flapping",
      tone: "critical",
      summary: "The bridge is online, but Vector's SDK session keeps dropping before it stabilizes.",
      detail:
        watchdog?.recommendedAction ||
        integration.note ||
        "Run bridge recovery to refresh the session and reconnect the saved robot."
    };
  }

  if (!integration.robotReachable || !robot.isConnected) {
    const robotLooksSleepy = robot.isDocked || robot.isCharging || robot.systemStatus === "charging";
    return {
      id: "robot-asleep",
      label: robotLooksSleepy ? "Robot asleep" : "Robot quiet",
      badgeLabel: robotLooksSleepy ? "robot asleep" : "robot quiet",
      tone: "attention",
      summary: robotLooksSleepy
        ? "The bridge is awake, but Vector still needs a wake-up and reconnect pass."
        : "The bridge answered, but Vector is still quiet on the live robot routes.",
      detail:
        integration.note ||
        (robotLooksSleepy
          ? "Wake Vector on the charger, then reconnect."
          : "Retry connection, then use recovery if the robot still stays quiet.")
    };
  }

  return {
    id: "ready",
    label: "Ready",
    badgeLabel: "ready",
    tone: "healthy",
    summary: "Bridge, robot link, and live routes look stable right now.",
    detail: "Controls, speech, routines, and AI commands should all be ready to use."
  };
};
