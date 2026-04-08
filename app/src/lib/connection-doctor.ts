import type {
  AppSettings,
  IntegrationStatus,
  PairingCandidate,
  Robot,
  RobotProfile,
  WirePodSetupStatus
} from "@/types";

export type ConnectionDoctorStage =
  | "healthy"
  | "mock-mode"
  | "mobile-backend-needed"
  | "bridge-offline"
  | "setup-needed"
  | "pairing-needed"
  | "target-missing"
  | "robot-offline";

export type ConnectionDoctorTone = "healthy" | "info" | "attention" | "critical";

export type ConnectionDoctorActionId =
  | "open-dashboard"
  | "open-settings"
  | "retry-connection"
  | "run-quick-repair"
  | "run-diagnostics"
  | "open-pairing"
  | "open-new-robot"
  | "disable-mock"
  | "scan-network"
  | "finish-local-setup";

export interface ConnectionDoctorAction {
  id: ConnectionDoctorActionId;
  label: string;
  variant?: "default" | "outline" | "ghost";
}

export interface ConnectionDoctorGuide {
  stage: ConnectionDoctorStage;
  tone: ConnectionDoctorTone;
  eyebrow: string;
  title: string;
  summary: string;
  detail: string;
  statusLine: string;
  steps: string[];
  actions: ConnectionDoctorAction[];
}

const hasSavedTarget = (settings: AppSettings, integration: IntegrationStatus, savedProfile?: RobotProfile) =>
  Boolean(savedProfile || settings.robotSerial || integration.selectedSerial);

export const buildConnectionDoctor = ({
  robot,
  integration,
  settings,
  savedProfile,
  availableRobots = [],
  wirePodSetup,
  mobileRuntimeNeedsBackend = false
}: {
  robot: Robot;
  integration: IntegrationStatus;
  settings: AppSettings;
  savedProfile?: RobotProfile;
  availableRobots?: PairingCandidate[];
  wirePodSetup?: WirePodSetupStatus | null;
  mobileRuntimeNeedsBackend?: boolean;
}): ConnectionDoctorGuide => {
  const isConnected = robot.isConnected && integration.robotReachable;
  const targetSaved = hasSavedTarget(settings, integration, savedProfile);
  const foundRobots = availableRobots.length;
  const pairingNeeded = Boolean(
    wirePodSetup?.needsRobotPairing ||
      (!targetSaved &&
        wirePodSetup?.initialSetupComplete &&
        wirePodSetup.discoveredRobotCount === 0 &&
        foundRobots === 0)
  );
  const setupNeeded = wirePodSetup ? !wirePodSetup.initialSetupComplete : false;
  const selectedSerial = integration.selectedSerial || settings.robotSerial || savedProfile?.serial || "none saved";
  const bridgeRoutesUnresponsive =
    integration.wirePodReachable &&
    !integration.robotReachable &&
    Boolean(integration.note?.toLowerCase().includes("routes are not responding"));

  if (mobileRuntimeNeedsBackend) {
    return {
      stage: "mobile-backend-needed",
      tone: "info",
      eyebrow: "Connection doctor",
      title: "This phone still needs your desktop backend URL.",
      summary:
        "The app shell is open, but it cannot reach the desktop service that talks to the local robot bridge yet.",
      detail:
        settings.mockMode || integration.mockMode
          ? "Save the LAN backend URL first, then turn off mock mode when you want real robot control."
          : "Save a LAN address like http://192.168.x.x:8787 in Settings, then come back and reconnect.",
      statusLine: `Saved target: ${selectedSerial}. Backend URL is still missing on this phone.`,
      steps: [
        "Keep your phone and desktop on the same Wi-Fi network.",
        "Open Settings and save the desktop backend URL.",
        "Return here and retry the connection once the backend target is saved."
      ],
      actions: [
        { id: "open-settings", label: "Set backend URL" },
        { id: "open-new-robot", label: "Guided setup", variant: "outline" }
      ]
    };
  }

  if (settings.mockMode || integration.mockMode) {
    return {
      stage: "mock-mode",
      tone: "attention",
      eyebrow: "Connection doctor",
      title: "Mock mode is active.",
      summary: "The app is healthy, but it is intentionally not talking to your real robot right now.",
      detail: "Turn mock mode off when you want real commands, scans, and diagnostics to hit Vector.",
      statusLine: "Demo mode is safe for exploring the app, but it blocks the real robot path.",
      steps: [
        "Turn off mock mode.",
        "Retry the connection to the saved robot.",
        "If the real robot still does not answer, run quick repair next."
      ],
      actions: [
        { id: "disable-mock", label: "Turn off mock mode" },
        { id: "retry-connection", label: "Retry connection", variant: "outline" }
      ]
    };
  }

  if (isConnected) {
    return {
      stage: "healthy",
      tone: "healthy",
      eyebrow: "Connection doctor",
      title: `${robot.nickname ?? robot.name} is connected.`,
      summary: "The local bridge is up, the saved target is known, and the live robot link is responding.",
      detail: "You can stay in the dashboard, use AI commands, or run diagnostics without reconnecting first.",
      statusLine: `Connected through ${integration.bridgeLabel || "the local bridge"} with serial ${selectedSerial}.`,
      steps: [
        "Use the dashboard for everyday control.",
        "Open diagnostics if you want a deeper health snapshot.",
        "Teach missed phrases from the AI page when a command does not match."
      ],
      actions: [
        { id: "open-dashboard", label: "Open dashboard" },
        { id: "run-diagnostics", label: "Run diagnostics", variant: "outline" }
      ]
    };
  }

  if (!integration.wirePodReachable) {
    return {
      stage: "bridge-offline",
      tone: "critical",
      eyebrow: "Connection doctor",
      title: "The local robot bridge is offline.",
      summary:
        "The app cannot reach the saved backend endpoint yet, so no robot commands can run safely.",
      detail:
        integration.note ||
        "This usually means the desktop backend is not running, the saved endpoint changed, or the phone cannot reach the desktop on the network.",
      statusLine: `Saved endpoint: ${integration.wirePodBaseUrl}. Selected serial: ${selectedSerial}.`,
      steps: [
        "Make sure the desktop backend is still running.",
        "Retry the connection once the local bridge is back.",
        "Open Settings if the saved backend URL looks wrong."
      ],
      actions: [
        { id: "retry-connection", label: "Retry connection" },
        { id: "open-settings", label: "Check settings", variant: "outline" },
        { id: "run-quick-repair", label: "Quick repair", variant: "ghost" }
      ]
    };
  }

  if (setupNeeded) {
    return {
      stage: "setup-needed",
      tone: "info",
      eyebrow: "Connection doctor",
      title: "Finish the one-time local setup first.",
      summary:
        "The local bridge is reachable, but its default language or connection mode has not been fully applied yet.",
      detail:
        "The app can finish the default local setup for you, then you can move straight into pairing or reconnect.",
      statusLine: `Local setup is incomplete. Bridge mode: ${wirePodSetup?.connectionMode || "unknown"}.`,
      steps: [
        "Use Finish local setup here in the app.",
        "If Vector is brand new, complete the first pairing handshake next.",
        "Come back and retry the robot connection."
      ],
      actions: [
        { id: "finish-local-setup", label: "Finish local setup" },
        { id: "open-new-robot", label: "Guided setup", variant: "outline" }
      ]
    };
  }

  if (!targetSaved && pairingNeeded) {
    return {
      stage: "pairing-needed",
      tone: "info",
      eyebrow: "Connection doctor",
      title: "Vector still needs the first pairing handshake.",
      summary:
        "The local bridge is online, but the robot has not finished the one-time Bluetooth and Wi-Fi handoff yet.",
      detail:
        "After the first pairing handshake, the app can save the robot target and future reconnects get much easier.",
      statusLine: `No saved target yet. ${foundRobots ? `${foundRobots} robot scan hit${foundRobots === 1 ? "" : "s"} found.` : "No saved robot serial yet."}`,
      steps: [
        "Open the pairing flow for the new robot.",
        "Save the robot target once the handshake finishes.",
        "Return here and reconnect without using pairing mode again."
      ],
      actions: [
        { id: "open-pairing", label: "Open pairing" },
        { id: "open-new-robot", label: "Guided setup", variant: "outline" }
      ]
    };
  }

  if (!targetSaved) {
    return {
      stage: "target-missing",
      tone: "attention",
      eyebrow: "Connection doctor",
      title: "Pick which robot this app should reconnect to.",
      summary:
        "The local bridge is up, but the app still does not have a saved serial or robot target for reconnect.",
      detail:
        foundRobots > 0
          ? `A scan already found ${foundRobots} robot${foundRobots === 1 ? "" : "s"}. Save one target and future launches will be smoother.`
          : "Scan the network or use guided setup once, then the app can remember the target for future launches.",
      statusLine: `Selected serial: ${selectedSerial}. Found on network: ${foundRobots}.`,
      steps: [
        "Scan the network for nearby robots.",
        "Save one robot target or open guided setup.",
        "Retry the connection once a serial is saved."
      ],
      actions: [
        { id: "scan-network", label: foundRobots ? "Scan again" : "Scan network" },
        { id: "open-new-robot", label: "Guided setup", variant: "outline" },
        { id: "open-pairing", label: "Pair or switch robot", variant: "ghost" }
      ]
    };
  }

  return {
    stage: "robot-offline",
    tone: "attention",
    eyebrow: "Connection doctor",
    title: "The backend is up, but the robot link is still offline.",
    summary:
      "The app can reach the local bridge and it knows which robot to target, but Vector itself is not answering yet.",
    detail:
      bridgeRoutesUnresponsive
        ? "The local bridge answered, but its robot SDK routes timed out. This usually means WirePod needs a restart or the robot session dropped and needs a fresh reconnect."
        : integration.note ||
          "This usually means Vector is asleep, off Wi-Fi, on the charger but not fully awake, or the saved target needs a refresh.",
    statusLine: bridgeRoutesUnresponsive
      ? `Saved serial: ${selectedSerial}. Local bridge reachable: yes. Robot SDK routes are not responding.`
      : `Saved serial: ${selectedSerial}. Local bridge reachable: yes. Robot reachable: no.`,
    steps: [
      "Retry the connection first.",
      "If that fails, run quick repair and then diagnostics.",
      bridgeRoutesUnresponsive
        ? "If repair stays partial, restart WirePod or the desktop backend before trying pairing again."
        : "If the robot target looks stale, scan again or open pairing."
    ],
    actions: [
      { id: "retry-connection", label: "Retry connection" },
      { id: "run-quick-repair", label: "Quick repair", variant: "outline" },
      { id: "run-diagnostics", label: "Diagnostics", variant: "ghost" }
    ]
  };
};
