import { Eye, RefreshCcw, ScanSearch, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimestamp } from "@/lib/format";
import { apiBaseUrl } from "@/services/apiClient";
import { useAppStore } from "@/store/useAppStore";

export function CameraPage() {
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const snapshots = useAppStore((state) => state.snapshots);
  const visionEvents = useAppStore((state) => state.visionEvents);
  const takeSnapshot = useAppStore((state) => state.takeSnapshot);

  const latestSnapshot = snapshots[0];
  const liveStreamAvailable =
    integration.source === "wirepod" && integration.wirePodReachable && robot.isConnected && robot.cameraAvailable;
  const latestPreviewSrc =
    latestSnapshot?.remoteId && liveStreamAvailable
      ? `${apiBaseUrl}/api/robot/camera/photo/${encodeURIComponent(latestSnapshot.remoteId)}`
      : latestSnapshot?.dataUrl;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <div className="eyebrow">Camera and vision</div>
          <CardTitle>Capture Vector photos from the app and keep the library stored locally.</CardTitle>
          <CardDescription>
            When WirePod is live, this screen can ask Vector to take a photo, pull the saved image back in, and keep a
            local copy for quick review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-black/40">
            {latestPreviewSrc ? (
              <img
                alt={latestSnapshot.label}
                className="aspect-video w-full object-cover"
                src={latestPreviewSrc}
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
                <div>No saved robot photos yet.</div>
                <div>Press capture and the app will ask Vector for a photo, then sync the saved image back in.</div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={takeSnapshot}>
              <RefreshCcw className="h-4 w-4" />
              Take photo and sync
            </Button>
            {liveStreamAvailable ? (
              <Button
                onClick={() => {
                  window.open(`${apiBaseUrl}/api/robot/camera/stream`, "_blank", "noopener,noreferrer");
                }}
                variant="secondary"
              >
                <Video className="h-4 w-4" />
                Open live feed
              </Button>
            ) : null}
            <Badge>{robot.cameraAvailable ? "Camera ready" : "Camera unavailable"}</Badge>
            <Badge>{liveStreamAvailable ? "Live stream available" : "Photo library only"}</Badge>
            <Badge>{snapshots.length ? `${snapshots.length} stored` : "No stored photos"}</Badge>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
            {integration.source === "wirepod" && !integration.mockMode ? (
              <p>WirePod exposes Vector&apos;s saved photo library here. The app can trigger a capture, import the saved image, and keep that photo stored locally after sync.</p>
            ) : (
              <p>Mock mode is active, so camera captures are simulated locally for layout and storage testing.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Vision events</CardTitle>
            <CardDescription>Motion markers now, richer detections later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visionEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{event.label}</div>
                  <Badge>{Math.round(event.confidence * 100)}%</Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{formatTimestamp(event.createdAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved snapshots</CardTitle>
            <CardDescription>Imported robot photos stay stored in the app for quick review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <img alt={snapshot.label} className="h-16 w-24 rounded-xl object-cover" src={snapshot.dataUrl} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{snapshot.label}</div>
                    <Badge>{snapshot.source === "wirepod" ? "Robot photo" : "Local mock"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatTimestamp(snapshot.createdAt)}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Eye className="h-4 w-4 text-primary" />
              Synced photos stay in your local app history even after you relaunch.
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ScanSearch className="h-4 w-4 text-primary" />
              Future face or object detection can layer on top of this photo library without changing the core flow.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
