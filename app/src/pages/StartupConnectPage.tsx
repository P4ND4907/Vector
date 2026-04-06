import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  PlugZap,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Wifi
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StartupOverviewCard } from "@/components/startup/StartupOverviewCard";
import { StartupSetupCard } from "@/components/startup/StartupSetupCard";
import { formatRelativeTime } from "@/lib/format";
import { getBatteryState, getBrainStatusLabel, getSystemStatusDisplay } from "@/lib/robot-state";
import { getStoredAppBackendUrl, isMobileShellLikeRuntime } from "@/lib/runtime-target";
import { buildStartupGuide } from "@/lib/startup-onboarding";
import { robotService } from "@/services/robotService";
import { useAppStore } from "@/store/useAppStore";
import type { WirePodSetupStatus } from "@/types";

const stageSurfaceTone = {
  connected: "border-emerald-400/20 bg-emerald-400/8",
  mock: "border-amber-300/20 bg-amber-300/8",
  "mobile-backend-needed": "border-sky-400/20 bg-sky-400/8",
  "wirepod-setup": "border-sky-400/20 bg-sky-400/8",
  "wirepod-missing": "border-red-400/20 bg-red-400/8",
  "needs-target": "border-sky-400/20 bg-sky-400/8",
  "robot-offline": "border-white/10 bg-white/[0.03]"
} as const;

export function StartupConnectPage() {
  const navigate = useNavigate();
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const availableRobots = useAppStore((state) => state.availableRobots);
  const savedProfiles = useAppStore((state) => state.savedProfiles);
  const settings = useAppStore((state) => state.settings);
  const connectRobot = useAppStore((state) => state.connectRobot);
  const scanForRobots = useAppStore((state) => state.scanForRobots);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const quickRepair = useAppStore((state) => state.quickRepair);
  const connectState = useAppStore((state) => state.actionStates.connect);
  const scanState = useAppStore((state) => state.actionStates.scan);
  const supportState = useAppStore((state) => state.actionStates.support);
  const [wirePodSetup, setWirePodSetup] = useState<WirePodSetupStatus | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string>();

  const batteryState = getBatteryState(robot);
  const systemStatus = getSystemStatusDisplay(robot.systemStatus);
  const brainStatus = getBrainStatusLabel(integration);
  const savedTarget = savedProfiles[0];
  const isConnected = robot.isConnected && integration.robotReachable;
  const localBrainValue = integration.wirePodReachable
    ? integration.managedBridge.source === "bundled"
      ? "Built-in"
      : "Detected"
    : "Offline";
  const localBrainDescription = integration.wirePodReachable
    ? integration.managedBridge.source === "bundled"
      ? "The app is using its built-in local bridge."
      : "WirePod answered the backend."
    : integration.managedBridge.available
      ? "The built-in bridge is available and will be started automatically."
      : "The app cannot reach WirePod yet.";
  const mobileRuntimeNeedsBackend =
    isMobileShellLikeRuntime() && getStoredAppBackendUrl().trim().length === 0;

  const guide = useMemo(
    () =>
      buildStartupGuide({
        robot,
        integration,
        settings,
        savedProfile: savedTarget,
        availableRobots,
        wirePodSetup,
        mobileRuntimeNeedsBackend
      }),
    [availableRobots, integration, mobileRuntimeNeedsBackend, robot, savedTarget, settings, wirePodSetup]
  );

  const topCandidates = useMemo(() => availableRobots.slice(0, 3), [availableRobots]);
  const statusMessage =
    setupMessage ||
    supportState.message ||
    connectState.message ||
    scanState.message ||
    integration.note ||
    guide.nextDetail;
  const completedChecklistCount = guide.checklist.filter((item) => item.done).length;
  const setupTitle = wirePodSetup?.initialSetupComplete ? "Local setup is ready" : "Local setup still needs one pass";
  const setupDescription = wirePodSetup
    ? wirePodSetup.initialSetupComplete
      ? `WirePod is set to ${wirePodSetup.connectionMode === "escape-pod" ? "Escape Pod" : "IP"} mode with ${wirePodSetup.sttLanguage}.`
      : "The app can apply the default local setup for you: English (US) plus Escape Pod mode."
    : "Once the local brain answers, the app can check whether the one-time setup is already done.";
  const pairingHint = wirePodSetup?.needsRobotPairing
    ? "Vector still needs the one-time Bluetooth and Wi-Fi handshake through the pairing portal."
    : "If no robot appears after local setup, open the pairing portal once to finish the first-time handshake.";

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
  }, [integration.wirePodReachable, integration.wirePodBaseUrl, settings.mockMode]);

  const handleFinishLocalSetup = async () => {
    setSetupLoading(true);
    setSetupMessage("Applying the default local setup...");

    try {
      const nextSetup = await robotService.finishWirePodSetup({
        language: "en-US",
        connectionMode: "escape-pod"
      });
      setWirePodSetup(nextSetup);
      setSetupMessage(nextSetup.recommendedNextStep);
      await scanForRobots();
      await connectRobot();
    } catch (error) {
      setSetupMessage(error instanceof Error ? error.message : "The local setup step did not finish cleanly.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleOpenRobotPairingPortal = () => {
    const baseUrl =
      integration.wirePodBaseUrl && integration.wirePodBaseUrl.trim().length > 0
        ? integration.wirePodBaseUrl
        : "http://127.0.0.1:8080";
    window.open(baseUrl, "_blank", "noopener,noreferrer");
  };

  const handlePrimary = async () => {
    if (guide.stage === "mobile-backend-needed") {
      navigate("/settings");
      return;
    }

    if (isConnected) {
      navigate("/dashboard");
      return;
    }

    await connectRobot();
  };

  const handleEnableMock = async () => {
    await updateSettings({ mockMode: true });
    navigate("/dashboard");
  };

  const handleDisableMock = async () => {
    await updateSettings({ mockMode: false });
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] px-1 py-3 md:px-4">
      <div className="mx-auto grid max-w-[1240px] gap-3 md:gap-4 xl:grid-cols-[1.04fr_0.96fr]">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-5 p-4 sm:p-5 md:gap-6 md:p-8">
            <div className="space-y-3 md:space-y-4">
              <div className="eyebrow">Startup connection</div>
              <div className="space-y-2 md:space-y-3">
                <h1 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">{guide.headline}</h1>
                <p className="max-w-2xl text-base text-muted-foreground">{guide.description}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge>{systemStatus.label}</Badge>
              <Badge className={batteryState.badgeClassName}>{batteryState.label}</Badge>
              <Badge>{brainStatus}</Badge>
              <Badge>{integration.selectedSerial || robot.serial || "No serial saved"}</Badge>
            </div>

            <div className={`rounded-3xl border p-4 ${stageSurfaceTone[guide.stage]}`}>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" />
                {guide.dependencyLabel}
              </div>
              <p className="mt-2 text-sm text-foreground/90">{guide.dependencyDetail}</p>
              <p className="mt-2 text-sm text-muted-foreground">{statusMessage}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <StartupOverviewCard
                title="Local brain"
                icon={<PlugZap className="h-4 w-4 text-primary" />}
                value={localBrainValue}
                description={localBrainDescription}
              />

              <StartupOverviewCard
                title="Saved target"
                icon={<Bot className="h-4 w-4 text-primary" />}
                value={integration.selectedSerial || settings.robotSerial || "Not set"}
                description={savedTarget ? `${savedTarget.name} is ready to reconnect.` : "Save a robot once so launch stays simple."}
              />

              <StartupOverviewCard
                title="Robot link"
                icon={<Wifi className="h-4 w-4 text-primary" />}
                value={isConnected ? "Online" : "Waiting"}
                description={`Last seen ${formatRelativeTime(robot.lastSeen)}`}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {guide.stage === "mock" ? (
                <>
                  <Button size="lg" onClick={handleDisableMock}>
                    <ShieldAlert className="h-4 w-4" />
                    Turn off mock mode
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
                    <ArrowRight className="h-4 w-4" />
                    Open demo dashboard
                  </Button>
                </>
              ) : guide.stage === "mobile-backend-needed" ? (
                <>
                  <Button size="lg" onClick={handlePrimary}>
                    <Smartphone className="h-4 w-4" />
                    Set backend URL
                  </Button>
                  {guide.showDemoOption ? (
                    <Button variant="ghost" size="lg" onClick={handleEnableMock}>
                      <Sparkles className="h-4 w-4" />
                      Try demo mode
                    </Button>
                  ) : null}
                </>
              ) : (
                <>
                  <Button size="lg" onClick={handlePrimary} disabled={connectState.status === "loading"}>
                    {isConnected ? <ArrowRight className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                    {isConnected ? "Open dashboard" : connectState.status === "loading" ? "Connecting..." : "Connect to Vector"}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => void scanForRobots()} disabled={scanState.status === "loading"}>
                    <Search className="h-4 w-4" />
                    {scanState.status === "loading" ? "Scanning..." : "Scan network"}
                  </Button>
                  {guide.showQuickRepair ? (
                    <Button variant="outline" size="lg" onClick={quickRepair} disabled={supportState.status === "loading"}>
                      <ShieldAlert className="h-4 w-4" />
                      {supportState.status === "loading" ? "Trying quick repair..." : "Quick repair"}
                    </Button>
                  ) : null}
                  {guide.showDemoOption ? (
                    <Button variant="ghost" size="lg" onClick={handleEnableMock}>
                      <Sparkles className="h-4 w-4" />
                      Try demo mode
                    </Button>
                  ) : null}
                  <Link to="/pairing">
                    <Button variant="ghost" size="lg">
                      Pair or switch robot
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold">{guide.nextTitle}</div>
              <p className="mt-2 text-sm text-muted-foreground">{guide.nextDetail}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:hidden">
          <StartupDrawerSection
            title="Checklist"
            description={`${completedChecklistCount} of ${guide.checklist.length} startup checks are ready.`}
          >
            <div className="space-y-2">
              {guide.checklist.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${item.done ? "text-emerald-300" : "text-muted-foreground/70"}`} />
                  <div>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </StartupDrawerSection>

          <StartupDrawerSection
            title="Setup and pairing"
            description={wirePodSetup?.initialSetupComplete ? "Local setup is ready." : "Finish local setup and pairing from here."}
            defaultOpen
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm font-semibold">{setupTitle}</div>
                <p className="mt-1 text-sm text-muted-foreground">{setupDescription}</p>
              </div>

              <div className="space-y-2">
                {guide.firstRunSteps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="text-sm text-muted-foreground">{step}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void handleFinishLocalSetup()}
                  disabled={!integration.wirePodReachable || setupLoading || settings.mockMode}
                >
                  <RefreshCw className="h-4 w-4" />
                  {setupLoading
                    ? "Finishing..."
                    : wirePodSetup?.initialSetupComplete
                      ? "Re-apply defaults"
                      : "Finish local setup"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleOpenRobotPairingPortal}
                  disabled={!integration.wirePodReachable || settings.mockMode}
                >
                  <ArrowRight className="h-4 w-4" />
                  Open pairing portal
                </Button>
              </div>

              <div className="rounded-2xl border border-dashed border-white/10 p-3 text-sm text-muted-foreground">
                {pairingHint}
              </div>
              {mobileRuntimeNeedsBackend ? (
                <div className="rounded-2xl border border-dashed border-sky-400/20 bg-sky-400/6 p-3 text-sm text-muted-foreground">
                  Save the desktop backend URL in Settings first. The pairing tools only work after the phone can reach your LAN backend.
                </div>
              ) : null}
            </div>
          </StartupDrawerSection>

          <StartupDrawerSection
            title="Modes and saved target"
            description={savedTarget ? `${savedTarget.name} is ready to reconnect.` : "Choose between real mode, demo mode, and your last saved robot."}
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm font-semibold">Real robot mode</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use this when you want the app to control your actual Vector through the local bridge.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm font-semibold">{guide.modeLabel}</div>
                <p className="mt-1 text-sm text-muted-foreground">{guide.modeDetail}</p>
              </div>

              {savedTarget ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="font-semibold">{savedTarget.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Serial {savedTarget.serial || "Not saved"} - {savedTarget.ipAddress}
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    Last paired {formatRelativeTime(savedTarget.lastPairedAt)}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                  No saved robot target yet. Scan once or open pairing to save one.
                </div>
              )}
            </div>
          </StartupDrawerSection>

          <StartupDrawerSection
            title="Found on this network"
            description={topCandidates.length ? "Tap a robot to save it as the startup target." : "Scan the network to refresh this list."}
          >
            <div className="space-y-2">
              {topCandidates.length ? (
                topCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="w-full rounded-2xl border border-white/10 bg-black/10 p-3 text-left transition hover:border-primary/30"
                    onClick={() => void updateSettings({ robotSerial: candidate.serial || "" })}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{candidate.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Serial {candidate.serial || "Unknown"} - {candidate.ipAddress}
                        </div>
                      </div>
                      <Badge>{candidate.signalStrength}%</Badge>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                  No scanned robots yet. Use Scan network to refresh this list.
                </div>
              )}
            </div>
          </StartupDrawerSection>
        </div>

        <div className="hidden gap-4 md:grid">
          <Card>
            <CardHeader>
              <CardTitle>Connection checklist</CardTitle>
              <CardDescription>This startup screen now guides the whole first-run flow more clearly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {guide.checklist.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mt-0.5">
                    <CheckCircle2 className={`h-4 w-4 ${item.done ? "text-emerald-300" : "text-muted-foreground/70"}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Real mode vs mock mode</CardTitle>
              <CardDescription>{guide.modeDetail}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold">Real robot mode</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use this when you want the app to control your actual Vector through the local WirePod bridge.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold">{guide.modeLabel}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Mock mode is a safe fallback for learning the app when your real robot stack is not ready yet.
                </p>
              </div>
            </CardContent>
          </Card>

          <StartupSetupCard
            setup={wirePodSetup}
            wirePodReachable={integration.wirePodReachable}
            mockMode={settings.mockMode}
            mobileRuntimeNeedsBackend={mobileRuntimeNeedsBackend}
            loading={setupLoading}
            onFinishSetup={() => void handleFinishLocalSetup()}
            onOpenPairingPortal={handleOpenRobotPairingPortal}
          />

          <Card>
            <CardHeader>
              <CardTitle>First-time setup</CardTitle>
              <CardDescription>Normal users should be able to follow these steps without guessing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {guide.firstRunSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className="text-sm text-muted-foreground">{step}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved target</CardTitle>
              <CardDescription>The startup screen reconnects to the last saved robot first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {savedTarget ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="font-semibold">{savedTarget.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Serial {savedTarget.serial || "Not saved"} - {savedTarget.ipAddress}
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    Last paired {formatRelativeTime(savedTarget.lastPairedAt)}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                  No saved robot target yet. Scan once or open pairing to save one.
                </div>
              )}

              <details className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                  Found on this network
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </summary>

                <div className="mt-4 space-y-3">
                  {topCandidates.length ? (
                    topCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className="w-full rounded-2xl border border-white/10 bg-black/10 p-4 text-left transition hover:border-primary/30"
                        onClick={() => void updateSettings({ robotSerial: candidate.serial || "" })}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold">{candidate.name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Serial {candidate.serial || "Unknown"} - {candidate.ipAddress}
                            </div>
                          </div>
                          <Badge>{candidate.signalStrength}% signal</Badge>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                      No scanned robots yet. Use Scan network to refresh this list.
                    </div>
                  )}
                </div>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface StartupDrawerSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function StartupDrawerSection({ title, description, children, defaultOpen = false }: StartupDrawerSectionProps) {
  return (
    <details open={defaultOpen} className="group rounded-3xl border border-white/10 bg-white/[0.03]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-white/10 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
