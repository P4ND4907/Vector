import { useState } from "react";
import { Search, ShieldCheck, Waypoints, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatRelativeTime } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

export function PairingPage() {
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const savedProfiles = useAppStore((state) => state.savedProfiles);
  const availableRobots = useAppStore((state) => state.availableRobots);
  const settings = useAppStore((state) => state.settings);
  const scanForRobots = useAppStore((state) => state.scanForRobots);
  const pairRobot = useAppStore((state) => state.pairRobot);
  const connectRobot = useAppStore((state) => state.connectRobot);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const scanState = useAppStore((state) => state.actionStates.scan);
  const pairState = useAppStore((state) => state.actionStates.pair);

  const [form, setForm] = useState({
    name: robot.nickname ?? robot.name,
    ipAddress: robot.ipAddress === "Unavailable" ? "" : robot.ipAddress,
    token: "",
    autoReconnect: settings.autoReconnect,
    serial: settings.robotSerial || robot.serial || ""
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <Card>
        <CardHeader>
          <div className="eyebrow">Pairing and setup</div>
          <CardTitle>Let the dashboard find WirePod first, then lock onto the right Vector serial.</CardTitle>
          <CardDescription>
            Users should not need the WirePod UI. Discovery, serial selection, and reconnect preferences all stay here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-muted-foreground">Detected endpoint</div>
              <div className="mt-2 text-lg font-semibold">{integration.wirePodBaseUrl}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {integration.wirePodReachable ? "WirePod is reachable." : "Vector brain offline."}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-muted-foreground">Selected serial</div>
              <div className="mt-2 text-lg font-semibold">{integration.selectedSerial || form.serial || "Not set"}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {integration.robotReachable
                  ? "Robot link is currently reachable."
                  : "A saved serial helps the backend target the right robot."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={scanForRobots}>
              <Search className="h-4 w-4" />
              Scan for robots
            </Button>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.autoReconnect}
                onCheckedChange={(value) => {
                  setForm((current) => ({ ...current, autoReconnect: value }));
                  void updateSettings({ autoReconnect: value, reconnectOnStartup: value });
                }}
              />
              <span className="text-sm text-muted-foreground">Reconnect on startup</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {scanState.message ||
              integration.note ||
              "If WirePod is installed locally, discovery will surface authenticated robots here."}
          </p>

          <div className="grid gap-3">
            {availableRobots.length ? (
              availableRobots.map((candidate) => (
                <div key={candidate.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{candidate.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Seen {formatRelativeTime(candidate.lastSeen)} on {candidate.ipAddress}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Serial {candidate.serial || "Unknown"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{candidate.signalStrength}% signal</Badge>
                      <Badge>{candidate.secure ? "Secure" : "Open"}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          name: candidate.name,
                          ipAddress: candidate.ipAddress,
                          serial: candidate.serial || current.serial
                        }))
                      }
                    >
                      Use details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void updateSettings({ robotSerial: candidate.serial || "" })}
                    >
                      Save serial
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                No discovered robots yet. Run a scan and any authenticated WirePod robots will appear here.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Manual robot profile</CardTitle>
            <CardDescription>
              Keep manual override fields available for edge cases without making them the default path.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Robot nickname</label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Robot IP address</label>
              <Input value={form.ipAddress} onChange={(event) => setForm((current) => ({ ...current, ipAddress: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Robot serial</label>
              <Input value={form.serial} onChange={(event) => setForm((current) => ({ ...current, serial: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Token or key (optional)</label>
              <Input value={form.token} onChange={(event) => setForm((current) => ({ ...current, token: event.target.value }))} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => pairRobot(form)}>Save profile</Button>
              <Button variant="outline" onClick={connectRobot}>
                Test live connection
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {pairState.message || "Profiles save locally so reconnect stays fast the next time you open the app."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved robots</CardTitle>
            <CardDescription>Keep serial-aware profiles here so adding a second Vector later stays clean.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedProfiles.length ? (
              savedProfiles.map((profile) => (
                <div key={profile.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{profile.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{profile.ipAddress}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Serial {profile.serial || "Not saved"} • Last paired {formatRelativeTime(profile.lastPairedAt)}
                      </div>
                    </div>
                    <Badge>{profile.autoReconnect ? "Reconnect on" : "Manual only"}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setForm({
                          name: profile.name,
                          ipAddress: profile.ipAddress,
                          token: profile.token,
                          autoReconnect: profile.autoReconnect,
                          serial: profile.serial || ""
                        });
                        void updateSettings({
                          robotSerial: profile.serial || "",
                          autoReconnect: profile.autoReconnect,
                          reconnectOnStartup: profile.autoReconnect
                        });
                      }}
                    >
                      Use profile
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                No saved robot profiles yet. Save one after a scan or enter the details manually.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reliability defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <Wifi className="h-4 w-4 text-primary" />
              Auto-detect keeps the local backend invisible for most users.
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Serials and endpoint overrides stay in the app settings, not scattered around the frontend.
            </div>
            <div className="flex items-center gap-3">
              <Waypoints className="h-4 w-4 text-primary" />
              Clear error copy helps users tell the difference between WirePod offline and robot offline.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
