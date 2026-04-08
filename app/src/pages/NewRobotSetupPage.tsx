import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bluetooth,
  Bot,
  CheckCircle2,
  ExternalLink,
  Globe,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Wifi
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import {
  getResolvedWirePodUrl,
  getStoredAppBackendUrl,
  isMobileShellLikeRuntime,
  mobileRuntimeNeedsManualBackendUrl
} from "@/lib/runtime-target";
import { bluetoothDiscoveryService } from "@/services/bluetoothDiscovery";
import { mobileBackendDiscoveryService } from "@/services/mobileBackendDiscovery";
import { robotService } from "@/services/robotService";
import { useAppStore } from "@/store/useAppStore";
import type {
  ActionStatus,
  BluetoothDiscoveryCandidate,
  BluetoothDiscoveryStatus,
  MobileBackendTarget,
  PairingCandidate,
  WirePodSetupStatus
} from "@/types";

type SetupStepTone = "done" | "active" | "blocked";

const stepToneClasses: Record<SetupStepTone, string> = {
  done: "border-emerald-400/20 bg-emerald-400/8",
  active: "border-sky-400/20 bg-sky-400/8",
  blocked: "border-white/10 bg-white/[0.03]"
};

const stepBadgeClasses: Record<SetupStepTone, string> = {
  done: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
  active: "border-sky-300/30 bg-sky-300/12 text-sky-100",
  blocked: "border-white/10 bg-white/[0.05] text-muted-foreground"
};

const AUTO_SETUP_TIMEOUT_MS = 120_000;
const AUTO_SETUP_POLL_INTERVAL_MS = 4_000;

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const pickPreferredBackendTarget = (targets: MobileBackendTarget[]) =>
  targets.find((target) => target.kind === "lan") ?? targets[0] ?? null;

const mergeBackendTargets = (...groups: MobileBackendTarget[][]) => {
  const merged = new Map<string, MobileBackendTarget>();

  for (const group of groups) {
    for (const target of group) {
      if (!merged.has(target.url)) {
        merged.set(target.url, target);
      }
    }
  }

  return Array.from(merged.values());
};

const describeBluetoothError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : "The Bluetooth scan did not finish cleanly.";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("permission") ||
    normalized.includes("denied") ||
    normalized.includes("nearby") ||
    normalized.includes("authorize")
  ) {
    return "Android needs the Nearby Devices permission before this phone can scan for Vector. Tap Allow on the next prompt, or open app settings if you already denied it.";
  }

  if (normalized.includes("cancel")) {
    return "The Bluetooth request was cancelled. Tap scan again and allow the Android prompt so setup can keep going.";
  }

  return message;
};

const pickAutoConnectCandidate = ({
  candidates,
  preferredSerials,
  avoidedSerials = []
}: {
  candidates: PairingCandidate[];
  preferredSerials: Array<string | undefined>;
  avoidedSerials?: Array<string | undefined>;
}) => {
  const normalizedPreferredSerials = preferredSerials
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const normalizedAvoidedSerials = avoidedSerials
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const serial of normalizedPreferredSerials) {
    const preferredCandidate = candidates.find((candidate) => candidate.serial?.trim() === serial);
    if (preferredCandidate) {
      return preferredCandidate;
    }
  }

  const candidatesWithSerial = candidates.filter((candidate) => Boolean(candidate.serial?.trim()));
  const candidatesWithoutAvoidedSerials = normalizedAvoidedSerials.length
    ? candidatesWithSerial.filter((candidate) => !normalizedAvoidedSerials.includes(candidate.serial?.trim() ?? ""))
    : candidatesWithSerial;

  if (candidatesWithoutAvoidedSerials.length === 1) {
    return candidatesWithoutAvoidedSerials[0];
  }

  if (candidatesWithSerial.length === 1) {
    return candidatesWithSerial[0];
  }

  return null;
};

const getStepTone = ({
  done,
  ready
}: {
  done: boolean;
  ready: boolean;
}): SetupStepTone => {
  if (done) {
    return "done";
  }

  return ready ? "active" : "blocked";
};

function SetupStepCard({
  number,
  title,
  summary,
  statusLabel,
  tone,
  children
}: {
  number: number;
  title: string;
  summary: string;
  statusLabel: string;
  tone: SetupStepTone;
  children: ReactNode;
}) {
  return (
    <Card className={cn("overflow-hidden", stepToneClasses[tone])}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-foreground/85">
              {number}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="mt-1">{summary}</CardDescription>
            </div>
          </div>
          <Badge className={stepBadgeClasses[tone]}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function CandidateCard({
  candidate,
  working,
  onSaveAndConnect,
  onSaveSerial
}: {
  candidate: PairingCandidate;
  working: boolean;
  onSaveAndConnect: () => void;
  onSaveSerial: () => void;
}) {
  return (
    <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{candidate.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Seen {formatRelativeTime(candidate.lastSeen)} on {candidate.ipAddress}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Serial {candidate.serial || "Unknown"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{candidate.signalStrength}% signal</Badge>
          <Badge>{candidate.secure ? "Secure" : "Open"}</Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onSaveAndConnect} disabled={working || !candidate.serial}>
          <ArrowRight className="h-4 w-4" />
          {working ? "Saving..." : "Save and connect"}
        </Button>
        <Button size="sm" variant="outline" onClick={onSaveSerial} disabled={!candidate.serial}>
          Save serial only
        </Button>
      </div>
    </div>
  );
}

function BluetoothCandidateCard({
  candidate,
  working,
  onUseForSetup
}: {
  candidate: BluetoothDiscoveryCandidate;
  working?: boolean;
  onUseForSetup?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{candidate.name}</div>
          <div className="mt-1 break-all text-xs text-muted-foreground">{candidate.deviceId}</div>
          <div className="mt-1 text-xs text-muted-foreground">{candidate.note}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{candidate.confidence}</Badge>
          {candidate.bonded ? <Badge>Bonded</Badge> : null}
          {typeof candidate.rssi === "number" ? <Badge>{candidate.rssi} dBm</Badge> : null}
        </div>
      </div>

      {onUseForSetup ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={onUseForSetup} disabled={working}>
            <ArrowRight className="h-4 w-4" />
            {working ? "Continuing setup..." : "Use this robot for setup"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function NewRobotSetupPage() {
  const navigate = useNavigate();
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const settings = useAppStore((state) => state.settings);
  const availableRobots = useAppStore((state) => state.availableRobots);
  const savedProfiles = useAppStore((state) => state.savedProfiles);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const scanForRobots = useAppStore((state) => state.scanForRobots);
  const connectRobot = useAppStore((state) => state.connectRobot);
  const pairRobot = useAppStore((state) => state.pairRobot);
  const quickRepair = useAppStore((state) => state.quickRepair);
  const connectState = useAppStore((state) => state.actionStates.connect);
  const pairState = useAppStore((state) => state.actionStates.pair);
  const scanState = useAppStore((state) => state.actionStates.scan);
  const supportState = useAppStore((state) => state.actionStates.support);
  const settingsState = useAppStore((state) => state.actionStates.settings);

  const [appBackendUrl, setAppBackendUrl] = useState(settings.appBackendUrl);
  const [mobileBackendTargets, setMobileBackendTargets] = useState<MobileBackendTarget[]>([]);
  const [discoveredBackendTargets, setDiscoveredBackendTargets] = useState<MobileBackendTarget[]>([]);
  const [backendDiscoveryState, setBackendDiscoveryState] = useState<ActionStatus>("idle");
  const [backendDiscoveryMessage, setBackendDiscoveryMessage] = useState<string>();
  const [wirePodSetup, setWirePodSetup] = useState<WirePodSetupStatus | null>(null);
  const [bluetoothStatus, setBluetoothStatus] = useState<BluetoothDiscoveryStatus | null>(null);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDiscoveryCandidate[]>([]);
  const [bluetoothScanState, setBluetoothScanState] = useState<ActionStatus>("idle");
  const [bluetoothMessage, setBluetoothMessage] = useState<string>();
  const [bluetoothSetupDeviceId, setBluetoothSetupDeviceId] = useState<string>();
  const [selectedBluetoothCandidate, setSelectedBluetoothCandidate] =
    useState<BluetoothDiscoveryCandidate | null>(null);
  const [resumeBluetoothSetupAfterBackendSave, setResumeBluetoothSetupAfterBackendSave] =
    useState(false);
  const [autoSetupState, setAutoSetupState] = useState<ActionStatus>("idle");
  const [autoSetupMessage, setAutoSetupMessage] = useState<string>();
  const [autoSetupAwaitingReturn, setAutoSetupAwaitingReturn] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [assistantNote, setAssistantNote] = useState<string>();
  const [workingCandidateId, setWorkingCandidateId] = useState<string>();
  const [setupAnotherRobot, setSetupAnotherRobot] = useState(false);
  const autoBackendDiscoveryTriggeredRef = useRef(false);
  const autoScanTriggeredRef = useRef(false);
  const autoSetupDeadlineRef = useRef<number | null>(null);

  const savedTarget = savedProfiles[0];
  const isConnected = robot.isConnected && integration.robotReachable;
  const mobileBackendNeeded = mobileRuntimeNeedsManualBackendUrl();
  const mobileShellRuntime = isMobileShellLikeRuntime();
  const savedAppBackendUrl = settings.appBackendUrl || getStoredAppBackendUrl();
  const normalizedAppBackendUrl = appBackendUrl.trim();
  const mobileLoopbackBackendSelected =
    mobileShellRuntime &&
    /^https?:\/\/(?:localhost|127(?:\.\d{1,3}){3})(?::\d+)?(?:\/|$)/i.test(normalizedAppBackendUrl);
  const backendTargetChoices = mergeBackendTargets(discoveredBackendTargets, mobileBackendTargets);
  const preferredBackendTarget = pickPreferredBackendTarget(backendTargetChoices);
  const backendUrlCandidate = normalizedAppBackendUrl || savedAppBackendUrl || preferredBackendTarget?.url || "";
  const hasExistingSavedTarget = Boolean(savedTarget || settings.robotSerial || integration.selectedSerial);
  const hasSavedTarget = setupAnotherRobot ? false : hasExistingSavedTarget;
  const desktopSavedRobotLabel =
    savedTarget?.name ||
    robot.nickname ||
    (robot.name && robot.name !== "Vector" ? robot.name : "") ||
    "your saved robot";
  const setupConnected = isConnected && !setupAnotherRobot;
  const desktopRobotChoiceVisible =
    hasExistingSavedTarget && !setupAnotherRobot && !setupConnected && !mobileBackendNeeded;
  const localSetupComplete = wirePodSetup?.initialSetupComplete ?? false;
  const shouldRequirePairing = ({
    setup,
    forceNewRobot = setupAnotherRobot,
    candidateCount = availableRobots.length,
    savedTargetKnown = hasExistingSavedTarget
  }: {
    setup?: WirePodSetupStatus | null;
    forceNewRobot?: boolean;
    candidateCount?: number;
    savedTargetKnown?: boolean;
  }) => {
    if (!setup?.initialSetupComplete) {
      return false;
    }

    if (forceNewRobot) {
      return setup.discoveredRobotCount === 0 && candidateCount === 0;
    }

    return Boolean(setup.needsRobotPairing && !savedTargetKnown && candidateCount === 0);
  };
  const needsRobotPairing = shouldRequirePairing({ setup: wirePodSetup });
  const canRunLocalSetup = integration.wirePodReachable && !settings.mockMode;
  const canScan = canRunLocalSetup && localSetupComplete && !needsRobotPairing;
  const likelyBluetoothDevices = bluetoothDevices.filter((device) => device.confidence !== "unknown");
  const primaryBluetoothCandidate =
    likelyBluetoothDevices[0] ?? bluetoothDevices[0] ?? null;
  const bluetoothStatusMessage = bluetoothMessage || bluetoothStatus?.note;
  const statusNote =
    autoSetupMessage ||
    assistantNote ||
    backendDiscoveryMessage ||
    bluetoothStatusMessage ||
    pairState.message ||
    supportState.message ||
    connectState.message ||
    scanState.message ||
    integration.note;
  const bridgeRoutesBlocked =
    integration.wirePodReachable &&
    !integration.robotReachable &&
    !setupAnotherRobot &&
    hasExistingSavedTarget &&
    Boolean(integration.note?.toLowerCase().includes("routes are not responding"));

  useEffect(() => {
    setAppBackendUrl(savedAppBackendUrl);
  }, [savedAppBackendUrl]);

  useEffect(() => {
    let cancelled = false;

    void robotService
      .getMobileBackendTargets()
      .then((targets) => {
        if (!cancelled) {
          setMobileBackendTargets(targets);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMobileBackendTargets([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.appBackendUrl]);

  useEffect(() => {
    if (normalizedAppBackendUrl || savedAppBackendUrl || !preferredBackendTarget) {
      return;
    }

    setAppBackendUrl(preferredBackendTarget.url);
  }, [normalizedAppBackendUrl, preferredBackendTarget, savedAppBackendUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadWirePodSetup = async () => {
      if (!integration.wirePodReachable || settings.mockMode) {
        if (!cancelled) {
          setWirePodSetup(null);
        }
        return;
      }

      try {
        const nextSetup = await robotService.getWirePodSetupStatus();
        if (!cancelled) {
          setWirePodSetup(nextSetup);
        }
      } catch {
        if (!cancelled) {
          setWirePodSetup(null);
        }
      }
    };

    void loadWirePodSetup();

    return () => {
      cancelled = true;
    };
  }, [integration.wirePodReachable, integration.wirePodBaseUrl, settings.appBackendUrl, settings.mockMode]);

  useEffect(() => {
    let cancelled = false;

    const loadBluetoothStatus = async () => {
      if (!mobileShellRuntime) {
        if (!cancelled) {
          setBluetoothStatus(null);
        }
        return;
      }

      const nextStatus = await bluetoothDiscoveryService.getStatus();
      if (!cancelled) {
        setBluetoothStatus(nextStatus);
      }
    };

    void loadBluetoothStatus();

    return () => {
      cancelled = true;
    };
  }, [mobileShellRuntime]);

  useEffect(() => {
    if (!canScan || hasSavedTarget || availableRobots.length > 0 || scanState.status === "loading") {
      autoScanTriggeredRef.current = false;
      return;
    }

    if (autoScanTriggeredRef.current) {
      return;
    }

    autoScanTriggeredRef.current = true;
    setAssistantNote("The local bridge is ready, so the app is scanning once for nearby authenticated robots.");
    void scanForRobots();
  }, [availableRobots.length, canScan, hasSavedTarget, scanForRobots, scanState.status]);

  useEffect(() => {
    if (!autoSetupAwaitingReturn || typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void continueAutoSetupAfterPairing();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoSetupAwaitingReturn]);

  async function handleDiscoverBackend({ fromAuto = false }: { fromAuto?: boolean } = {}) {
    setBackendDiscoveryState("loading");
    setBackendDiscoveryMessage(
      fromAuto
        ? "Looking for your desktop backend on this Wi-Fi..."
        : "Scanning this Wi-Fi for the desktop backend..."
    );
    setDiscoveredBackendTargets([]);

    if (fromAuto) {
      setAssistantNote("The phone is checking this Wi-Fi for your desktop backend automatically.");
    }

    try {
      const result = await mobileBackendDiscoveryService.discoverDesktopBackendWithRetry({
        attempts: fromAuto ? 3 : 2,
        retryDelayMs: 1_200
      });
      setDiscoveredBackendTargets(result.matches);
      setBackendDiscoveryMessage(result.note);

      if (result.status === "found" && result.target) {
        setAppBackendUrl(result.target.url);
        await updateSettings({ appBackendUrl: result.target.url });
        setBackendDiscoveryState("success");
        setAssistantNote(
          "Desktop link saved automatically. The phone can move straight into the local bridge check now."
        );
        return result.target;
      }

      if (result.status === "multiple") {
        setBackendDiscoveryState("success");
        setAssistantNote("More than one desktop backend answered on this network. Pick the right one below, then save it.");
        return null;
      }

      setBackendDiscoveryState("error");
      setAssistantNote(result.note);
      return null;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The phone could not scan this Wi-Fi for the desktop backend.";
      setBackendDiscoveryState("error");
      setBackendDiscoveryMessage(message);
      setDiscoveredBackendTargets([]);
      setAssistantNote(message);
      return null;
    }
  }

  const ensureBackendTargetReady = async () => {
    const existingBackendUrl =
      normalizedAppBackendUrl || savedAppBackendUrl || preferredBackendTarget?.url || "";

    if (existingBackendUrl) {
      if (appBackendUrl !== existingBackendUrl) {
        setAppBackendUrl(existingBackendUrl);
      }

      if (settings.appBackendUrl !== existingBackendUrl) {
        await updateSettings({ appBackendUrl: existingBackendUrl });
      }

      return existingBackendUrl;
    }

    setAutoSetupMessage("Looking for your desktop backend automatically...");
    const discoveredTarget = await handleDiscoverBackend({ fromAuto: true });
    if (discoveredTarget?.url) {
      return discoveredTarget.url;
    }

    throw new Error(
      preferredBackendTarget
        ? "The phone found a desktop backend candidate. Save the recommended backend below, then run auto setup again."
        : "The phone could not find your desktop backend yet. Keep the desktop app open on the same Wi-Fi, then try again."
    );
  };

  useEffect(() => {
    if (!mobileShellRuntime || !mobileBackendNeeded) {
      autoBackendDiscoveryTriggeredRef.current = false;

      if (!mobileBackendNeeded) {
        setBackendDiscoveryState("idle");
        setBackendDiscoveryMessage(undefined);
        setDiscoveredBackendTargets([]);
      }

      return;
    }

    if (autoBackendDiscoveryTriggeredRef.current || backendDiscoveryState === "loading") {
      return;
    }

    autoBackendDiscoveryTriggeredRef.current = true;
    void handleDiscoverBackend({ fromAuto: true });
  }, [backendDiscoveryState, mobileBackendNeeded, mobileShellRuntime]);

  const currentBlocker = mobileBackendNeeded
    ? backendDiscoveryState === "loading"
      ? "Looking for your desktop backend on this Wi-Fi."
      : preferredBackendTarget
        ? "The phone found a desktop backend. Save it to keep going."
        : "The phone still needs to find your desktop backend on this Wi-Fi."
    : autoSetupAwaitingReturn
      ? "Finish the one-time pairing portal step, then return to the app."
      : autoSetupState === "loading"
        ? "The app is working through the next setup step automatically."
        : desktopRobotChoiceVisible
          ? `${desktopSavedRobotLabel} is already saved on the desktop. Choose that robot now or switch to a different one.`
    : bridgeRoutesBlocked
      ? integration.note || "The local bridge is online, but the saved robot is not answering yet."
    : !integration.wirePodReachable
      ? "Bring the desktop backend online so this phone can keep going."
      : !localSetupComplete
        ? "Finish the one-time local setup."
        : needsRobotPairing
          ? "Finish the first pairing handoff."
          : !hasSavedTarget
            ? "Find and save your robot."
            : !setupConnected
              ? "Reconnect to the saved robot."
              : "Everything is ready.";

  const handleSaveBackend = async () => {
    if (!backendUrlCandidate) {
      setAssistantNote(
        "Let the phone finish its Wi-Fi scan, or paste a desktop backend URL if you already know it."
      );
      return;
    }

    setAssistantNote("Saving the backend target for this phone...");
    if (appBackendUrl !== backendUrlCandidate) {
      setAppBackendUrl(backendUrlCandidate);
    }
    await updateSettings({ appBackendUrl: backendUrlCandidate });
    const latestState = useAppStore.getState();
    const settingsMessage = latestState.actionStates.settings.message;
    const resolvedBackendUrl =
      latestState.settings.appBackendUrl || getStoredAppBackendUrl() || backendUrlCandidate;

    if (latestState.actionStates.settings.status === "error") {
      setAssistantNote(settingsMessage || "Saving the backend URL did not finish cleanly.");
      return;
    }

    if (selectedBluetoothCandidate && !autoSetupAwaitingReturn) {
      setAssistantNote(
        `Backend target saved at ${resolvedBackendUrl}. Resuming setup for ${selectedBluetoothCandidate.name} now.`
      );
      setResumeBluetoothSetupAfterBackendSave(true);
      return;
    }

    setAssistantNote(
      latestState.integration.wirePodReachable
        ? `Backend target saved at ${resolvedBackendUrl}. The desktop backend is online, so setup can keep going.`
        : settingsMessage ||
            `Backend target saved at ${resolvedBackendUrl}. The phone is waiting for the desktop backend to answer.`
    );
  };

  const handleFinishLocalSetup = async () => {
    setSetupLoading(true);
    setAssistantNote("Applying the default local bridge setup for first-time use...");

    try {
      const nextSetup = await robotService.finishWirePodSetup({
        language: "en-US",
        connectionMode: "escape-pod"
      });
      setWirePodSetup(nextSetup);
      setAssistantNote(nextSetup.recommendedNextStep);
      autoScanTriggeredRef.current = false;
      await scanForRobots();
    } catch (error) {
      setAssistantNote(error instanceof Error ? error.message : "The local setup step did not finish cleanly.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleOpenPairingPortal = () => {
    const baseUrl = getResolvedWirePodUrl(integration.wirePodBaseUrl);
    window.open(baseUrl, "_blank", "noopener,noreferrer");
  };

  const refreshBluetoothStatus = async () => {
    const nextStatus = await bluetoothDiscoveryService.getStatus();
    setBluetoothStatus(nextStatus);
    return nextStatus;
  };

  const handleEnableBluetooth = async () => {
    setBluetoothMessage("Asking Android to turn Bluetooth on...");

    try {
      const nextStatus = await bluetoothDiscoveryService.requestEnable();
      setBluetoothStatus(nextStatus);
      setBluetoothMessage(nextStatus.note);
    } catch (error) {
      setBluetoothMessage(
        error instanceof Error ? error.message : "Android did not enable Bluetooth cleanly."
      );
    }
  };

  const handleOpenBluetoothSettings = async () => {
    try {
      await bluetoothDiscoveryService.openBluetoothSettings();
      setBluetoothMessage("Bluetooth settings opened on Android.");
    } catch (error) {
      setBluetoothMessage(
        error instanceof Error ? error.message : "Bluetooth settings could not be opened."
      );
    }
  };

  const handleOpenLocationSettings = async () => {
    try {
      await bluetoothDiscoveryService.openLocationSettings();
      setBluetoothMessage("Location settings opened on Android.");
    } catch (error) {
      setBluetoothMessage(
        error instanceof Error ? error.message : "Location settings could not be opened."
      );
    }
  };

  const handleOpenBluetoothAppSettings = async () => {
    try {
      await bluetoothDiscoveryService.openAppSettings();
      setBluetoothMessage("Android app settings opened. If Nearby Devices was denied, allow it there and come back.");
    } catch (error) {
      setBluetoothMessage(
        error instanceof Error ? error.message : "App settings could not be opened."
      );
    }
  };

  const handleBluetoothScan = async ({ fromAutoSetup = false }: { fromAutoSetup?: boolean } = {}) => {
    setBluetoothScanState("loading");
    setBluetoothMessage(
      fromAutoSetup
        ? "Android may ask for Nearby Devices first. Tap Allow so the phone can look for Vector."
        : "Scanning nearby Bluetooth devices for a pairing-mode robot..."
    );

    try {
      const scanSnapshot = await bluetoothDiscoveryService.scanForPairingModeVectors();
      setBluetoothDevices(scanSnapshot.devices);
      await refreshBluetoothStatus();
      setBluetoothMessage(scanSnapshot.note);

      if (scanSnapshot.likelyCount > 0) {
        setAssistantNote(
          "Bluetooth found a likely Vector-class device nearby. Keep the robot in pairing mode and finish the first handshake through the pairing portal."
        );
      }
    } catch (error) {
      setBluetoothMessage(describeBluetoothError(error));
      await refreshBluetoothStatus().catch(() => undefined);
    } finally {
      setBluetoothScanState("idle");
    }
  };

  const handleBluetoothCandidateSetup = async (candidate: BluetoothDiscoveryCandidate) => {
    setSetupAnotherRobot(true);
    setBluetoothSetupDeviceId(candidate.id);
    setSelectedBluetoothCandidate(candidate);
    setResumeBluetoothSetupAfterBackendSave(false);
    setAssistantNote(
      `${candidate.name} looks like the right robot. The app will carry that into the pairing handoff and try to finish setup automatically when you come back.`
    );

    try {
      await handleAutoSetup(candidate);
    } finally {
      setBluetoothSetupDeviceId(undefined);
    }
  };

  const waitForAutoDiscovery = async () => {
    const deadline = autoSetupDeadlineRef.current ?? Date.now() + AUTO_SETUP_TIMEOUT_MS;
    autoSetupDeadlineRef.current = deadline;

    while (Date.now() < deadline) {
      const nextSetup = await robotService.getWirePodSetupStatus().catch(() => wirePodSetup);
      if (nextSetup) {
        setWirePodSetup(nextSetup);
      }

      const latestState = useAppStore.getState();
      const nextSetupNeedsPairing = shouldRequirePairing({
        setup: nextSetup,
        forceNewRobot: setupAnotherRobot,
        candidateCount: latestState.availableRobots.length,
        savedTargetKnown: Boolean(
          latestState.settings.robotSerial ||
            latestState.integration.selectedSerial ||
            latestState.robot.serial
        )
      });

      if (!nextSetupNeedsPairing) {
        setAutoSetupMessage("The pairing handoff looks complete. Scanning local Wi-Fi for your robot...");
        autoScanTriggeredRef.current = false;
        await scanForRobots();

        const latestStateAfterScan = useAppStore.getState();
        const autoCandidate = pickAutoConnectCandidate({
          candidates: latestStateAfterScan.availableRobots,
          preferredSerials: [
            ...(setupAnotherRobot
              ? []
              : [
                  latestStateAfterScan.settings.robotSerial,
                  latestStateAfterScan.integration.selectedSerial,
                  latestStateAfterScan.robot.serial
                ])
          ],
          avoidedSerials: setupAnotherRobot
            ? [
                latestStateAfterScan.settings.robotSerial,
                latestStateAfterScan.integration.selectedSerial,
                latestStateAfterScan.robot.serial
              ]
            : []
        });

        if (autoCandidate) {
          return { candidate: autoCandidate, needsPairing: false };
        }

        if (
          !setupAnotherRobot &&
          (latestStateAfterScan.settings.robotSerial ||
            latestStateAfterScan.integration.selectedSerial ||
            latestStateAfterScan.robot.serial)
        ) {
          setAutoSetupMessage("A robot serial is already known, so the app is trying a direct connect...");
          await connectRobot();

          const connectedState = useAppStore.getState();
          if (connectedState.robot.isConnected && connectedState.integration.robotReachable) {
            return { candidate: null, needsPairing: false };
          }
        }
      }

      await delay(AUTO_SETUP_POLL_INTERVAL_MS);
    }

    return {
      candidate: null,
      needsPairing: shouldRequirePairing({ setup: wirePodSetup, forceNewRobot: setupAnotherRobot })
    };
  };

  const continueAutoSetupAfterPairing = async () => {
    setAutoSetupState("loading");
    setAutoSetupAwaitingReturn(false);

    const { candidate, needsPairing } = await waitForAutoDiscovery();

    if (candidate) {
      setAutoSetupMessage(`Found ${candidate.name}. Saving it and finishing the live connection...`);
      await handleSaveAndConnect(candidate);
      setAutoSetupState("success");
      setSetupAnotherRobot(false);
      setSelectedBluetoothCandidate(null);
      setResumeBluetoothSetupAfterBackendSave(false);
      setAutoSetupMessage(`${candidate.name} is saved and connected. Future launches should feel much easier now.`);
      return;
    }

    const latestState = useAppStore.getState();
    if (!setupAnotherRobot && latestState.robot.isConnected && latestState.integration.robotReachable) {
      setAutoSetupState("success");
      setSetupAnotherRobot(false);
      setSelectedBluetoothCandidate(null);
      setResumeBluetoothSetupAfterBackendSave(false);
      setAutoSetupMessage("The saved robot target is online and connected.");
      return;
    }

    setAutoSetupState("error");
    setAutoSetupMessage(
      needsPairing
        ? "The robot still needs the pairing portal step. Finish that handshake, return to the app, and the auto setup can continue."
        : "I couldn't auto-pick a single robot safely. Use the scan results below or open the pairing page to choose the right one."
    );
  };

  const handleAutoSetup = async (selectedBluetoothCandidate?: BluetoothDiscoveryCandidate) => {
    if (!selectedBluetoothCandidate && desktopRobotChoiceVisible) {
      setAutoSetupState("idle");
      setAutoSetupMessage(
        `${desktopSavedRobotLabel} is already saved on the desktop. Use that robot now, or tap "Set up a different robot" before running the new-robot flow.`
      );
      return;
    }

    setAutoSetupState("loading");
    setAutoSetupMessage(
      selectedBluetoothCandidate
        ? `Using ${selectedBluetoothCandidate.name} as the nearby robot and starting the automatic setup flow...`
        : "Starting the automatic mobile setup flow..."
    );
    autoSetupDeadlineRef.current = Date.now() + AUTO_SETUP_TIMEOUT_MS;

    try {
      if (mobileBackendNeeded) {
        const resolvedBackendUrl = await ensureBackendTargetReady();
        setAutoSetupMessage(`Desktop link saved at ${resolvedBackendUrl}. Checking the local bridge next...`);
      }

      if (!useAppStore.getState().integration.wirePodReachable && !settings.mockMode) {
        setAutoSetupMessage("Trying a quick repair so the local bridge comes online...");
        await quickRepair();
      }

      let nextSetup = await robotService.getWirePodSetupStatus().catch(() => null);
      if (!nextSetup?.initialSetupComplete) {
        setAutoSetupMessage("Applying the safe first-run local defaults automatically...");
        nextSetup = await robotService.finishWirePodSetup({
          language: "en-US",
          connectionMode: "escape-pod"
        });
      }

      if (nextSetup) {
        setWirePodSetup(nextSetup);
      }

      if (mobileShellRuntime) {
        let nextBluetoothStatus = await refreshBluetoothStatus();
        if (nextBluetoothStatus.supported && !nextBluetoothStatus.bluetoothEnabled) {
          setAutoSetupMessage("Turning Bluetooth on so the phone can look for the robot...");
          nextBluetoothStatus = await bluetoothDiscoveryService.requestEnable();
          setBluetoothStatus(nextBluetoothStatus);
        }

        if (nextBluetoothStatus.supported) {
          if (selectedBluetoothCandidate) {
            setBluetoothDevices((current) => {
              const nextDevices = current.filter((device) => device.id !== selectedBluetoothCandidate.id);
              return [selectedBluetoothCandidate, ...nextDevices];
            });
            setBluetoothMessage(
              `${selectedBluetoothCandidate.name} is already visible over Bluetooth. Moving straight into the pairing handoff.`
            );
          } else {
            setAutoSetupMessage("Scanning Bluetooth next. If Android asks for Nearby Devices, tap Allow.");
            await handleBluetoothScan({ fromAutoSetup: true });
          }
        }
      }

      const latestState = useAppStore.getState();
      const nextSetupNeedsPairing = shouldRequirePairing({
        setup: nextSetup,
        forceNewRobot: Boolean(selectedBluetoothCandidate) || setupAnotherRobot,
        candidateCount: latestState.availableRobots.length,
        savedTargetKnown: Boolean(
          latestState.settings.robotSerial ||
            latestState.integration.selectedSerial ||
            latestState.robot.serial
        )
      });

      if (nextSetupNeedsPairing) {
        setAutoSetupAwaitingReturn(true);
        setAutoSetupMessage(
          selectedBluetoothCandidate
            ? `${selectedBluetoothCandidate.name} is nearby. Opening the pairing portal now. Finish the one-time handshake there, then come back to this app and it will keep going automatically.`
            : "Opening the pairing portal now. Finish the one-time robot handshake there, then come back to this app and it will keep going."
        );
        handleOpenPairingPortal();
        return;
      }

      await continueAutoSetupAfterPairing();
    } catch (error) {
      setAutoSetupState("error");
      setAutoSetupAwaitingReturn(false);
      setAutoSetupMessage(
        error instanceof Error ? error.message : "Automatic setup did not finish cleanly."
      );
    }
  };

  useEffect(() => {
    if (!resumeBluetoothSetupAfterBackendSave || !selectedBluetoothCandidate) {
      return;
    }

    const hasSavedBackendTarget = Boolean(
      normalizedAppBackendUrl || savedAppBackendUrl || settings.appBackendUrl
    );
    if (!hasSavedBackendTarget) {
      return;
    }

    setResumeBluetoothSetupAfterBackendSave(false);
    void handleAutoSetup(selectedBluetoothCandidate);
  }, [
    normalizedAppBackendUrl,
    resumeBluetoothSetupAfterBackendSave,
    savedAppBackendUrl,
    selectedBluetoothCandidate,
    settings.appBackendUrl
  ]);

  const handleSaveAndConnect = async (candidate: PairingCandidate) => {
    setWorkingCandidateId(candidate.id);
    setAssistantNote(`Saving ${candidate.name} so future launches can reconnect automatically...`);

    try {
      await pairRobot({
        name: candidate.name,
        ipAddress: candidate.ipAddress,
        token: "",
        autoReconnect: settings.reconnectOnStartup,
        serial: candidate.serial || ""
      });
      await connectRobot();
      setSetupAnotherRobot(false);
      setSelectedBluetoothCandidate(null);
      setResumeBluetoothSetupAfterBackendSave(false);
      setAssistantNote(`${candidate.name} is saved. Opening the dashboard next should feel normal from now on.`);
    } finally {
      setWorkingCandidateId(undefined);
    }
  };

  const backendTone = getStepTone({
    done: !mobileBackendNeeded,
    ready: true
  });
  const localBrainTone = getStepTone({
    done: integration.wirePodReachable && localSetupComplete,
    ready: !mobileBackendNeeded
  });
  const pairingTone = getStepTone({
    done: canRunLocalSetup && !needsRobotPairing,
    ready: integration.wirePodReachable && localSetupComplete
  });
  const discoveryTone = getStepTone({
    done: hasSavedTarget || availableRobots.length > 0,
    ready: canScan
  });
  const connectTone = getStepTone({
    done: setupConnected,
    ready: hasSavedTarget || availableRobots.length > 0
  });

  return (
    <div className="min-h-[calc(100vh-2rem)] px-1 py-3 md:px-4">
      <div className="mx-auto grid max-w-[1240px] gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="space-y-5 p-4 sm:p-5 md:p-8">
              <div className="space-y-3">
                <div className="eyebrow">New robot setup</div>
                <div className="space-y-2">
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
                    Set up a brand-new Vector from one place.
                  </h1>
                  <p className="max-w-3xl text-base text-muted-foreground">
                    This guided flow handles the phone-to-desktop connection, the easy local setup defaults, the one
                    real pairing handoff, and the first saved reconnect target.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge>{mobileBackendNeeded ? "Phone still needs backend" : "Phone linked to desktop"}</Badge>
                <Badge>{integration.wirePodReachable ? "Local bridge reachable" : "Local bridge offline"}</Badge>
                <Badge>
                  {setupAnotherRobot
                    ? "Setting up another robot"
                    : hasExistingSavedTarget
                      ? "Target saved"
                      : "No robot target yet"}
                </Badge>
                <Badge>{setupConnected ? "Robot connected" : "Robot not live yet"}</Badge>
              </div>

              <div className="rounded-3xl border border-sky-400/20 bg-sky-400/8 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Current blocker
                </div>
                <p className="mt-2 text-sm text-foreground/90">{currentBlocker}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {statusNote ||
                    "The goal is simple: get one successful first-time pairing, save the serial, then let every future launch feel automatic."}
                </p>
              </div>

              {desktopRobotChoiceVisible ? (
                <div className="rounded-3xl border border-amber-400/20 bg-amber-400/8 p-4">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />
                    Desktop Already Has A Robot
                  </div>
                  <p className="mt-2 text-sm text-foreground/90">
                    The desktop side already knows {desktopSavedRobotLabel}. If you are pairing a different Vector,
                    switch the flow first so the app does not keep drifting back toward the saved robot.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void connectRobot()} disabled={connectState.status === "loading"}>
                      <ArrowRight className="h-4 w-4" />
                      {connectState.status === "loading" ? "Connecting saved robot..." : `Use ${desktopSavedRobotLabel} now`}
                    </Button>
                    <Button
                      onClick={() => {
                        setSetupAnotherRobot(true);
                        setAssistantNote(
                          `Ignoring ${desktopSavedRobotLabel} for now. The next Bluetooth or Wi-Fi hit will be treated as a different robot.`
                        );
                      }}
                    >
                      <Bluetooth className="h-4 w-4" />
                      Set up a different robot
                    </Button>
                  </div>
                </div>
              ) : null}

              {setupConnected ? (
                <div className="flex flex-wrap gap-3">
                  <Button size="lg" onClick={() => navigate("/dashboard")}>
                    <ArrowRight className="h-4 w-4" />
                    Open dashboard
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      setSetupAnotherRobot(true);
                      setAssistantNote(
                        "The current robot can stay saved. The setup flow will now treat the next Bluetooth or Wi-Fi hit as a different robot."
                      );
                    }}
                  >
                    <Bluetooth className="h-4 w-4" />
                    Set up another robot
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => navigate("/pairing")}>
                    <Bot className="h-4 w-4" />
                    Manage saved robots
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={() => void handleAutoSetup()}
                    disabled={autoSetupState === "loading"}
                  >
                    <Bluetooth className="h-4 w-4" />
                    {autoSetupState === "loading"
                      ? autoSetupAwaitingReturn
                        ? "Finish pairing and return"
                        : "Running auto setup..."
                      : "Auto setup and connect"}
                  </Button>
                  {setupAnotherRobot ? (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setSetupAnotherRobot(false);
                        setAssistantNote("Returned to the current saved robot path.");
                      }}
                    >
                      <ArrowRight className="h-4 w-4" />
                      Use current robot instead
                    </Button>
                  ) : null}
                  <Button variant="outline" size="lg" onClick={() => navigate("/pairing?intent=new-robot")}>
                    <Bot className="h-4 w-4" />
                    Manual pairing tools
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <SetupStepCard
              number={1}
              title="Link this phone to your desktop backend"
              summary="The app tries to find your desktop backend on the same Wi-Fi, or you can paste it manually."
            statusLabel={
              mobileBackendNeeded
                ? backendDiscoveryState === "loading"
                  ? "Scanning"
                  : preferredBackendTarget
                    ? "Found"
                    : "Needed"
                : "Done"
            }
            tone={backendTone}
          >
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Desktop or LAN backend URL</label>
              <Input
                value={appBackendUrl}
                placeholder="http://192.168.x.x:8787"
                onChange={(event) => setAppBackendUrl(event.target.value)}
              />
              {preferredBackendTarget ? (
                <div className="text-xs text-muted-foreground">
                  Recommended: {preferredBackendTarget.label} at {preferredBackendTarget.url}
                </div>
              ) : null}
              {mobileLoopbackBackendSelected ? (
                <div className="text-xs text-amber-300">
                  `127.0.0.1` and `localhost` point back to the phone itself. On a real phone, switch to your desktop LAN address instead.
                </div>
              ) : null}
              {backendDiscoveryMessage ? (
                <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4 text-sm text-muted-foreground">
                  {backendDiscoveryMessage}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Detected backend URLs</div>
              {backendTargetChoices.length ? (
                <div className="grid gap-2">
                  {backendTargetChoices.map((target) => (
                    <button
                      key={target.url}
                      type="button"
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] px-4 py-3 text-left transition hover:border-primary/30"
                      onClick={() => setAppBackendUrl(target.url)}
                    >
                      <div>
                        <div className="text-sm font-semibold">{target.label}</div>
                        <div className="mt-1 break-all text-xs text-muted-foreground">{target.url}</div>
                      </div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        {target.kind === "lan" ? "LAN" : "Local"}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-4 text-sm text-muted-foreground">
                  {backendDiscoveryState === "loading"
                    ? "Scanning this Wi-Fi now. Keep the desktop app open while the phone checks your local network."
                    : "If nothing appears, make sure the desktop app is open and both devices are on the same Wi-Fi, then try auto-find again."}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {mobileShellRuntime ? (
                <Button
                  variant="outline"
                  onClick={() => void handleDiscoverBackend()}
                  disabled={backendDiscoveryState === "loading"}
                >
                  <RefreshCw className={cn("h-4 w-4", backendDiscoveryState === "loading" && "animate-spin")} />
                  {backendDiscoveryState === "loading" ? "Auto-finding backend..." : "Auto-find backend"}
                </Button>
              ) : null}
              {preferredBackendTarget ? (
                <Button
                  variant="outline"
                  onClick={() => setAppBackendUrl(preferredBackendTarget.url)}
                  disabled={appBackendUrl === preferredBackendTarget.url}
                >
                  <ArrowRight className="h-4 w-4" />
                  Use recommended backend
                </Button>
              ) : null}
              <Button
                onClick={() => void handleSaveBackend()}
                disabled={settingsState.status === "loading"}
              >
                <Globe className="h-4 w-4" />
                {settingsState.status === "loading"
                  ? "Saving backend..."
                  : selectedBluetoothCandidate
                    ? "Save backend and continue"
                    : "Save backend URL"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/settings")}>
                <Smartphone className="h-4 w-4" />
                Open full settings
              </Button>
            </div>
          </SetupStepCard>

          <SetupStepCard
            number={2}
            title="Apply the local bridge defaults"
            summary="The app can finish the safe first-run local defaults for you instead of sending you through extra setup screens."
            statusLabel={integration.wirePodReachable && localSetupComplete ? "Done" : "Needed"}
            tone={localBrainTone}
          >
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4 text-sm text-muted-foreground">
                {integration.wirePodReachable
                  ? localSetupComplete
                    ? bridgeRoutesBlocked
                      ? integration.note ||
                        "The local bridge already knows your saved robot, but its live SDK routes are timing out. Retry connection or run Quick repair instead of pairing again."
                      : wirePodSetup?.recommendedNextStep || "Local setup already looks good."
                    : "The backend is reachable, but the first-run defaults still need one pass."
                  : "The phone still cannot reach the desktop backend. Save the backend URL first, then retry."}
              </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void handleFinishLocalSetup()}
                disabled={!canRunLocalSetup || setupLoading}
              >
                <RefreshCw className="h-4 w-4" />
                {setupLoading
                  ? "Applying setup..."
                  : localSetupComplete
                    ? "Re-apply local defaults"
                    : "Finish local setup automatically"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void quickRepair()}
                disabled={settings.mockMode || supportState.status === "loading"}
              >
                <ShieldAlert className="h-4 w-4" />
                {supportState.status === "loading" ? "Trying quick repair..." : "Quick repair"}
              </Button>
            </div>
          </SetupStepCard>

          <SetupStepCard
              number={3}
              title="Check Bluetooth and look for a pairing-mode robot"
              summary="Android can scan nearby Bluetooth devices here. The first scan may ask for Nearby Devices permission."
            statusLabel={
              !mobileShellRuntime
                ? "Desktop fallback"
                : bluetoothStatus?.supported
                  ? likelyBluetoothDevices.length > 0
                    ? "Vector nearby"
                    : needsRobotPairing
                      ? "Scan + pair"
                      : "Ready"
                  : "Not available"
            }
            tone={pairingTone}
          >
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4 text-sm text-muted-foreground">
                {!mobileShellRuntime
                  ? "Bluetooth discovery is available in the Android app. On desktop or web, use the pairing portal below."
                  : bluetoothStatusMessage ||
                    "Check Bluetooth first, then scan while Vector is nearby in pairing mode. If Android asks for Nearby Devices, tap Allow."}
              </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => void handleBluetoothScan()}
                disabled={!mobileShellRuntime || bluetoothScanState === "loading"}
              >
                <Bluetooth className="h-4 w-4" />
                {bluetoothScanState === "loading" ? "Scanning Bluetooth..." : "Scan over Bluetooth"}
              </Button>
              {mobileShellRuntime && bluetoothStatus?.supported && !bluetoothStatus.bluetoothEnabled ? (
                <Button variant="ghost" onClick={() => void handleEnableBluetooth()}>
                  <Bluetooth className="h-4 w-4" />
                  Turn on Bluetooth
                </Button>
              ) : null}
              {mobileShellRuntime && bluetoothStatus?.supported ? (
                <Button variant="ghost" onClick={() => void handleOpenBluetoothSettings()}>
                  <Bluetooth className="h-4 w-4" />
                  Open Bluetooth settings
                </Button>
              ) : null}
              {mobileShellRuntime && bluetoothStatus?.supported ? (
                <Button variant="ghost" onClick={() => void handleOpenBluetoothAppSettings()}>
                  <ShieldAlert className="h-4 w-4" />
                  Open app permissions
                </Button>
              ) : null}
              {mobileShellRuntime && bluetoothStatus?.locationEnabled === false ? (
                <Button variant="ghost" onClick={() => void handleOpenLocationSettings()}>
                  <Globe className="h-4 w-4" />
                  Open location settings
                </Button>
              ) : null}
            </div>

            {primaryBluetoothCandidate ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/90">
                {primaryBluetoothCandidate.name} is already visible over Bluetooth. Use it to jump straight into the pairing handoff and let the app resume setup automatically when you return.
              </div>
            ) : null}

            {bluetoothDevices.length ? (
              <div className="grid gap-3">
                {bluetoothDevices.map((candidate) => (
                  <BluetoothCandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    working={autoSetupState === "loading" && bluetoothSetupDeviceId === candidate.id}
                    onUseForSetup={() => void handleBluetoothCandidateSetup(candidate)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-4 text-sm text-muted-foreground">
                  {mobileShellRuntime
                    ? "No Bluetooth candidates yet. Keep Vector in pairing mode, stay close, allow Nearby Devices if Android asks, and scan again."
                    : "Bluetooth scan results only appear in the native Android app right now."}
                </div>
              )}

            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-4 text-sm text-muted-foreground">
              {needsRobotPairing
                ? "If Bluetooth sees the robot or you already know it is in pairing mode, open the local pairing portal once to finish the Bluetooth and Wi-Fi handshake."
                : setupAnotherRobot
                  ? "The saved robot path is paused, so use the portal only if this different Vector still has not finished its first handshake."
                  : "A fresh pairing handshake is not needed for the saved robot. Stay on reconnect or Quick repair unless you are onboarding a different Vector."}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleOpenPairingPortal} disabled={!canRunLocalSetup}>
                <ExternalLink className="h-4 w-4" />
                Open pairing portal
              </Button>
              <Button variant="ghost" onClick={() => navigate("/pairing?intent=new-robot")}>
                <Bot className="h-4 w-4" />
                Open classic pairing page
              </Button>
            </div>
          </SetupStepCard>

          <SetupStepCard
            number={4}
            title="Find your Vector on local Wi-Fi"
            summary="After the first handshake, discovery should surface the robot here so you can save it for future reconnects."
            statusLabel={availableRobots.length || hasSavedTarget ? "Ready" : "Scan next"}
            tone={discoveryTone}
          >
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void scanForRobots()} disabled={!canScan || scanState.status === "loading"}>
                <Search className="h-4 w-4" />
                {scanState.status === "loading" ? "Scanning..." : "Scan for robots"}
              </Button>
              {hasSavedTarget && !setupConnected ? (
                <Button variant="outline" onClick={() => void connectRobot()} disabled={connectState.status === "loading"}>
                  <ArrowRight className="h-4 w-4" />
                  {connectState.status === "loading" ? "Connecting..." : "Connect saved target"}
                </Button>
              ) : null}
            </div>

            {availableRobots.length ? (
              <div className="grid gap-3">
                {availableRobots.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    working={workingCandidateId === candidate.id || pairState.status === "loading"}
                    onSaveAndConnect={() => void handleSaveAndConnect(candidate)}
                    onSaveSerial={() => void updateSettings({ robotSerial: candidate.serial || "" })}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-[var(--surface-border)] p-6 text-sm text-muted-foreground">
                {canScan
                  ? "No robots are in the list yet. If this is a fresh robot, finish the portal handshake, wait a few seconds, then scan again."
                  : "The scan step will unlock once the backend is linked, the local bridge is reachable, and the first pairing handshake is out of the way."}
              </div>
            )}
          </SetupStepCard>

          <SetupStepCard
            number={5}
            title="Save the robot and make future launches simple"
            summary="Once one robot is saved, the app can reconnect to it on later launches without making normal users think about serial numbers."
            statusLabel={setupConnected ? "Done" : hasSavedTarget ? "Ready" : "Waiting"}
            tone={connectTone}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
                <div className="text-sm text-muted-foreground">Saved target</div>
                <div className="mt-2 text-lg font-semibold">
                  {integration.selectedSerial || settings.robotSerial || savedTarget?.serial || "Not saved yet"}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
                <div className="text-sm text-muted-foreground">Robot link</div>
                <div className="mt-2 text-lg font-semibold">{setupConnected ? "Online" : "Waiting"}</div>
              </div>
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
                <div className="text-sm text-muted-foreground">Last seen</div>
                <div className="mt-2 text-lg font-semibold">{formatRelativeTime(robot.lastSeen)}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => (setupConnected ? navigate("/dashboard") : void connectRobot())} disabled={!hasSavedTarget && !setupConnected}>
                <ArrowRight className="h-4 w-4" />
                {setupConnected ? "Open dashboard" : "Connect now"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/pairing")}>
                <Wifi className="h-4 w-4" />
                Manage saved robot details
              </Button>
            </div>
          </SetupStepCard>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>What This Handles Today</CardTitle>
              <CardDescription>
                This page is the foundation for a friendlier first-time-owner experience right now.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>The phone can save the desktop backend target without sending people hunting through the app first.</span>
              </div>
              <div className="flex items-start gap-3">
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>The app can apply the default local bridge setup and then move straight into scanning.</span>
              </div>
              <div className="flex items-start gap-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Once the pairing handshake is done, the app can save the robot target and reconnect automatically next time.</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bluetooth Status</CardTitle>
              <CardDescription>
                Honest status for the mobile-first setup path you asked for.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
                <div className="font-semibold text-foreground">Today</div>
                <p className="mt-2">
                  Android can now check Bluetooth readiness and scan nearby BLE devices from inside the app. The actual
                  first pairing handshake still opens the local pairing portal once.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
                <div className="font-semibold text-foreground">Next</div>
                <p className="mt-2">
                  The next step is full in-app pairing and provisioning, so the Bluetooth scan can do more than identify
                  the robot and hand off to the portal.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Setup Snapshot</CardTitle>
              <CardDescription>Useful at a glance while you walk through the steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
                  <div className="text-sm text-muted-foreground">Desktop backend saved on this phone</div>
                  <div className="mt-2 break-all text-sm font-semibold">{savedAppBackendUrl || "Not saved yet"}</div>
                </div>
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
                <div className="text-sm text-muted-foreground">Desktop local bridge endpoint</div>
                <div className="mt-2 break-all text-sm font-semibold">{integration.wirePodBaseUrl}</div>
              </div>
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
                <div className="text-sm text-muted-foreground">Robot</div>
                <div className="mt-2 text-sm font-semibold">
                  {robot.nickname || robot.name}
                  {robot.ipAddress && robot.ipAddress !== "Unavailable" ? ` on ${robot.ipAddress}` : ""}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fallback Paths</CardTitle>
              <CardDescription>Useful if the first-time flow gets stuck for any reason.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/pairing")}>
                <Wifi className="h-4 w-4" />
                Open classic pairing page
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/settings")}>
                <Smartphone className="h-4 w-4" />
                Open full settings
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/diagnostics")}>
                <ShieldAlert className="h-4 w-4" />
                Open diagnostics
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
