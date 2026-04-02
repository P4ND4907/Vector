import { useEffect } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime, formatTimestamp } from "@/lib/format";
import {
  getBatteryState,
  getBrainStatusLabel,
  getSystemStatusDisplay,
  logStatusTone,
  notificationSurfaceTone
} from "@/lib/robot-state";
import type { CommandLog, IntegrationStatus, NotificationItem, Robot, ToastItem } from "@/types";

const statusTone: Record<Robot["systemStatus"], string> = {
  ready: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  charging: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  docked: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  busy: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  offline: "border-red-400/30 bg-red-400/10 text-red-100",
  error: "border-red-400/30 bg-red-400/10 text-red-100"
};

export function PinnedStatusCard({
  robot,
  integration
}: {
  robot: Robot;
  integration: IntegrationStatus;
}) {
  const batteryState = getBatteryState(robot);
  const systemStatus = getSystemStatusDisplay(robot.systemStatus);
  const brainStatus = getBrainStatusLabel(integration);
  const showConnectionState =
    robot.connectionState === "connecting" || (robot.connectionState === "connected" && robot.isConnected);

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="eyebrow">Pinned status</div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{robot.nickname ?? robot.name}</h1>
            <Badge className={statusTone[systemStatus.toneKey]}>{systemStatus.label}</Badge>
            {showConnectionState ? (
              <Badge className="border-primary/30 bg-primary/10 text-primary">{robot.connectionState}</Badge>
            ) : null}
            <Badge className={batteryState.badgeClassName}>{batteryState.label}</Badge>
            <Badge>{brainStatus}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Last seen {formatRelativeTime(robot.lastSeen)}
            {robot.ipAddress && robot.ipAddress !== "Unavailable" ? ` on ${robot.ipAddress}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {integration.note || robot.currentActivity}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/drive">
            <Button>Open controls</Button>
          </Link>
          <Link to="/ai">
            <Button variant="outline">AI commands</Button>
          </Link>
          <Link to="/diagnostics">
            <Button variant="outline">Diagnostics</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function DesktopSidebarPanels({
  unreadNotifications,
  recentLogs
}: {
  unreadNotifications: NotificationItem[];
  recentLogs: CommandLog[];
}) {
  return (
    <div className="sticky top-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Unread alerts</CardTitle>
          <CardDescription>Notifications stay visible until you acknowledge them.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {unreadNotifications.length ? (
            unreadNotifications.slice(0, 4).map((notification) => (
              <div
                key={notification.id}
                className={`rounded-2xl border-l-4 p-3 ${notificationSurfaceTone[notification.level]}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Alert</span>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(notification.createdAt)}</span>
                </div>
                <div className="mt-2 text-sm font-semibold">{notification.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{notification.description}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No unread alerts right now.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Command log</CardTitle>
          <CardDescription>Recent actions and responses from the robot layer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentLogs.length ? (
            recentLogs.map((log) => (
              <div key={log.id} className={`rounded-2xl border p-3 ${logStatusTone[log.status]}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold capitalize">{log.type}</span>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {formatTimestamp(log.createdAt)}
                    </div>
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{log.status}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{log.resultMessage}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No command log entries yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ToastRail({
  toasts,
  dismissToast
}: {
  toasts: ToastItem[];
  dismissToast: (toastId: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-30 flex items-end xl:inset-x-auto xl:bottom-6 xl:right-6">
      <div className="flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastNotice key={toast.id} toast={toast} dismissToast={dismissToast} />
      ))}
      </div>
    </div>
  );
}

function ToastNotice({
  toast,
  dismissToast
}: {
  toast: ToastItem;
  dismissToast: (toastId: string) => void;
}) {
  useEffect(() => {
    const durationMs = toast.level === "warning" ? 5200 : toast.level === "success" ? 2600 : 3600;
    const timeout = window.setTimeout(() => dismissToast(toast.id), durationMs);
    return () => window.clearTimeout(timeout);
  }, [toast.id, toast.level, dismissToast]);

  return (
    <div
      className={`pointer-events-auto rounded-2xl border p-4 shadow-[0_18px_40px_rgba(1,8,20,0.42)] backdrop-blur ${notificationSurfaceTone[toast.level]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Notice</div>
          <div className="mt-2 text-sm font-semibold">{toast.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{toast.description}</div>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/10 p-2 text-muted-foreground transition hover:text-foreground"
          onClick={() => dismissToast(toast.id)}
          aria-label={`Dismiss ${toast.title}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
