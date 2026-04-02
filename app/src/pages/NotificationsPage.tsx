import { useState } from "react";
import { BellRing, MessageSquareHeart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatTimestamp, levelTone } from "@/lib/format";
import { logStatusTone, notificationSurfaceTone } from "@/lib/robot-state";
import { useAppStore } from "@/store/useAppStore";

export function NotificationsPage() {
  const notifications = useAppStore((state) => state.notifications);
  const logs = useAppStore((state) => state.logs);
  const addReminder = useAppStore((state) => state.addReminder);
  const markNotificationRead = useAppStore((state) => state.markNotificationRead);
  const [title, setTitle] = useState("Hydration reminder");
  const [description, setDescription] = useState("Time for a quick water break.");

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <div className="eyebrow">Notifications and reminders</div>
          <CardTitle>Low battery, disconnect, completion, and custom spoken reminders.</CardTitle>
          <CardDescription>
            The app keeps alerts plain-English, visible, and easy to acknowledge from one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Reminder title</label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Reminder message</label>
              <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
          </div>
          <Button onClick={() => addReminder(title, description)}>
            <MessageSquareHeart className="h-4 w-4" />
            Queue reminder
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent notifications</CardTitle>
            <CardDescription>Unread items stay pinned until the user marks them handled.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className={`rounded-3xl border-l-4 p-4 ${notificationSurfaceTone[notification.level]}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Alert</div>
                    <div className="font-semibold">{notification.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{notification.description}</div>
                  </div>
                  <Badge className={levelTone[notification.level]}>{notification.level}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{formatTimestamp(notification.createdAt)}</span>
                  {!notification.read ? (
                    <Button size="sm" variant="outline" onClick={() => markNotificationRead(notification.id)}>
                      Mark read
                    </Button>
                  ) : (
                    <span>Read</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert-linked command history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.slice(0, 5).map((log) => (
              <div key={log.id} className={`rounded-2xl border p-3 ${logStatusTone[log.status]}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold capitalize">{log.type}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      {formatTimestamp(log.createdAt)}
                    </div>
                  </div>
                  <Badge>{log.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{log.resultMessage}</div>
              </div>
            ))}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <BellRing className="h-4 w-4 text-primary" />
              Custom reminders can be spoken by the robot or surfaced as app notifications later.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
