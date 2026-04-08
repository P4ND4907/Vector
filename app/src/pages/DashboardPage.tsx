import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BadgeDollarSign,
  BatteryCharging,
  BrainCircuit,
  ChevronRight,
  Dock,
  Gamepad2,
  Info,
  Mic,
  RefreshCw,
  ShieldCheck,
  Wifi
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BridgeWatchdogCard } from "@/components/connection/BridgeWatchdogCard";
import { ConnectionDoctorCard } from "@/components/connection/ConnectionDoctorCard";
import { getChargingProtectionMessage, isChargingProtectionActive } from "@/lib/charging-protection";
import { buildConnectionDoctor, type ConnectionDoctorActionId } from "@/lib/connection-doctor";
import { formatRelativeTime, formatTimestamp, moodLabel } from "@/lib/format";
import { deriveAppHealthState, healthToneClassName } from "@/lib/health-state";
import { getBatteryState, getBrainStatusLabel, getSystemStatusDisplay, logStatusTone } from "@/lib/robot-state";
import { buildUsageLoopSnapshot } from "@/lib/usage-loop";
import { aiService } from "@/services/aiService";
import { robotService } from "@/services/robotService";
import { useAppStore } from "@/store/useAppStore";
import type { BridgeWatchdogStatus } from "@/types";

const statusTone: Record<string, string> = {
  ready: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  charging: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  docked: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  busy: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  offline: "border-red-400/30 bg-red-400/10 text-red-100",
  error: "border-red-400/30 bg-red-400/10 text-red-100"
};

export function DashboardPage() {
  const navigate = useNavigate();
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const settings = useAppStore((state) => state.settings);
  const routines = useAppStore((state) => state.routines);
  const logs = useAppStore((state) => state.logs);
  const aiCommandHistory = useAppStore((state) => state.aiCommandHistory);
  const savedProfiles = useAppStore((state) => state.savedProfiles);
  const availableRobots = useAppStore((state) => state.availableRobots);
  const connectRobot = useAppStore((state) => state.connectRobot);
  const wakeRobot = useAppStore((state) => state.wakeRobot);
  const toggleMute = useAppStore((state) => state.toggleMute);
  const returnToDock = useAppStore((state) => state.returnToDock);
  const runDiagnostics = useAppStore((state) => state.runDiagnostics);
  const quickRepair = useAppStore((state) => state.quickRepair);
  const scanForRobots = useAppStore((state) => state.scanForRobots);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const runRoutineNow = useAppStore((state) => state.runRoutineNow);
  const connectState = useAppStore((state) => state.actionStates.connect);
  const [watchdog, setWatchdog] = useState<BridgeWatchdogStatus | undefined>(undefined);
  const [watchdogLoading, setWatchdogLoading] = useState(true);
  const [learnedCommandCount, setLearnedCommandCount] = useState(0);
  const [commandGapCount, setCommandGapCount] = useState(0);

  const latestLogs = useMemo(() => logs.slice(0, 3), [logs]);
  const enabledRoutines = useMemo(() => routines.filter((routine) => routine.enabled).slice(0, 3), [routines]);
  const batteryState = getBatteryState(robot);
  const systemStatus = getSystemStatusDisplay(robot.systemStatus);
  const brainStatus = getBrainStatusLabel(integration);
  const robotOnline = robot.isConnected && integration.robotReachable;
  const healthState = useMemo(
    () => deriveAppHealthState({ robot, integration, watchdog }),
    [integration, robot, watchdog]
  );
  const usageLoop = useMemo(
    () =>
      buildUsageLoopSnapshot({
        aiHistory: aiCommandHistory,
        logs,
        learnedCommandCount,
        commandGapCount,
        planAccess: settings.planAccess
      }),
    [aiCommandHistory, commandGapCount, learnedCommandCount, logs, settings.planAccess]
  );
  const doctorGuide = useMemo(
    () =>
      buildConnectionDoctor({
        robot,
        integration,
        settings,
        savedProfile: savedProfiles[0],
        availableRobots
      }),
    [availableRobots, integration, robot, savedProfiles, settings]
  );
  const chargingProtectionActive = isChargingProtectionActive(settings, robot);
  const quickPromptActions = useMemo(
    () =>
      healthState.id === "ready"
        ? [
            {
              label: "Morning hello",
              prompt: "good morning",
              detail: "Start with a warm greeting."
            },
            {
              label: "Battery check",
              prompt: "check battery",
              detail: "Make sure the charger habit is holding."
            },
            {
              label: "Tiny fun break",
              prompt: "tell me a joke",
              detail: "A fast delight moment without a long routine."
            }
          ]
        : [
            {
              label: "Reconnect check",
              prompt: "check battery",
              detail: "See whether Vector is awake enough to answer."
            },
            {
              label: "Dock safely",
              prompt: "go dock",
              detail: "Send Vector home once the link is stable."
            },
            {
              label: "Teach a phrase",
              prompt: "learn that coin toss means flip a coin",
              detail: "Make the app feel more personal."
            }
          ],
    [healthState.id]
  );
  const bannerMessage =
    connectState.message ||
    (chargingProtectionActive ? getChargingProtectionMessage() : healthState.detail) ||
    integration.note ||
    "If the local bridge restarts, the dashboard will retry and keep the error plain-English.";
  const primaryAction =
    healthState.id === "ready"
      ? {
          label: "Open controls",
          run: () => navigate("/drive")
        }
      : healthState.id === "robot-asleep"
        ? {
            label: "Wake and reconnect",
            run: async () => {
              await wakeRobot();
              await connectRobot();
            }
          }
        : {
            label: "Auto-recover bridge",
            run: async () => {
              await quickRepair();
            }
          };
  const recoverySteps = useMemo(() => {
    if (healthState.id === "bridge-down") {
      return [
        "Let the app start or recover the local bridge first.",
        "Give the bridge a moment to expose healthy robot routes.",
        "Open Diagnostics if the bridge still does not answer."
      ];
    }

    if (healthState.id === "sdk-flapping") {
      return [
        "Run the bridge auto-recover path to refresh the live SDK session.",
        "Keep Vector on stable power while the session settles.",
        "If flapping returns, open Diagnostics to inspect the latest watchdog evidence."
      ];
    }

    if (healthState.id === "robot-asleep") {
      return [
        "Wake Vector on stable power or from the charger.",
        "Retry the robot link once the robot reacts again.",
        "Use Diagnostics if the routes stay quiet after wake."
      ];
    }

    return [
      "The bridge and robot look stable right now.",
      "Use controls, speech, or AI commands from this dashboard.",
      "Open Diagnostics whenever you want a quick confidence check."
    ];
  }, [healthState.id]);

  useEffect(() => {
    let cancelled = false;

    const loadWatchdog = async () => {
      setWatchdogLoading(true);
      try {
        const nextWatchdog = await robotService.getBridgeWatchdog(useAppStore.getState());
        if (!cancelled) {
          setWatchdog(nextWatchdog);
        }
      } catch {
        if (!cancelled) {
          setWatchdog(undefined);
        }
      } finally {
        if (!cancelled) {
          setWatchdogLoading(false);
        }
      }
    };

    void loadWatchdog();
    return () => {
      cancelled = true;
    };
  }, [integration.lastCheckedAt, integration.robotReachable, integration.wirePodReachable, connectState.status]);

  useEffect(() => {
    let cancelled = false;

    const loadUsageSignals = async () => {
      try {
        const [learnedCommands, commandGaps] = await Promise.all([
          aiService.getLearnedCommands(),
          aiService.getCommandGaps()
        ]);

        if (!cancelled) {
          setLearnedCommandCount(learnedCommands.items.length);
          setCommandGapCount(commandGaps.items.length);
        }
      } catch {
        if (!cancelled) {
          setLearnedCommandCount(0);
          setCommandGapCount(0);
        }
      }
    };

    void loadUsageSignals();
    return () => {
      cancelled = true;
    };
  }, [logs.length, aiCommandHistory.length]);

  const handleDoctorAction = async (actionId: ConnectionDoctorActionId) => {
    switch (actionId) {
      case "open-dashboard":
        navigate("/dashboard");
        return;
      case "open-settings":
        navigate("/settings");
        return;
      case "retry-connection":
        await connectRobot();
        return;
      case "run-quick-repair":
        await quickRepair();
        return;
      case "run-diagnostics":
        await runDiagnostics();
        return;
      case "open-pairing":
        navigate("/pairing");
        return;
      case "open-new-robot":
        navigate("/setup/new-robot");
        return;
      case "disable-mock":
        await updateSettings({ mockMode: false });
        return;
      case "scan-network":
        await scanForRobots();
        return;
      case "finish-local-setup":
        navigate("/startup");
        return;
      default:
        return;
    }
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <div className="grid gap-4">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-6 p-6 xl:p-7 2xl:grid-cols-[minmax(0,1.16fr)_minmax(300px,0.84fr)]">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="eyebrow">Main dashboard</div>
                <h2 className="text-3xl font-semibold">Your Vector control center.</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  See what is online, what needs attention, and what to do next without digging through backend tools.
                </p>
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-sm text-muted-foreground">Status snapshot</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge className={healthToneClassName[healthState.tone]}>{healthState.badgeLabel}</Badge>
                    <Badge className={statusTone[systemStatus.toneKey]}>{systemStatus.label}</Badge>
                    <Badge className={batteryState.badgeClassName}>{batteryState.label}</Badge>
                    <Badge>{brainStatus}</Badge>
                  </div>
                  <dl className="mt-5 grid gap-3 text-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-3">
                      <dt className="text-muted-foreground">Robot mood</dt>
                      <dd className="font-medium">{robotOnline ? moodLabel[robot.mood] : "Sleeping"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-3">
                      <dt className="text-muted-foreground">Last contact</dt>
                      <dd className="font-medium">{formatRelativeTime(robot.lastSeen)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Current activity</dt>
                      <dd className="max-w-[16rem] text-right font-medium">{robot.currentActivity}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-sm text-muted-foreground">What to do next</div>
                  <div className="mt-3 text-xl font-semibold">{healthState.summary}</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {healthState.detail}
                  </p>

                  <div className="mt-5 space-y-3">
                    {recoverySteps.map((step, index) => (
                      <div key={step} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </div>
                        <p className="text-sm text-muted-foreground">{step}</p>
                      </div>
                    ))}
                  </div>

                  <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                      Connection details
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </summary>
                    <dl className="mt-4 grid gap-3 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-3">
                        <dt>Selected robot</dt>
                        <dd className="font-medium text-foreground">{integration.selectedSerial || robot.serial || "Not set"}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-3">
                        <dt>Local bridge</dt>
                        <dd className="max-w-[14rem] break-all text-right font-medium text-foreground">{integration.wirePodBaseUrl}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-b border-white/6 pb-3">
                        <dt>Connection source</dt>
                        <dd className="font-medium text-foreground capitalize">{integration.source}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt>Last check</dt>
                        <dd className="font-medium text-foreground">{formatTimestamp(integration.lastCheckedAt)}</dd>
                      </div>
                    </dl>
                  </details>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Button className="sm:col-span-2 xl:col-span-4" size="lg" onClick={() => void primaryAction.run()}>
                  <RefreshCw className="h-4 w-4" />
                  {primaryAction.label}
                </Button>
                <Link to="/drive">
                  <Button className="w-full" variant="outline">
                    <Gamepad2 className="h-4 w-4" />
                    Open controls
                  </Button>
                </Link>
                <Link to="/speech">
                  <Button className="w-full" variant="outline">
                    <Mic className="h-4 w-4" />
                    Speak
                  </Button>
                </Link>
                <Link to="/ai">
                  <Button className="w-full" variant="outline">
                    <BrainCircuit className="h-4 w-4" />
                    AI commands
                  </Button>
                </Link>
                <Button className="sm:col-span-2 xl:col-span-1" variant="ghost" onClick={runDiagnostics}>
                  <ShieldCheck className="h-4 w-4" />
                  Diagnostics
                </Button>
              </div>

              <div className="rounded-3xl border border-amber-300/18 bg-amber-300/8 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-100/80">
                  <Info className="h-3.5 w-3.5" />
                  Live notice
                </div>
                <p className="mt-2 text-sm text-amber-50/90">{bannerMessage}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={wakeRobot} disabled={chargingProtectionActive}>
                    Wake robot
                  </Button>
                  <Button size="sm" variant="ghost" onClick={returnToDock} disabled={robot.isDocked}>
                    <Dock className="h-4 w-4" />
                    {robot.isDocked ? "Already docked" : "Send to charger"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={toggleMute}>
                    {robot.isMuted ? "Unmute audio" : "Mute audio"}
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-primary/20 bg-primary/[0.06] p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-primary/80">
                  <BadgeDollarSign className="h-3.5 w-3.5" />
                  Keep momentum
                </div>
                <div className="mt-2 text-lg font-semibold text-foreground">{usageLoop.headline}</div>
                <p className="mt-2 text-sm text-muted-foreground">{usageLoop.summary}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recent wins</div>
                    <div className="mt-2 text-2xl font-semibold">{usageLoop.recentWins}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Taught phrases</div>
                    <div className="mt-2 text-2xl font-semibold">{usageLoop.taughtPhrases}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fun moments</div>
                    <div className="mt-2 text-2xl font-semibold">{usageLoop.funMoments}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Streak</div>
                    <div className="mt-2 text-2xl font-semibold">{usageLoop.streakDays}</div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
                  {usageLoop.nextMove}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {quickPromptActions.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="rounded-2xl border border-white/10 bg-black/10 p-3 text-left transition hover:border-primary/30"
                      onClick={() => navigate("/ai", { state: { starterPrompt: item.prompt } })}
                    >
                      <div className="font-semibold text-foreground">{item.label}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{item.detail}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => navigate("/ai", { state: { starterPrompt: "learn that movie time means play blackjack" } })}>
                    Teach a phrase
                  </Button>
                  <Link to="/upgrade">
                    <Button>See Pro extras</Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div>
                <div className="eyebrow">Connection details</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className={healthToneClassName[healthState.tone]}>{healthState.badgeLabel}</Badge>
                  <Badge>{brainStatus}</Badge>
                  <Badge>{integration.selectedSerial || robot.serial || "No serial yet"}</Badge>
                  <Badge>{systemStatus.label}</Badge>
                </div>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Robot name</span>
                  <span className="text-foreground">{robot.nickname ?? robot.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Local bridge</span>
                  <span className="text-foreground">{integration.wirePodReachable ? "Detected" : "Unavailable"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Battery state</span>
                  <span className="text-foreground">{batteryState.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Volume</span>
                  <span className="text-foreground">{robot.volume}/5</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Connection source</span>
                  <span className="text-foreground capitalize">{integration.source}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last check</span>
                  <span className="text-right text-foreground">{formatTimestamp(integration.lastCheckedAt)}</span>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                {integration.note || "No integration note yet."}
              </div>

              <Link to="/upgrade" className="block">
                <div className="rounded-3xl border border-emerald-300/18 bg-emerald-300/8 p-4 transition-colors hover:bg-emerald-300/10">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BadgeDollarSign className="h-4 w-4 text-primary" />
                    Revenue plan
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Open the pricing, checkout, and support plan so this project can start earning instead of just shipping features.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-sm font-medium text-primary">
                    Open Upgrade
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:hidden">
          <ConnectionDoctorCard guide={doctorGuide} onAction={handleDoctorAction} compact />
          <BridgeWatchdogCard
            watchdog={watchdog}
            loading={watchdogLoading}
            compact
            onRecover={() => void quickRepair()}
            onRetry={() => void connectRobot()}
          />

          <MobileDashboardSection
            title="Ready routines"
            description={enabledRoutines.length ? "Run the routines that are already enabled." : "No enabled routines yet."}
          >
            <div className="space-y-3">
              {enabledRoutines.length ? (
                enabledRoutines.map((routine) => (
                  <div key={routine.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{routine.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {routine.triggerType} at {routine.triggerValue}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => runRoutineNow(routine.id)}>
                        Run now
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                  No enabled routines yet. Save one in the Routines page.
                </div>
              )}
            </div>
          </MobileDashboardSection>

          <MobileDashboardSection
            title="Connection health"
            description="See whether the local bridge or the robot link is the blocker."
          >
            <div className="grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Wifi className="h-4 w-4 text-primary" />
                  Local bridge
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {integration.wirePodReachable
                    ? "The local bridge is reachable from the backend."
                    : "The app could not reach the saved local bridge endpoint."}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <BatteryCharging className="h-4 w-4 text-primary" />
                  Robot link
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {integration.robotReachable
                    ? "Vector is answering live status checks."
                    : "The local bridge may be up, but the robot itself is not responding yet."}
                </p>
              </div>
            </div>
          </MobileDashboardSection>

          <MobileDashboardSection
            title="Latest backend activity"
            description={latestLogs.length ? "Recent commands stay visible in plain English." : "No backend activity yet."}
          >
            <div className="space-y-3">
              {latestLogs.length ? (
                latestLogs.map((log) => (
                  <div key={log.id} className={`rounded-3xl border p-4 ${logStatusTone[log.status]}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold capitalize">{log.type}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {formatTimestamp(log.createdAt)}
                        </div>
                      </div>
                      <Badge>{log.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{log.resultMessage}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                  No backend activity yet. The first command you run will show up here.
                </div>
              )}
            </div>
          </MobileDashboardSection>
        </div>
      </div>

      <div className="hidden gap-4 md:grid">
        <ConnectionDoctorCard guide={doctorGuide} onAction={handleDoctorAction} />
        <BridgeWatchdogCard
          watchdog={watchdog}
          loading={watchdogLoading}
          onRecover={() => void quickRepair()}
          onRetry={() => void connectRobot()}
        />

        <Card>
          <CardHeader>
            <CardTitle>Ready routines</CardTitle>
            <CardDescription>Run the routines that are already enabled without leaving the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {enabledRoutines.length ? (
              enabledRoutines.map((routine) => (
                <div key={routine.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{routine.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {routine.triggerType} at {routine.triggerValue}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => runRoutineNow(routine.id)}>
                      Run now
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                No enabled routines yet. Save one in the Routines page.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connection health</CardTitle>
            <CardDescription>See whether the local bridge or the robot is the current blocker.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wifi className="h-4 w-4 text-primary" />
                Local bridge
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {integration.wirePodReachable
                  ? "The local bridge is reachable from the backend."
                  : "The app could not reach the saved local bridge endpoint."}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BatteryCharging className="h-4 w-4 text-primary" />
                Robot link
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {integration.robotReachable
                  ? "Vector is answering live status checks."
                  : "The local bridge may be up, but the robot itself is not responding yet."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest backend activity</CardTitle>
            <CardDescription>Recent commands stay visible in plain English.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestLogs.length ? (
              latestLogs.map((log) => (
                <div key={log.id} className={`rounded-3xl border p-4 ${logStatusTone[log.status]}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold capitalize">{log.type}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {formatTimestamp(log.createdAt)}
                      </div>
                    </div>
                    <Badge>{log.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{log.resultMessage}</p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                No backend activity yet. The first command you run will show up here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MobileDashboardSection({
  title,
  description,
  children,
  defaultOpen = false
}: {
  title: string;
  description: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
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
