import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Mic,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Unplug,
  Wrench,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BridgeWatchdogCard } from "@/components/connection/BridgeWatchdogCard";
import { ConnectionDoctorCard } from "@/components/connection/ConnectionDoctorCard";
import { buildConnectionDoctor, type ConnectionDoctorActionId } from "@/lib/connection-doctor";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { deriveAppHealthState, healthToneClassName } from "@/lib/health-state";
import {
  getBatteryState,
  getBrainStatusLabel,
  getSystemStatusDisplay,
  logStatusTone
} from "@/lib/robot-state";
import { robotService } from "@/services/robotService";
import { useAppStore } from "@/store/useAppStore";
import type { BridgeWatchdogStatus, DiagnosticCheckStatus, DiagnosticOverallStatus } from "@/types";

const overallTone: Record<DiagnosticOverallStatus, string> = {
  healthy: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  attention: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  critical: "border-red-400/30 bg-red-400/10 text-red-100"
};

const checkTone: Record<DiagnosticCheckStatus, string> = {
  pass: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  fail: "border-red-400/30 bg-red-400/10 text-red-100"
};

const repairStepTone: Record<"success" | "warn" | "fail", string> = {
  success: checkTone.pass,
  warn: checkTone.warn,
  fail: checkTone.fail
};

export function DiagnosticsPage() {
  const navigate = useNavigate();
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const logs = useAppStore((state) => state.logs);
  const diagnosticReports = useAppStore((state) => state.diagnosticReports);
  const supportReports = useAppStore((state) => state.supportReports);
  const settings = useAppStore((state) => state.settings);
  const savedProfiles = useAppStore((state) => state.savedProfiles);
  const availableRobots = useAppStore((state) => state.availableRobots);
  const diagnosticsState = useAppStore((state) => state.actionStates.diagnostics);
  const voiceState = useAppStore((state) => state.actionStates.voice);
  const supportState = useAppStore((state) => state.actionStates.support);
  const connectRobot = useAppStore((state) => state.connectRobot);
  const disconnectRobot = useAppStore((state) => state.disconnectRobot);
  const runDiagnostics = useAppStore((state) => state.runDiagnostics);
  const quickRepair = useAppStore((state) => state.quickRepair);
  const repairVoiceSetup = useAppStore((state) => state.repairVoiceSetup);
  const wakeRobot = useAppStore((state) => state.wakeRobot);
  const scanForRobots = useAppStore((state) => state.scanForRobots);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const clearRobot = useAppStore((state) => state.clearRobot);
  const resetSettings = useAppStore((state) => state.resetSettings);
  const switchEngineProvider = useAppStore((state) => state.switchEngineProvider);
  const [watchdog, setWatchdog] = useState<BridgeWatchdogStatus | undefined>(undefined);
  const [watchdogLoading, setWatchdogLoading] = useState(true);
  const [repairNote, setRepairNote] = useState<string>();
  const [repairLoading, setRepairLoading] = useState<string | null>(null);

  const latestReport = diagnosticReports[0];
  const latestSupportReport = supportReports[0];
  const latestSuccessfulCommand = useMemo(() => logs.find((log) => log.status === "success"), [logs]);
  const latestFailedCommand = useMemo(() => logs.find((log) => log.status === "error"), [logs]);
  const batteryState = getBatteryState(robot);
  const systemStatus = getSystemStatusDisplay(robot.systemStatus);
  const brainStatus = getBrainStatusLabel(integration);
  const healthState = useMemo(
    () => deriveAppHealthState({ robot, integration, watchdog }),
    [integration, robot, watchdog]
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
  const overallStatus: DiagnosticOverallStatus =
    latestReport?.overallStatus ??
    (integration.robotReachable ? "healthy" : integration.wirePodReachable ? "attention" : "critical");

  const troubleshooting = useMemo(() => {
    const items = new Set<string>();

    if (integration.note) {
      items.add(integration.note);
    }

    if (!integration.wirePodReachable) {
      items.add("The app cannot reach the local bridge right now.");
    } else if (!integration.robotReachable) {
      items.add("The local bridge is awake, but Vector is not answering local status checks yet.");
    }

    latestReport?.troubleshooting?.forEach((item) => items.add(item));
    return Array.from(items);
  }, [integration, latestReport]);

  const voiceChecks = useMemo(
    () =>
      latestReport?.checks.filter(
        (check) =>
          check.label === "Wake word" ||
          check.label === "Speech locale" ||
          check.label === "Speaker volume" ||
          check.label === "Voice pipeline"
      ) ?? [],
    [latestReport]
  );
  const wakeWordCheck = voiceChecks.find((check) => check.label === "Wake word");
  const localeCheck = voiceChecks.find((check) => check.label === "Speech locale");
  const volumeCheck = voiceChecks.find((check) => check.label === "Speaker volume");
  const pipelineCheck = voiceChecks.find((check) => check.label === "Voice pipeline");

  const recoverySteps = useMemo(() => {
    if (healthState.id === "bridge-down") {
      return [
        "Auto-recover the local bridge first.",
        "Wait for the bridge probes to go healthy again.",
        "Open advanced connection details if the bridge still stays dark."
      ];
    }

    if (healthState.id === "sdk-flapping") {
      return [
        "Run the watchdog recovery path to settle the SDK session.",
        "Keep Vector on stable power while the session refreshes.",
        "If flapping keeps returning, use the recent watchdog evidence below."
      ];
    }

    if (healthState.id === "robot-asleep") {
      return [
        "Place Vector on the charger so the robot wakes on stable power.",
        "Use Wake and reconnect to refresh the live robot link.",
        "If Vector still does not answer, run diagnostics again."
      ];
    }

    return [
      "The full Vector stack is responding normally.",
      "Run diagnostics before changing settings or reporting a bug.",
      "Use the latest report on the right to spot any early warning signs."
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
  }, [
    integration.lastCheckedAt,
    integration.robotReachable,
    integration.wirePodReachable,
    diagnosticsState.status,
    supportState.status
  ]);

  const primaryAction =
    healthState.id === "ready"
      ? {
          label: diagnosticsState.status === "loading" ? "Running diagnostics..." : "Run diagnostics",
          run: async () => {
            await runDiagnostics();
          }
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
            label: supportState.status === "loading" ? "Auto-recovering..." : "Auto-recover bridge",
            run: async () => {
              await quickRepair();
            }
          };

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
    <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
      <div className="grid gap-4">
        <ConnectionDoctorCard guide={doctorGuide} onAction={handleDoctorAction} />
        <BridgeWatchdogCard
          watchdog={watchdog}
          loading={watchdogLoading}
          onRecover={() => void quickRepair()}
          onRetry={() => void connectRobot()}
        />

        <Card>
          <CardHeader>
            <div className="eyebrow">Health check</div>
            <CardTitle>Know what is healthy, what is offline, and what to do next.</CardTitle>
            <CardDescription>
              The recovery path stays readable here so Vector problems stop feeling random.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm text-muted-foreground">Overall state</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className={healthToneClassName[healthState.tone]}>{healthState.badgeLabel}</Badge>
                  <Badge className={overallTone[overallStatus]}>{overallStatus}</Badge>
                  <Badge>{systemStatus.label}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Last checked {formatTimestamp(integration.lastCheckedAt)}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PlugZap className="h-4 w-4 text-primary" />
                  Local bridge
                </div>
                <div className="mt-2 text-lg font-semibold">{brainStatus}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {integration.wirePodReachable ? "The local bridge is answering the app backend." : "The app cannot reach the local bridge right now."}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bot className="h-4 w-4 text-primary" />
                  Robot link
                </div>
                <div className="mt-2 text-lg font-semibold">{integration.robotReachable ? "Online" : "Needs attention"}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {integration.robotReachable
                    ? `Last seen ${formatRelativeTime(robot.lastSeen)}.`
                    : `${robot.nickname ?? robot.name} is currently offline.`}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-amber-300/18 bg-amber-300/8 p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-100/80">
                <ShieldCheck className="h-3.5 w-3.5" />
                Recovery path
              </div>
              <div className="mt-3 grid gap-3">
                {recoverySteps.map((step, index) => (
                  <div key={step} className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-amber-50">
                      {index + 1}
                    </div>
                    <p className="text-sm text-amber-50/90">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void primaryAction.run()} disabled={diagnosticsState.status === "loading" || supportState.status === "loading"}>
                <ShieldCheck className="h-4 w-4" />
                {primaryAction.label}
              </Button>
              {healthState.id !== "ready" ? (
                <Button variant="outline" onClick={runDiagnostics} disabled={diagnosticsState.status === "loading"}>
                  <Activity className="h-4 w-4" />
                  Run diagnostics
                </Button>
              ) : null}
              {healthState.id !== "sdk-flapping" && healthState.id !== "bridge-down" ? (
                <Button variant="outline" onClick={quickRepair} disabled={supportState.status === "loading"}>
                  <RefreshCw className="h-4 w-4" />
                  Quick repair
                </Button>
              ) : null}
              {healthState.id !== "robot-asleep" ? (
                <Button variant="outline" onClick={connectRobot}>
                  <RefreshCw className="h-4 w-4" />
                  Retry connection
                </Button>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground">
              {supportState.message ||
                diagnosticsState.message ||
                integration.note ||
                "Diagnostics results and command history stay stored locally."}
            </p>

            <details className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                Advanced connection details
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </summary>

              <div className="mt-4 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Endpoint</div>
                    <div className="mt-2 font-semibold">{integration.wirePodBaseUrl}</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/10 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Selected serial</div>
                    <div className="mt-2 font-semibold">{integration.selectedSerial || robot.serial || "Not set"}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {integration.probes.length ? (
                    integration.probes.map((probe) => (
                      <div key={`${probe.source}-${probe.endpoint}`} className="rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold">{probe.endpoint}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{probe.source}</div>
                          </div>
                          <Badge className={probe.ok ? checkTone.pass : checkTone.fail}>{probe.ok ? "reachable" : "failed"}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {typeof probe.latencyMs === "number" ? `${probe.latencyMs} ms` : "No latency recorded"}
                        </p>
                        {probe.error ? <p className="mt-2 text-sm text-muted-foreground">{probe.error}</p> : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                      No endpoint probes have been recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice and wake word</CardTitle>
            <CardDescription>
              Keep Hey Vector reliable without opening the bridge UI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Mic className="h-4 w-4 text-primary" />
                {pipelineCheck?.details || "Run diagnostics to inspect the current Hey Vector path."}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                The refresh action re-applies the voice defaults the local bridge exposes: Hey Vector button mode, English (US), and a safe speaker volume.
              </p>
            </div>

            {voiceChecks.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[wakeWordCheck, localeCheck, volumeCheck, pipelineCheck]
                  .filter((check): check is NonNullable<typeof check> => Boolean(check))
                  .map((check) => (
                    <div key={check.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{check.label}</div>
                        <Badge className={checkTone[check.status]}>{check.status}</Badge>
                      </div>
                      <div className="mt-2 text-lg font-semibold">{check.metric}</div>
                      <p className="mt-2 text-sm text-muted-foreground">{check.details}</p>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                Run diagnostics once to capture the current wake word, locale, speaker volume, and latest voice result.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={repairVoiceSetup} disabled={voiceState.status === "loading"}>
                <Mic className="h-4 w-4" />
                {voiceState.status === "loading" ? "Refreshing voice defaults..." : "Refresh voice defaults"}
              </Button>
              <Button variant="outline" onClick={runDiagnostics}>
                <Activity className="h-4 w-4" />
                Run diagnostics again
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {voiceState.message ||
                pipelineCheck?.details ||
                "After repair, test with a full phrase like 'Hey Vector, what time is it?'."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Repair tools
            </CardTitle>
            <CardDescription>
              All repair actions in one place. Each action is safe to run without losing saved robot data unless you explicitly clear or reset.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {repairNote && (
              <div className="rounded-2xl border border-sky-400/20 bg-sky-400/8 p-3 text-sm text-sky-100">
                {repairNote}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {/* 1. Refresh health */}
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={async () => {
                  setRepairLoading("health");
                  try { await runDiagnostics(); setRepairNote("Health refreshed. See the diagnostics results below."); }
                  catch (error) { setRepairNote(`Health refresh failed: ${error instanceof Error ? error.message : "Unknown error."}`); }
                  finally { setRepairLoading(null); }
                }}
                disabled={repairLoading === "health" || diagnosticsState.status === "loading"}
              >
                <Activity className="h-4 w-4" />
                {repairLoading === "health" ? "Refreshing…" : "Refresh health"}
              </Button>

              {/* 2. Scan again */}
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={async () => {
                  setRepairLoading("scan");
                  try { await scanForRobots(); setRepairNote("Scan complete. Check the available robots list."); }
                  catch (error) { setRepairNote(`Scan failed: ${error instanceof Error ? error.message : "Ensure the local bridge is reachable."}`); }
                  finally { setRepairLoading(null); }
                }}
                disabled={repairLoading === "scan"}
              >
                <Search className="h-4 w-4" />
                {repairLoading === "scan" ? "Scanning…" : "Scan again"}
              </Button>

              {/* 3. Reconnect */}
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={async () => {
                  setRepairLoading("reconnect");
                  try { await connectRobot(); setRepairNote("Reconnect attempted. Check the status badge above."); }
                  catch (error) { setRepairNote(`Reconnect failed: ${error instanceof Error ? error.message : "Unknown error."}`); }
                  finally { setRepairLoading(null); }
                }}
                disabled={repairLoading === "reconnect"}
              >
                <RefreshCw className="h-4 w-4" />
                {repairLoading === "reconnect" ? "Reconnecting…" : "Reconnect"}
              </Button>

              {/* 4. Disconnect */}
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={async () => {
                  setRepairLoading("disconnect");
                  try { await disconnectRobot(); setRepairNote("Disconnected from the robot."); }
                  catch (error) { setRepairNote(`Disconnect failed: ${error instanceof Error ? error.message : "Unknown error."}`); }
                  finally { setRepairLoading(null); }
                }}
                disabled={repairLoading === "disconnect"}
              >
                <Unplug className="h-4 w-4" />
                {repairLoading === "disconnect" ? "Disconnecting…" : "Disconnect"}
              </Button>

              {/* 5. Clear robot */}
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={async () => {
                  setRepairLoading("clear");
                  try { await clearRobot(); setRepairNote("Robot target cleared. Re-scan or re-pair to reconnect."); }
                  catch (error) { setRepairNote(`Clear robot failed: ${error instanceof Error ? error.message : "Unknown error."}`); }
                  finally { setRepairLoading(null); }
                }}
                disabled={repairLoading === "clear"}
              >
                <X className="h-4 w-4" />
                {repairLoading === "clear" ? "Clearing…" : "Clear robot"}
              </Button>

              {/* 6. Reset settings */}
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={async () => {
                  setRepairLoading("reset");
                  try { await resetSettings(); setRepairNote("Settings reset to defaults."); }
                  catch (error) { setRepairNote(`Reset settings failed: ${error instanceof Error ? error.message : "Unknown error."}`); }
                  finally { setRepairLoading(null); }
                }}
                disabled={repairLoading === "reset"}
              >
                <RotateCcw className="h-4 w-4" />
                {repairLoading === "reset" ? "Resetting…" : "Reset settings"}
              </Button>

              {/* 7. Switch provider */}
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={async () => {
                  setRepairLoading("provider");
                  try {
                    await switchEngineProvider("embedded");
                    setRepairNote("Switched to the embedded engine provider.");
                  }
                  catch (error) { setRepairNote(`Provider switch failed: ${error instanceof Error ? error.message : "Unknown error."}`); }
                  finally { setRepairLoading(null); }
                }}
                disabled={repairLoading === "provider"}
              >
                <Cpu className="h-4 w-4" />
                {repairLoading === "provider" ? "Switching…" : "Switch provider"}
              </Button>

              {/* 8. Diagnostics display */}
              <Button
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  document.getElementById("diagnostics-report")?.scrollIntoView({ behavior: "smooth" });
                  setRepairNote("Scrolled to the latest diagnostics report below.");
                }}
              >
                <ShieldCheck className="h-4 w-4" />
                Diagnostics display
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent outcomes</CardTitle>
            <CardDescription>See the last good and last failed command without digging through raw logs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestSuccessfulCommand ? (
              <div className={`rounded-3xl border p-4 ${logStatusTone.success}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Latest successful command
                </div>
                <div className="mt-2 text-sm">{latestSuccessfulCommand.type}</div>
                <p className="mt-2 text-sm text-emerald-50/90">{latestSuccessfulCommand.resultMessage}</p>
              </div>
            ) : null}

            {latestFailedCommand ? (
              <div className={`rounded-3xl border p-4 ${logStatusTone.error}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-red-100">
                  <AlertTriangle className="h-4 w-4" />
                  Latest failed command
                </div>
                <div className="mt-2 text-sm">{latestFailedCommand.type}</div>
                <p className="mt-2 text-sm text-red-50/90">{latestFailedCommand.resultMessage}</p>
              </div>
            ) : null}

            {!latestSuccessfulCommand && !latestFailedCommand ? (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                Command history will appear here after the first action runs.
              </div>
            ) : null}

            {troubleshooting.length ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current guidance</div>
                <div className="mt-3 space-y-2">
                  {troubleshooting.slice(0, 3).map((item) => (
                    <p key={item} className="text-sm text-muted-foreground">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card id="diagnostics-report">
          <CardHeader>
            <CardTitle>Latest report</CardTitle>
            <CardDescription>The most recent health report stays readable at a glance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestReport ? (
              <>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{formatTimestamp(latestReport.createdAt)}</div>
                      <p className="mt-2 text-sm text-muted-foreground">{latestReport.summary}</p>
                    </div>
                    <Badge className={overallTone[latestReport.overallStatus]}>{latestReport.overallStatus}</Badge>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                  Trusted battery view: {batteryState.label}. Exact percentages stay hidden by default because live battery readings can be rough when Vector is reconnecting.
                </div>

                {latestReport.checks.map((check) => (
                  <div key={check.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{check.label}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{check.category}</div>
                      </div>
                      <Badge className={checkTone[check.status]}>{check.status}</Badge>
                    </div>
                    <div className="mt-3 text-sm font-medium">{check.metric}</div>
                    <p className="mt-2 text-sm text-muted-foreground">{check.details}</p>
                  </div>
                ))}
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                No diagnostic report yet. Run one once the backend is up.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest quick repair</CardTitle>
            <CardDescription>The app keeps the last self-heal attempt readable in plain English.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestSupportReport ? (
              <>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{latestSupportReport.summary}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatTimestamp(latestSupportReport.createdAt)}</div>
                    </div>
                    <Badge className={overallTone[
                      latestSupportReport.repairResult.overallStatus === "repaired"
                        ? "healthy"
                        : latestSupportReport.repairResult.overallStatus === "partial"
                          ? "attention"
                          : "critical"
                    ]}>
                      {latestSupportReport.repairResult.overallStatus}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{latestSupportReport.repairResult.summary}</p>
                </div>

                {latestSupportReport.repairResult.steps.map((step) => (
                  <div key={step.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{step.label}</div>
                      <Badge className={repairStepTone[step.status]}>{step.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{step.details}</p>
                  </div>
                ))}
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                No quick repair has been saved yet. Run one if Vector feels stuck before reporting the issue.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
