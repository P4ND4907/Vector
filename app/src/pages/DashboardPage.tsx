import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
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
import { formatRelativeTime, formatTimestamp, moodLabel } from "@/lib/format";
import { getBatteryState, getBrainStatusLabel, getSystemStatusDisplay, logStatusTone } from "@/lib/robot-state";
import { useAppStore } from "@/store/useAppStore";

const statusTone: Record<string, string> = {
  ready: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  charging: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  docked: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  busy: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  offline: "border-red-400/30 bg-red-400/10 text-red-100",
  error: "border-red-400/30 bg-red-400/10 text-red-100"
};

export function DashboardPage() {
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const routines = useAppStore((state) => state.routines);
  const logs = useAppStore((state) => state.logs);
  const connectRobot = useAppStore((state) => state.connectRobot);
  const wakeRobot = useAppStore((state) => state.wakeRobot);
  const toggleMute = useAppStore((state) => state.toggleMute);
  const returnToDock = useAppStore((state) => state.returnToDock);
  const runDiagnostics = useAppStore((state) => state.runDiagnostics);
  const runRoutineNow = useAppStore((state) => state.runRoutineNow);
  const connectState = useAppStore((state) => state.actionStates.connect);

  const latestLogs = useMemo(() => logs.slice(0, 3), [logs]);
  const enabledRoutines = useMemo(() => routines.filter((routine) => routine.enabled).slice(0, 3), [routines]);
  const batteryState = getBatteryState(robot);
  const systemStatus = getSystemStatusDisplay(robot.systemStatus);
  const brainStatus = getBrainStatusLabel(integration);
  const robotOnline = robot.isConnected && integration.robotReachable;
  const bannerMessage =
    connectState.message || integration.note || "If WirePod restarts, the dashboard will retry and keep the error plain-English.";
  const primaryActionLabel = robotOnline ? "Reconnect" : "Retry connection";
  const recoverySteps = integration.wirePodReachable
    ? [
        "Place Vector on the charger so it wakes on stable power.",
        "Press Retry connection to refresh the live link.",
        "Open Diagnostics if the robot still does not answer."
      ]
    : [
        "Make sure WirePod is still running on this computer.",
        "Press Retry connection once the local brain is back.",
        "Open Diagnostics to check endpoint probes and last errors."
      ];

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
                  See what is online, what needs attention, and what to do next without touching the WirePod UI.
                </p>
              </div>

              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-sm text-muted-foreground">Status snapshot</div>
                  <div className="mt-3 flex flex-wrap gap-2">
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
                  <div className="mt-3 text-xl font-semibold">
                    {robotOnline ? "Vector is live and ready." : "Get Vector back online."}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {robotOnline
                      ? "Controls, speech, routines, and AI commands are ready from this dashboard."
                      : integration.wirePodReachable
                        ? "The local brain is awake, but Vector is not answering yet."
                        : "The app cannot reach the local Vector brain right now."}
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
                        <dt>Local brain</dt>
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
                <Button className="sm:col-span-2 xl:col-span-4" size="lg" onClick={connectRobot}>
                  <RefreshCw className="h-4 w-4" />
                  {primaryActionLabel}
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
                  <Button size="sm" variant="ghost" onClick={wakeRobot}>
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
            </div>

            <div className="min-w-0 space-y-4">
              <div>
                <div className="eyebrow">Connection details</div>
                <div className="mt-2 flex flex-wrap gap-2">
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
                  <span>Local brain</span>
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
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
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
            <CardDescription>See whether WirePod or the robot is the current blocker.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wifi className="h-4 w-4 text-primary" />
                WirePod
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {integration.wirePodReachable
                  ? "Local WirePod is reachable from the backend."
                  : "Vector brain offline. WirePod was not reachable on the saved endpoint."}
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
                  : "WirePod may be up, but the robot itself is not responding yet."}
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
