import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  PlugZap,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import {
  getBatteryState,
  getBrainStatusLabel,
  getSystemStatusDisplay,
  logStatusTone
} from "@/lib/robot-state";
import { useAppStore } from "@/store/useAppStore";
import type { DiagnosticCheckStatus, DiagnosticOverallStatus } from "@/types";

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

export function DiagnosticsPage() {
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const logs = useAppStore((state) => state.logs);
  const diagnosticReports = useAppStore((state) => state.diagnosticReports);
  const diagnosticsState = useAppStore((state) => state.actionStates.diagnostics);
  const connectRobot = useAppStore((state) => state.connectRobot);
  const runDiagnostics = useAppStore((state) => state.runDiagnostics);
  const wakeRobot = useAppStore((state) => state.wakeRobot);

  const latestReport = diagnosticReports[0];
  const latestSuccessfulCommand = useMemo(() => logs.find((log) => log.status === "success"), [logs]);
  const latestFailedCommand = useMemo(() => logs.find((log) => log.status === "error"), [logs]);
  const batteryState = getBatteryState(robot);
  const systemStatus = getSystemStatusDisplay(robot.systemStatus);
  const brainStatus = getBrainStatusLabel(integration);
  const overallStatus: DiagnosticOverallStatus =
    latestReport?.overallStatus ??
    (integration.robotReachable ? "healthy" : integration.wirePodReachable ? "attention" : "critical");

  const troubleshooting = useMemo(() => {
    const items = new Set<string>();

    if (integration.note) {
      items.add(integration.note);
    }

    if (!integration.wirePodReachable) {
      items.add("The app cannot reach WirePod right now.");
    } else if (!integration.robotReachable) {
      items.add("WirePod is awake, but Vector is not answering local status checks yet.");
    }

    latestReport?.troubleshooting?.forEach((item) => items.add(item));
    return Array.from(items);
  }, [integration, latestReport]);

  const recoverySteps = useMemo(() => {
    if (!integration.wirePodReachable) {
      return [
        "Make sure WirePod is still running on this computer.",
        "Press Retry connection once the local brain is back online.",
        "Use the advanced connection details below if you need endpoint probe results."
      ];
    }

    if (!integration.robotReachable) {
      return [
        "Place Vector on the charger so the robot wakes on stable power.",
        "Press Retry connection to refresh the live robot link.",
        "If Vector still does not answer, send a wake signal and try again."
      ];
    }

    return [
      "The full Vector stack is responding normally.",
      "Run diagnostics before changing settings or reporting a bug.",
      "Use the latest report on the right to spot any early warning signs."
    ];
  }, [integration]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
      <div className="grid gap-4">
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
                  <Badge className={overallTone[overallStatus]}>{overallStatus}</Badge>
                  <Badge>{systemStatus.label}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Last checked {formatTimestamp(integration.lastCheckedAt)}</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PlugZap className="h-4 w-4 text-primary" />
                  Local brain
                </div>
                <div className="mt-2 text-lg font-semibold">{brainStatus}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {integration.wirePodReachable ? "WirePod is answering the app backend." : "The app cannot reach WirePod right now."}
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
              <Button onClick={runDiagnostics} disabled={diagnosticsState.status === "loading"}>
                <Activity className="h-4 w-4" />
                {diagnosticsState.status === "loading" ? "Running diagnostics..." : "Run diagnostics"}
              </Button>
              <Button variant="outline" onClick={connectRobot}>
                <RefreshCw className="h-4 w-4" />
                Retry connection
              </Button>
              <Button variant="outline" onClick={wakeRobot}>
                Send wake signal
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {diagnosticsState.message || integration.note || "Diagnostics results and command history stay stored locally."}
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
        <Card>
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
      </div>
    </div>
  );
}
