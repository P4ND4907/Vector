import { useEffect, useMemo, useState } from "react";
import { Flag, MapPinned, Route, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { botlabService } from "@/services/botlabService";
import type { BotLabManifest, BotLabMarkerResolution, BotLabRunResult, Routine } from "@/types";

const SAMPLE_HINT =
  '{ "app": "BotLab Tiles", "version": 1, "robot": { "name": "Scout", "model": "Vector" }, "layout": [], "mission": { "id": "leave-find-home", "title": "Leave Home, Find Home", "pack": "Starter", "difficulty": 1, "required": ["M01_DOCK", "M02_STRAIGHT"], "goal": "Leave the dock tile, identify marker 2, and return to marker 1.", "success": "Three successful returns without manual repositioning." }, "integration": { "handoffUrl": "manual", "eventName": "botlab.layout.updated" }, "runs": [] }';

export function BotLabTilesCard() {
  const [manifest, setManifest] = useState<BotLabManifest | null>(null);
  const [sessions, setSessions] = useState<Routine[]>([]);
  const [payloadText, setPayloadText] = useState("");
  const [markerText, setMarkerText] = useState("1");
  const [marker, setMarker] = useState<BotLabMarkerResolution | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [message, setMessage] = useState("Import a BotLab layout JSON, then assign marker IDs as Vector reaches each tile.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.all([botlabService.getManifest(), botlabService.getSessions()])
      .then(([nextManifest, sessionResponse]) => {
        if (!active) {
          return;
        }
        setManifest(nextManifest);
        setSessions(sessionResponse.sessions);
        setSelectedSessionId(sessionResponse.sessions[0]?.id ?? "");
      })
      .catch((error) => {
        if (active) {
          setMessage(error instanceof Error ? error.message : "BotLab learning tools are not available yet.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId),
    [selectedSessionId, sessions]
  );

  const importPayload = async () => {
    setBusy(true);
    try {
      const payload = JSON.parse(payloadText || SAMPLE_HINT) as unknown;
      const result = await botlabService.importPayload(payload);
      setSessions((current) => [result.session, ...current.filter((session) => session.id !== result.session.id)]);
      setSelectedSessionId(result.session.id);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Paste valid BotLab JSON first.");
    } finally {
      setBusy(false);
    }
  };

  const resolveMarker = async () => {
    const markerId = Number(markerText);
    if (!Number.isInteger(markerId) || markerId <= 0) {
      setMessage("Enter a marker ID like 1, 2, 7, 21, or 41.");
      return;
    }

    setBusy(true);
    try {
      const result = await botlabService.resolveMarker(markerId);
      setMarker(result);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Marker lookup failed.");
    } finally {
      setBusy(false);
    }
  };

  const recordRun = async (result: BotLabRunResult) => {
    const missionId =
      activeSession?.conditions
        .find((condition) => condition.startsWith("mission:"))
        ?.replace("mission:", "") || "leave-find-home";

    setBusy(true);
    try {
      const response = await botlabService.recordRun(missionId, result, activeSession?.id);
      setMessage(response.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Run result could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <MapPinned className="h-4 w-4" />
          <span className="eyebrow">BotLab Tiles</span>
        </div>
        <CardTitle>Obstacle course learning</CardTitle>
        <CardDescription>
          Import tile layouts, assign marker IDs manually, and save mission results locally inside this app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-3 text-sm text-muted-foreground">
          {manifest
            ? `${manifest.starter.length + manifest.expansions.length} marker tiles loaded. ${manifest.note}`
            : "Loading BotLab marker map..."}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="botlab-payload">
            Paste BotLab JSON
          </label>
          <Textarea
            id="botlab-payload"
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            placeholder={SAMPLE_HINT}
            rows={5}
          />
          <Button type="button" onClick={importPayload} disabled={busy}>
            <Route className="mr-2 h-4 w-4" />
            Import learning session
          </Button>
        </div>

        {sessions.length ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="botlab-session">
              Active session
            </label>
            <select
              id="botlab-session"
              className="w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            value={markerText}
            onChange={(event) => setMarkerText(event.target.value)}
            placeholder="Marker ID"
            inputMode="numeric"
          />
          <Button type="button" variant="outline" onClick={resolveMarker} disabled={busy}>
            <ScanLine className="mr-2 h-4 w-4" />
            Assign marker
          </Button>
        </div>

        {marker ? (
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-3 text-sm">
            <div className="font-semibold">
              {marker.known ? `${marker.module?.title} marker ${marker.markerId}` : `Unknown marker ${marker.markerId}`}
            </div>
            <p className="mt-1 text-muted-foreground">{marker.suggestedAction ?? marker.message}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(["success", "partial", "failed"] as const).map((result) => (
            <Button
              key={result}
              type="button"
              variant={result === "success" ? "default" : "outline"}
              onClick={() => recordRun(result)}
              disabled={busy}
            >
              <Flag className="mr-2 h-4 w-4" />
              Mark {result}
            </Button>
          ))}
        </div>

        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-3 text-sm text-muted-foreground">
          {message}
        </div>
      </CardContent>
    </Card>
  );
}
