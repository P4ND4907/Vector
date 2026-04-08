import type {
  AppSettings,
  IntegrationStatus,
  PairingCandidate,
  Robot,
  RobotProfile,
  WirePodSetupStatus
} from "@/types";

export type StartupStage =
  | "connected"
  | "mock"
  | "mobile-backend-needed"
  | "wirepod-setup"
  | "wirepod-missing"
  | "needs-target"
  | "robot-offline";

export interface StartupChecklistItem {
  id: string;
  title: string;
  detail: string;
  done: boolean;
}

export interface StartupGuide {
  stage: StartupStage;
  headline: string;
  description: string;
  nextTitle: string;
  nextDetail: string;
  modeLabel: string;
  modeDetail: string;
  dependencyLabel: string;
  dependencyDetail: string;
  checklist: StartupChecklistItem[];
  firstRunSteps: string[];
  showDemoOption: boolean;
  showQuickRepair: boolean;
}

const hasSavedTarget = (settings: AppSettings, integration: IntegrationStatus, savedProfile?: RobotProfile) =>
  Boolean(savedProfile || settings.robotSerial || integration.selectedSerial);

export const shouldPreferGuidedNewRobotSetup = ({
  robot,
  integration,
  settings,
  savedProfile,
  mobileRuntimeNeedsBackend = false
}: {
  robot: Robot;
  integration: IntegrationStatus;
  settings: AppSettings;
  savedProfile?: RobotProfile;
  mobileRuntimeNeedsBackend?: boolean;
}) => {
  const isConnected = robot.isConnected && integration.robotReachable;
  const hasTarget = hasSavedTarget(settings, integration, savedProfile);

  if (settings.mockMode || integration.mockMode || isConnected) {
    return false;
  }

  if (mobileRuntimeNeedsBackend) {
    return true;
  }

  return !hasTarget;
};

export const shouldOpenDashboardOnStartup = ({
  robot,
  integration,
  settings
}: {
  robot: Robot;
  integration: IntegrationStatus;
  settings: AppSettings;
}) => {
  if (settings.mockMode || integration.mockMode) {
    return false;
  }

  return Boolean(robot.isConnected && integration.robotReachable);
};

export const buildStartupGuide = ({
  robot,
  integration,
  settings,
  savedProfile,
  availableRobots,
  wirePodSetup,
  mobileRuntimeNeedsBackend = false
}: {
  robot: Robot;
  integration: IntegrationStatus;
  settings: AppSettings;
  savedProfile?: RobotProfile;
  availableRobots: PairingCandidate[];
  wirePodSetup?: WirePodSetupStatus | null;
  mobileRuntimeNeedsBackend?: boolean;
}): StartupGuide => {
  const isConnected = robot.isConnected && integration.robotReachable;
  const hasTarget = hasSavedTarget(settings, integration, savedProfile);
  const hasScannedCandidates = availableRobots.length > 0;
  const localSetupComplete = wirePodSetup?.initialSetupComplete ?? true;
  const needsRobotPairing = Boolean(
    wirePodSetup?.needsRobotPairing ||
      (!hasTarget &&
        wirePodSetup?.initialSetupComplete &&
        wirePodSetup.discoveredRobotCount === 0 &&
        !hasScannedCandidates)
  );
  const bridgeRoutesUnresponsive =
    integration.wirePodReachable &&
    !integration.robotReachable &&
    Boolean(integration.note?.toLowerCase().includes("routes are not responding"));

  const checklist: StartupChecklistItem[] = [
    {
      id: "wirepod",
      title: "Local bridge available",
      detail: integration.wirePodReachable
        ? `${integration.bridgeLabel || "The local bridge"} answered at ${integration.wirePodBaseUrl}.`
        : "The local bridge is not reachable yet on this computer.",
      done: integration.wirePodReachable
    },
    {
      id: "target",
      title: "Robot target saved",
      detail: hasTarget
        ? `The app knows which Vector to reconnect to: ${integration.selectedSerial || settings.robotSerial || savedProfile?.serial || "saved target"}.`
        : "No robot serial is saved yet, so the app does not know which Vector to reconnect to.",
      done: hasTarget
    },
    {
      id: "link",
      title: "Robot link live",
      detail: isConnected
        ? `${robot.nickname ?? robot.name} is online and ready for commands.`
        : "The app is still waiting for a live response from the robot.",
      done: isConnected
    }
  ];

  const firstRunSteps = [
    localSetupComplete
      ? "Local bridge setup is already complete on this computer."
      : "Use Finish local setup automatically to apply the default language and Escape Pod mode here.",
    needsRobotPairing
      ? "Open the robot pairing portal once so Vector can complete the Bluetooth and Wi-Fi handshake."
      : bridgeRoutesUnresponsive
        ? "The local bridge already knows a robot, but its SDK routes timed out. Retry connection or restart WirePod instead of pairing again."
      : "Once Vector is authenticated, scan or save the serial here.",
    "Return here, scan or save the serial, then press Connect.",
    "Once Vector answers here, the rest of the dashboard is ready."
  ];

  if (mobileRuntimeNeedsBackend) {
    return {
      stage: "mobile-backend-needed",
      headline: "Point the mobile app at your desktop backend.",
      description:
        settings.mockMode || integration.mockMode
          ? "The phone app is in demo mode right now. Save the desktop or LAN backend URL first so you can leave mock mode without breaking commands."
          : "This phone shell is ready, but it still needs the desktop or LAN backend URL before it can reach the local bridge or your robot.",
      nextTitle: "Open Settings and save the backend URL first.",
      nextDetail:
        settings.mockMode || integration.mockMode
          ? "Use a LAN address like http://192.168.x.x:8787 while your phone and desktop are on the same Wi-Fi. After that, you can turn off mock mode and reconnect for real."
          : "Use a LAN address like http://192.168.x.x:8787 while your phone and desktop are on the same Wi-Fi. After that, this screen can reconnect normally.",
      modeLabel: settings.mockMode || integration.mockMode ? "Mobile demo mode" : "Mobile shell mode",
      modeDetail:
        "The phone UI is running locally on your device. The Node backend and local bridge still live on your desktop or another LAN machine for now.",
      dependencyLabel: "Missing step: mobile backend URL",
      dependencyDetail:
        "Without a saved backend target, the mobile shell only knows its own WebView and cannot reach the desktop service that talks to Vector.",
      checklist,
      firstRunSteps: [
        "On your desktop, keep Vector Control Hub or the backend running on the same Wi-Fi network as your phone.",
        "Open Settings here and save a backend URL like http://192.168.x.x:8787.",
        "Return to this screen and press Connect once the backend target is saved.",
        "If you only want a quick tour first, switch into demo mode."
      ],
      showDemoOption: true,
      showQuickRepair: false
    };
  }

  if (settings.mockMode || integration.mockMode) {
    return {
      stage: "mock",
      headline: "You are in mock mode.",
      description:
        "The app is running in a safe demo state so you can explore the dashboard without a live robot.",
      nextTitle: "Turn mock mode off when you want the real robot.",
      nextDetail:
        "Mock mode keeps the interface testable, but commands and voice actions will not go to Vector.",
      modeLabel: "Mock mode",
      modeDetail:
        "Use this when the local bridge or Vector is not ready yet and you still want to learn the layout.",
      dependencyLabel: "Real robot path paused",
      dependencyDetail:
        "Turn off mock mode first, then reconnect through the local bridge.",
      checklist,
      firstRunSteps,
      showDemoOption: false,
      showQuickRepair: false
    };
  }

  if (isConnected) {
    return {
      stage: "connected",
      headline: `Connected to ${robot.nickname ?? robot.name}.`,
      description:
        "The local bridge is healthy and Vector is answering. You can head straight into the dashboard now.",
      nextTitle: "Open the dashboard or jump straight into controls.",
      nextDetail:
        "This startup screen has done its job. You only need to come back here if the local link drops.",
      modeLabel: "Real robot mode",
      modeDetail:
        "Commands go through the app backend, then the local bridge, then to Vector. You do not need to keep the provider UI open.",
      dependencyLabel: "Everything needed is online",
      dependencyDetail: "The local bridge is reachable, the robot target is saved, and Vector is responding live.",
      checklist,
      firstRunSteps,
      showDemoOption: false,
      showQuickRepair: false
    };
  }

  if (!integration.wirePodReachable) {
    return {
      stage: "wirepod-missing",
      headline: "Start the local bridge first.",
      description:
        "The app cannot reach the local bridge yet, so there is nothing safe to send to the robot.",
      nextTitle: "Bring the local bridge online, then try Connect again.",
      nextDetail:
        "Quick repair can try the local start path first. If this is your first setup, follow the beginner steps on the right.",
      modeLabel: "Real robot mode",
      modeDetail:
        "This mode talks to your actual robot. If the local bridge is missing, the app will say so instead of pretending commands worked.",
      dependencyLabel: "Missing dependency: local bridge",
      dependencyDetail:
        "A reachable local bridge is required for real robot control. The app can still switch into mock mode if you just want a demo.",
      checklist,
      firstRunSteps,
      showDemoOption: true,
      showQuickRepair: true
    };
  }

  if (!localSetupComplete) {
    return {
      stage: "wirepod-setup",
      headline: "Finish the one-time local setup first.",
      description:
        "The local bridge is running, but its first-run setup is not fully applied yet. The app can take care of the default setup for you here.",
      nextTitle: "Finish local setup, then pair the robot once if needed.",
      nextDetail:
        "This app can apply the default local bridge settings automatically. The robot-side Bluetooth and Wi-Fi handshake still has to happen once.",
      modeLabel: "Real robot mode",
      modeDetail:
        "The app can hide most of the compatibility-bridge steps, but the robot still needs one real pairing handshake the first time.",
      dependencyLabel: "One-time local setup still needed",
      dependencyDetail:
        "Finish the local bridge setup defaults first, then move on to the saved-target and live-link steps.",
      checklist,
      firstRunSteps,
      showDemoOption: true,
      showQuickRepair: false
    };
  }

  if (!hasTarget) {
    return {
      stage: "needs-target",
      headline: "Choose which Vector to reconnect to.",
      description:
        "The local bridge is online, but the app still needs a saved robot target before it can reconnect cleanly.",
      nextTitle: hasScannedCandidates ? "Pick a found robot or open pairing." : "Scan the network, then save a robot target.",
      nextDetail:
        "Once a serial is saved, the startup screen can reconnect to the same robot automatically on the next launch.",
      modeLabel: "Real robot mode",
      modeDetail:
        "This app keeps the reconnect target locally so normal users do not have to think about serials every time.",
      dependencyLabel: "Missing step: saved target",
      dependencyDetail:
        needsRobotPairing
          ? "Vector still needs its one-time pairing handshake before a serial can be saved here."
          : "Save a serial or pair a robot once, and the app will reuse that target on future launches.",
      checklist,
      firstRunSteps,
      showDemoOption: true,
      showQuickRepair: false
    };
  }

  return {
    stage: "robot-offline",
    headline: "The bridge is up, but Vector is not answering yet.",
    description:
      "The local bridge is reachable and the target is saved, but the robot link itself still needs a little help.",
    nextTitle: "Try a reconnect or quick repair next.",
    nextDetail:
      bridgeRoutesUnresponsive
        ? "The local bridge answered, but the robot SDK routes timed out. Retry once, then restart WirePod or the desktop backend if quick repair stays partial."
        : "This usually means Vector is off Wi-Fi, sleepy, on the wrong network, or the saved target needs a fresh scan.",
    modeLabel: "Real robot mode",
    modeDetail:
      "The app is already talking to the local bridge. What is missing now is the final robot response.",
    dependencyLabel: "Live robot response missing",
    dependencyDetail:
      bridgeRoutesUnresponsive
        ? "Reconnect first. If that still fails, restart WirePod or the desktop backend, then try quick repair again."
        : "Reconnect first. If that still fails, use quick repair and then scan again if needed.",
    checklist,
    firstRunSteps,
    showDemoOption: true,
    showQuickRepair: true
  };
};
