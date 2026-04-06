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

export const buildStartupGuide = ({
  robot,
  integration,
  settings,
  savedProfile,
  availableRobots,
  wirePodSetup
}: {
  robot: Robot;
  integration: IntegrationStatus;
  settings: AppSettings;
  savedProfile?: RobotProfile;
  availableRobots: PairingCandidate[];
  wirePodSetup?: WirePodSetupStatus | null;
}): StartupGuide => {
  const isConnected = robot.isConnected && integration.robotReachable;
  const hasTarget = hasSavedTarget(settings, integration, savedProfile);
  const hasScannedCandidates = availableRobots.length > 0;
  const localSetupComplete = wirePodSetup?.initialSetupComplete ?? true;
  const needsRobotPairing = wirePodSetup?.needsRobotPairing ?? false;

  const checklist: StartupChecklistItem[] = [
    {
      id: "wirepod",
      title: "Local brain available",
      detail: integration.wirePodReachable
        ? `WirePod answered at ${integration.wirePodBaseUrl}.`
        : "WirePod is not reachable yet on this computer.",
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
      ? "Local WirePod setup is already complete on this computer."
      : "Use Finish local setup automatically to apply the default language and Escape Pod mode here.",
    needsRobotPairing
      ? "Open the robot pairing portal once so Vector can complete the Bluetooth and Wi-Fi handshake."
      : "Once Vector is authenticated, scan or save the serial here.",
    "Return here, scan or save the serial, then press Connect.",
    "Once Vector answers here, the rest of the dashboard is ready."
  ];

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
        "Use this when WirePod or Vector is not ready yet and you still want to learn the layout.",
      dependencyLabel: "Real robot path paused",
      dependencyDetail:
        "Turn off mock mode first, then reconnect through the local WirePod bridge.",
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
        "Commands go through the app backend, then local WirePod, then to Vector. You do not need to keep the WirePod UI open.",
      dependencyLabel: "Everything needed is online",
      dependencyDetail: "WirePod is reachable, the robot target is saved, and Vector is responding live.",
      checklist,
      firstRunSteps,
      showDemoOption: false,
      showQuickRepair: false
    };
  }

  if (!integration.wirePodReachable) {
    return {
      stage: "wirepod-missing",
      headline: "Start the local Vector brain first.",
      description:
        "The app cannot reach WirePod yet, so there is nothing safe to send to the robot.",
      nextTitle: "Bring WirePod online, then try Connect again.",
      nextDetail:
        "Quick repair can try the local start path first. If this is your first setup, follow the beginner steps on the right.",
      modeLabel: "Real robot mode",
      modeDetail:
        "This mode talks to your actual robot. If the local bridge is missing, the app will say so instead of pretending commands worked.",
      dependencyLabel: "Missing dependency: WirePod",
      dependencyDetail:
        "WirePod is required for real robot control. The app can still switch into mock mode if you just want a demo.",
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
        "WirePod is running, but its first-run setup is not fully applied yet. The app can take care of the default setup for you here.",
      nextTitle: "Finish local setup, then pair the robot once if needed.",
      nextDetail:
        "This app can apply the default WirePod settings automatically. The robot-side Bluetooth and Wi-Fi handshake still has to happen once.",
      modeLabel: "Real robot mode",
      modeDetail:
        "The app can hide most of the WirePod steps, but the robot still needs one real pairing handshake the first time.",
      dependencyLabel: "One-time local setup still needed",
      dependencyDetail:
        "Finish the WirePod setup defaults first, then move on to the saved-target and live-link steps.",
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
        "WirePod is online, but the app still needs a saved robot target before it can reconnect cleanly.",
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
      "WirePod is reachable and the target is saved, but the robot link itself still needs a little help.",
    nextTitle: "Try a reconnect or quick repair next.",
    nextDetail:
      "This usually means Vector is off Wi-Fi, sleepy, on the wrong network, or the saved target needs a fresh scan.",
    modeLabel: "Real robot mode",
    modeDetail:
      "The app is already talking to the local bridge. What is missing now is the final robot response.",
    dependencyLabel: "Live robot response missing",
    dependencyDetail:
      "Reconnect first. If that still fails, use quick repair and then scan again if needed.",
    checklist,
    firstRunSteps,
    showDemoOption: true,
    showQuickRepair: true
  };
};
