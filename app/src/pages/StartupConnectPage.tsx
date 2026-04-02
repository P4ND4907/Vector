import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  ChevronRight,
  PlugZap,
  RefreshCw,
  Search,
  ShieldAlert,
  Wifi
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { getBatteryState, getBrainStatusLabel, getSystemStatusDisplay } from "@/lib/robot-state";
import { useAppStore } from "@/store/useAppStore";

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
  const connectState = useAppStore((state) => state.actionStates.connect);
  const scanState = useAppStore((state) => state.actionStates.scan);

  const batteryState = getBatteryState(robot);
  const systemStatus = getSystemStatusDisplay(robot.systemStatus);
  const brainStatus = getBrainStatusLabel(integration);
  const savedTarget = savedProfiles[0];
  const isConnected = robot.isConnected && integration.robotReachable;
  const primaryMessage =
    connectState.message ||
    scanState.message ||
    integration.note ||
    "Connect to your Vector first, then the rest of the dashboard becomes available.";
  const calmSetupMessage =
    !integration.wirePodReachable && !settings.mockMode
      ? "WirePod was not detected yet. Start the local Vector brain, then try Connect again."
      : primaryMessage;

  const topCandidates = useMemo(() => availableRobots.slice(0, 3), [availableRobots]);

  const handlePrimary = async () => {
    if (isConnected) {
      navigate("/dashboard");
      return;
    }

    await connectRobot();
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] px-2 py-4 md:px-4">
      <div className="mx-auto grid max-w-[1240px] gap-4 xl:grid-cols-[1.04fr_0.96fr]">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-6 p-6 md:p-8">
            <div className="space-y-4">
              <div className="eyebrow">Startup connection</div>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight">
                  {isConnected ? `Connected to ${robot.nickname ?? robot.name}.` : "Connect to your robot."}
                </h1>
                <p className="max-w-2xl text-base text-muted-foreground">
                  This screen exists to get Vector online quickly, with calm setup steps and honest status.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge>{systemStatus.label}</Badge>
              <Badge className={batteryState.badgeClassName}>{batteryState.label}</Badge>
              <Badge>{brainStatus}</Badge>
              <Badge>{integration.selectedSerial || robot.serial || "No serial saved"}</Badge>
            </div>

            {settings.mockMode || integration.mockMode ? (
              <div className="rounded-3xl border border-amber-300/18 bg-amber-300/8 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-100/80">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Real robot mode
                </div>
                <p className="mt-2 text-sm text-amber-50/90">
                  Mock mode is turned on. Turn it off before trying to connect to a real Vector.
                </p>
                <div className="mt-3">
                  <Button size="sm" variant="ghost" onClick={() => void updateSettings({ mockMode: false })}>
                    Turn off mock mode
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <PlugZap className="h-4 w-4 text-primary" />
                  Local brain
                </div>
                <div className="mt-2 text-lg font-semibold">{integration.wirePodReachable ? "Detected" : "Offline"}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {integration.wirePodReachable ? "WirePod answered the backend." : "The app cannot reach WirePod yet."}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Bot className="h-4 w-4 text-primary" />
                  Selected robot
                </div>
                <div className="mt-2 text-lg font-semibold">{integration.selectedSerial || robot.serial || "Not set"}</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {savedTarget ? `${savedTarget.name} is ready to reconnect.` : "Pair or scan for a robot first."}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Wifi className="h-4 w-4 text-primary" />
                  Robot link
                </div>
                <div className="mt-2 text-lg font-semibold">{isConnected ? "Online" : "Waiting"}</div>
                <p className="mt-2 text-sm text-muted-foreground">Last seen {formatRelativeTime(robot.lastSeen)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={handlePrimary} disabled={connectState.status === "loading"}>
                {isConnected ? <ArrowRight className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                {isConnected ? "Open dashboard" : connectState.status === "loading" ? "Connecting..." : "Connect to Vector"}
              </Button>
              <Button variant="outline" size="lg" onClick={() => void scanForRobots()} disabled={scanState.status === "loading"}>
                <Search className="h-4 w-4" />
                {scanState.status === "loading" ? "Scanning..." : "Scan network"}
              </Button>
              <Link to="/pairing">
                <Button variant="ghost" size="lg">
                  Pair or switch robot
                </Button>
              </Link>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
              {calmSetupMessage}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Connection checklist</CardTitle>
              <CardDescription>Check the local brain, the saved serial, then reconnect.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-xs font-semibold text-muted-foreground">
                  1
                </div>
                <div className="text-sm text-muted-foreground">Make sure WirePod is running on this computer.</div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-xs font-semibold text-muted-foreground">
                  2
                </div>
                <div className="text-sm text-muted-foreground">Confirm the saved serial is the robot you want to control.</div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-xs font-semibold text-muted-foreground">
                  3
                </div>
                <div className="text-sm text-muted-foreground">
                  Connect here first, then open the full dashboard once Vector answers.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved target</CardTitle>
              <CardDescription>The startup screen always reconnects to the saved robot first.</CardDescription>
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
                  No saved robot target yet. Open pairing and save one first.
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
