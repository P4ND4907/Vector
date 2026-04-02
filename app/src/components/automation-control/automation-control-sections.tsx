import {
  Bot,
  Camera,
  Map,
  Pause,
  Play,
  Radar,
  Route,
  Shield,
  Square,
  UploadCloud
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Range } from "@/components/ui/range";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import { getBatteryStateFromEstimate } from "@/lib/robot-state";
import type { ActionFeedback, AutomationControl, RoamBehavior, RoamSession } from "@/types";

const behaviorTabs: Array<{ value: RoamBehavior; label: string }> = [
  { value: "patrol", label: "Patrol" },
  { value: "explore", label: "Explore" },
  { value: "quiet", label: "Quiet" }
];

function MetricTile({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
    </div>
  );
}

export function AutomationOverviewCard({
  automationControl,
  automationState,
  roamSessionsCount,
  storedDataPoints,
  onStartRoam,
  onPauseRoam,
  onResumeRoam,
  onStopRoam,
  onReturnToDock
}: {
  automationControl: AutomationControl;
  automationState: ActionFeedback;
  roamSessionsCount: number;
  storedDataPoints: number;
  onStartRoam: () => void;
  onPauseRoam: () => void;
  onResumeRoam: () => void;
  onStopRoam: () => void;
  onReturnToDock: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="eyebrow">Automation control</div>
        <CardTitle>Let Vector roam on its own, then store the session data locally.</CardTitle>
        <CardDescription>
          Configure how the robot behaves, what it collects, and when it should safely stop and dock itself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricTile
            label="Automation status"
            value={automationControl.status}
            description={`Last heartbeat ${formatRelativeTime(automationControl.lastHeartbeatAt)}`}
          />
          <MetricTile
            label="Storage"
            value={`${storedDataPoints} data points`}
            description={`${roamSessionsCount} roam sessions stored locally on this device`}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onStartRoam}
            disabled={automationState.status === "loading" || automationControl.status === "running"}
          >
            <Play className="h-4 w-4" />
            Start roam
          </Button>
          <Button
            variant="outline"
            onClick={onPauseRoam}
            disabled={automationState.status === "loading" || automationControl.status !== "running"}
          >
            <Pause className="h-4 w-4" />
            Pause
          </Button>
          <Button
            variant="outline"
            onClick={onResumeRoam}
            disabled={automationState.status === "loading" || automationControl.status !== "paused"}
          >
            <Play className="h-4 w-4" />
            Resume
          </Button>
          <Button
            variant="secondary"
            onClick={onStopRoam}
            disabled={automationState.status === "loading" || automationControl.status === "idle"}
          >
            <Square className="h-4 w-4" />
            Stop and store
          </Button>
          <Button variant="ghost" onClick={onReturnToDock}>
            <Radar className="h-4 w-4" />
            Send to charger
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge>{automationControl.behavior}</Badge>
          <p className="text-sm text-muted-foreground">
            {automationState.message ??
              "Autonomous roams keep their event log, distance, snapshots, and telemetry in local storage."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function RoamSetupCard({
  automationControl,
  onUpdateAutomationControl
}: {
  automationControl: AutomationControl;
  onUpdateAutomationControl: (patch: Partial<AutomationControl>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roam setup</CardTitle>
        <CardDescription>Keep the defaults beginner-friendly, with safety controls always visible.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Target area</label>
          <Input
            value={automationControl.targetArea}
            onChange={(event) => onUpdateAutomationControl({ targetArea: event.target.value })}
            placeholder="Desk perimeter"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Behavior</label>
          <Tabs
            value={automationControl.behavior}
            onValueChange={(value) => onUpdateAutomationControl({ behavior: value as RoamBehavior })}
            items={behaviorTabs}
          />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Auto-dock threshold</div>
              <div className="text-xs text-muted-foreground">
                If battery drops under this point, roam stops and data is stored automatically.
              </div>
            </div>
            <div className="text-lg font-semibold">{automationControl.autoDockThreshold}%</div>
          </div>
          <Range
            className="mt-4"
            min={10}
            max={70}
            step={1}
            value={automationControl.autoDockThreshold}
            onChange={(event) =>
              onUpdateAutomationControl({ autoDockThreshold: Number(event.target.value) })
            }
          />
        </div>

        <div className="grid gap-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-primary" />
                  Safe return
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Auto-stop the roam and protect battery margins.
                </div>
              </div>
              <Switch
                checked={automationControl.safeReturnEnabled}
                onCheckedChange={(checked) => onUpdateAutomationControl({ safeReturnEnabled: checked })}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Camera className="h-4 w-4 text-primary" />
                  Capture snapshots
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Save occasional camera stills during autonomous roaming.
                </div>
              </div>
              <Switch
                checked={automationControl.captureSnapshots}
                onCheckedChange={(checked) => onUpdateAutomationControl({ captureSnapshots: checked })}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <UploadCloud className="h-4 w-4 text-primary" />
                  Store telemetry
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Keep movement, battery, and event markers locally for review.
                </div>
              </div>
              <Switch
                checked={automationControl.dataCollectionEnabled}
                onCheckedChange={(checked) =>
                  onUpdateAutomationControl({ dataCollectionEnabled: checked })
                }
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ActiveRoamCard({
  activeSession,
  robotBatteryStateLabel
}: {
  activeSession: RoamSession | null;
  robotBatteryStateLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active roam</CardTitle>
        <CardDescription>Live progress stays readable while Vector is moving around on its own.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeSession ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Distance" value={`${activeSession.distanceMeters.toFixed(1)} m`} />
              <MetricTile label="Commands" value={String(activeSession.commandsIssued)} />
              <MetricTile label="Snapshots" value={String(activeSession.snapshotsTaken)} />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{activeSession.name}</span>
                    <Badge>{activeSession.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{activeSession.summary}</p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {robotBatteryStateLabel} | Started {formatTimestamp(activeSession.startedAt)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {activeSession.events.slice(0, 5).map((event) => (
                <div key={event.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold capitalize">{event.type}</span>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(event.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{event.message}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
            No roam is active right now. Start one and this panel will fill with live distance, events, and collected data.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StoredRoamDataCard({
  roamSessions,
  completedSessionsCount,
  storedDistance,
  storedDataPoints
}: {
  roamSessions: RoamSession[];
  completedSessionsCount: number;
  storedDistance: number;
  storedDataPoints: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stored roam data</CardTitle>
        <CardDescription>Every completed roam is kept locally for quick review and future automation logic.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Route className="h-4 w-4 text-primary" />
              Distance
            </div>
            <div className="mt-2 text-2xl font-semibold">{storedDistance.toFixed(1)} m</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Map className="h-4 w-4 text-primary" />
              Sessions
            </div>
            <div className="mt-2 text-2xl font-semibold">{completedSessionsCount}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UploadCloud className="h-4 w-4 text-primary" />
              Data
            </div>
            <div className="mt-2 text-2xl font-semibold">{storedDataPoints}</div>
          </div>
        </div>

        {roamSessions.map((session) => (
          <div key={session.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{session.name}</div>
                  <Badge>{session.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{session.summary}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>{session.distanceMeters.toFixed(1)} m</div>
                <div>{session.dataPointsCollected} data points</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {formatTimestamp(session.startedAt)} | {session.targetArea} | {getBatteryStateFromEstimate(session.batteryStart).label}
              {session.batteryEnd !== undefined ? ` -> ${getBatteryStateFromEstimate(session.batteryEnd).label}` : ""}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
