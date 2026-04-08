import type {
  BridgeWatchdogStatusRecord,
  ManagedBridgeStatusRecord,
  RobotIntegrationInfo
} from "../robot/types.js";

const connTimerPattern = /Closing SDK connection.*source:\s*connTimer/i;
const reconnectPattern = /Connecting to\s+/i;
const stablePattern = /Connected to\s+/i;

const toLines = (raw: string) =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const takeRecent = (lines: string[], count: number) => lines.slice(Math.max(0, lines.length - count));

export const buildBridgeWatchdogStatus = ({
  integration,
  managedBridge,
  debugLogs,
  selectedSerial,
  autoRecoveryAvailable
}: {
  integration: RobotIntegrationInfo;
  managedBridge: ManagedBridgeStatusRecord;
  debugLogs: string;
  selectedSerial?: string;
  autoRecoveryAvailable: boolean;
}): BridgeWatchdogStatusRecord => {
  const observedAt = new Date().toISOString();

  if (integration.mockMode) {
    return {
      observedAt,
      overallStatus: "healthy",
      issueCode: "mock-mode",
      summary: "Mock mode is active, so the live bridge watchdog is paused.",
      recommendedAction: "Turn mock mode off when you are ready to watch the real bridge and robot routes.",
      bridgeReachable: false,
      robotReachable: true,
      autoRecoveryAvailable: false,
      autoRecoveryLikelyHelpful: false,
      connTimerEvents: 0,
      reconnectEvents: 0,
      recentEvidence: ["Mock mode is active."]
    };
  }

  const lines = toLines(debugLogs);
  const scopedLines = selectedSerial
    ? lines.filter((line) => line.includes(selectedSerial) || connTimerPattern.test(line) || reconnectPattern.test(line))
    : lines;
  const connTimerEvents = scopedLines.filter((line) => connTimerPattern.test(line));
  const reconnectEvents = scopedLines.filter((line) => reconnectPattern.test(line));
  const stableEvents = scopedLines.filter((line) => stablePattern.test(line));
  const note = integration.note?.trim() || "";
  const noteMentionsRouteTimeout = /routes are not responding|sdk routes are timing out|timing out/i.test(note);
  const repeatedReconnects = reconnectEvents.length >= 3;
  const repeatedConnTimer = connTimerEvents.length >= 2;

  if (!integration.wirePodReachable) {
    return {
      observedAt,
      overallStatus: "critical",
      issueCode: "bridge-offline",
      summary: "The local bridge is offline, so Vector cannot answer live commands right now.",
      recommendedAction: managedBridge.available
        ? "Run bridge recovery to start the bundled bridge, then retry the saved robot."
        : "Run bridge recovery, then restart WirePod on this computer if the bridge still stays offline.",
      bridgeReachable: false,
      robotReachable: false,
      autoRecoveryAvailable,
      autoRecoveryLikelyHelpful: autoRecoveryAvailable,
      connTimerEvents: connTimerEvents.length,
      reconnectEvents: reconnectEvents.length,
      recentEvidence: takeRecent(connTimerEvents.length ? connTimerEvents : reconnectEvents.length ? reconnectEvents : [note || "No successful bridge probe was recorded."], 3)
    };
  }

  if (!integration.robotReachable && (repeatedConnTimer || noteMentionsRouteTimeout)) {
    return {
      observedAt,
      overallStatus: "critical",
      issueCode: "sdk-session-timeout",
      summary: "The local bridge is online, but Vector's SDK session keeps timing out before commands settle.",
      recommendedAction: autoRecoveryAvailable
        ? "Run bridge recovery to refresh the SDK session and reconnect the saved robot."
        : "Run bridge recovery, then restart WirePod if the SDK session keeps dropping with connTimer.",
      bridgeReachable: true,
      robotReachable: false,
      autoRecoveryAvailable,
      autoRecoveryLikelyHelpful: true,
      connTimerEvents: connTimerEvents.length,
      reconnectEvents: reconnectEvents.length,
      recentEvidence: takeRecent(
        connTimerEvents.length ? connTimerEvents : [note || "The robot routes are timing out."],
        4
      )
    };
  }

  if (!integration.robotReachable && repeatedReconnects) {
    return {
      observedAt,
      overallStatus: "attention",
      issueCode: "reconnect-loop",
      summary: "The bridge keeps reconnecting the robot, but the live routes are not staying stable yet.",
      recommendedAction: "Run bridge recovery, then give Vector a few seconds on the charger before retrying.",
      bridgeReachable: true,
      robotReachable: false,
      autoRecoveryAvailable,
      autoRecoveryLikelyHelpful: true,
      connTimerEvents: connTimerEvents.length,
      reconnectEvents: reconnectEvents.length,
      recentEvidence: takeRecent(reconnectEvents, 4)
    };
  }

  if (!integration.robotReachable) {
    return {
      observedAt,
      overallStatus: "attention",
      issueCode: "robot-routes-quiet",
      summary: "The bridge is online, but Vector is still quiet on the robot routes.",
      recommendedAction: "Retry connection first, then run bridge recovery if the robot still does not answer.",
      bridgeReachable: true,
      robotReachable: false,
      autoRecoveryAvailable,
      autoRecoveryLikelyHelpful: autoRecoveryAvailable,
      connTimerEvents: connTimerEvents.length,
      reconnectEvents: reconnectEvents.length,
      recentEvidence: takeRecent(
        reconnectEvents.length ? reconnectEvents : stableEvents.length ? stableEvents : [note || "The bridge is waiting for the robot routes."],
        3
      )
    };
  }

  return {
    observedAt,
    overallStatus: "healthy",
    issueCode: "stable",
    summary: "The bridge and robot routes look stable right now.",
    recommendedAction: "No bridge recovery needed. Keep using the app normally.",
    bridgeReachable: true,
    robotReachable: true,
    autoRecoveryAvailable,
    autoRecoveryLikelyHelpful: false,
    connTimerEvents: connTimerEvents.length,
    reconnectEvents: reconnectEvents.length,
    recentEvidence: takeRecent(
      stableEvents.length ? stableEvents : [note || "Recent bridge probes are healthy."],
      3
    )
  };
};
