import { type ReactNode, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Bot, RefreshCw, Search, ShieldCheck, Smartphone, Waypoints, Wifi } from "lucide-react";
import { ConnectionDoctorCard } from "@/components/connection/ConnectionDoctorCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { buildConnectionDoctor, type ConnectionDoctorActionId } from "@/lib/connection-doctor";
import { formatRelativeTime } from "@/lib/format";
import { mobileRuntimeNeedsManualBackendUrl } from "@/lib/runtime-target";
import { useAppStore } from "@/store/useAppStore";

export function PairingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const savedProfiles = useAppStore((state) => state.savedProfiles);
  const availableRobots = useAppStore((state) => state.availableRobots);
  const settings = useAppStore((state) => state.settings);
  const scanForRobots = useAppStore((state) => state.scanForRobots);
  const pairRobot = useAppStore((state) => state.pairRobot);
  const connectRobot = useAppStore((state) => state.connectRobot);
  const quickRepair = useAppStore((state) => state.quickRepair);
  const runDiagnostics = useAppStore((state) => state.runDiagnostics);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const scanState = useAppStore((state) => state.actionStates.scan);
  const pairState = useAppStore((state) => state.actionStates.pair);
  const connectState = useAppStore((state) => state.actionStates.connect);
  const [workingCandidateId, setWorkingCandidateId] = useState<string>();
  const setupAnotherRobotIntent = searchParams.get("intent") === "new-robot";

  const [form, setForm] = useState({
    name: robot.nickname ?? robot.name,
    ipAddress: robot.ipAddress === "Unavailable" ? "" : robot.ipAddress,
    token: "",
    autoReconnect: settings.autoReconnect,
    serial: settings.robotSerial || robot.serial || ""
  });
  const mobileBackendNeeded = mobileRuntimeNeedsManualBackendUrl();
  const isConnected = robot.isConnected && integration.robotReachable;
  const savedProfile = savedProfiles[0];
  const savedSerial = integration.selectedSerial || settings.robotSerial || savedProfile?.serial || form.serial;
  const effectiveSavedProfile = setupAnotherRobotIntent ? undefined : savedProfile;
  const effectiveSavedSerial = setupAnotherRobotIntent ? "" : savedSerial;
  const doctorSettings = setupAnotherRobotIntent ? { ...settings, robotSerial: "" } : settings;
  const doctorIntegration = setupAnotherRobotIntent
    ? { ...integration, selectedSerial: undefined }
    : integration;
  const doctorGuide = useMemo(
    () =>
      buildConnectionDoctor({
        robot,
        integration: doctorIntegration,
        settings: doctorSettings,
        savedProfile: effectiveSavedProfile,
        availableRobots
      }),
    [availableRobots, doctorIntegration, doctorSettings, effectiveSavedProfile, robot]
  );
  const statusTitle = mobileBackendNeeded
    ? "Save the desktop backend URL first."
    : setupAnotherRobotIntent
      ? "You are setting up a different robot."
    : isConnected
      ? `Connected to ${robot.nickname ?? robot.name}.`
      : integration.wirePodReachable
        ? effectiveSavedSerial
          ? "Reconnect or switch robots."
          : "Scan and save the right robot."
        : "Bring the desktop backend online first.";
  const statusDetail = mobileBackendNeeded
    ? "This phone still needs the LAN backend URL so it can reach your desktop service and local bridge."
    : setupAnotherRobotIntent
      ? "Saved-target reconnects are paused on this screen so you can finish the new-robot path without the old robot snapping back in."
    : isConnected
      ? "The robot link is live, so you can jump straight into the dashboard or switch to another Vector here."
      : integration.wirePodReachable
        ? effectiveSavedSerial
          ? "The app already knows a robot serial. Reconnect fast, or scan if you want to swap to a different robot."
          : "The local bridge is up. Scan once, save the right serial, and future reconnects should stay simple."
        : "The mobile app is running, but the desktop backend is not answering yet. Open settings or guided setup if you need to repair the link.";
  const canSaveAndConnect = Boolean(availableRobots.some((candidate) => candidate.serial));

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
        navigate(setupAnotherRobotIntent ? "/pairing?intent=new-robot" : "/pairing");
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

  const handleSaveAndConnectCandidate = async (candidate: (typeof availableRobots)[number]) => {
    setWorkingCandidateId(candidate.id);

    try {
      await pairRobot({
        name: candidate.name,
        ipAddress: candidate.ipAddress,
        token: "",
        autoReconnect: form.autoReconnect,
        serial: candidate.serial || ""
      });

      setForm((current) => ({
        ...current,
        name: candidate.name,
        ipAddress: candidate.ipAddress,
        serial: candidate.serial || current.serial
      }));

      await connectRobot();
    } finally {
      setWorkingCandidateId(undefined);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
      <Card>
        <CardHeader>
          <div className="eyebrow">Pairing and setup</div>
          <CardTitle>Let the dashboard find the local bridge first, then lock onto the right Vector serial.</CardTitle>
          <CardDescription>
            Users should not need the bridge UI. Discovery, serial selection, and reconnect preferences all stay here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="eyebrow">Smart next step</div>
            <div className="mt-2 text-2xl font-semibold">{statusTitle}</div>
            <p className="mt-2 text-sm text-muted-foreground">{statusDetail}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {mobileBackendNeeded ? (
                <Button onClick={() => navigate("/settings")}>
                  <Smartphone className="h-4 w-4" />
                  Open settings
                </Button>
              ) : setupAnotherRobotIntent ? (
                <Button onClick={scanForRobots} disabled={scanState.status === "loading"}>
                  <Search className="h-4 w-4" />
                  {scanState.status === "loading" ? "Scanning..." : "Scan for a different robot"}
                </Button>
              ) : isConnected ? (
                <Button onClick={() => navigate("/dashboard")}>
                  <ArrowRight className="h-4 w-4" />
                  Open dashboard
                </Button>
              ) : effectiveSavedSerial ? (
                <Button onClick={() => void connectRobot()} disabled={connectState.status === "loading"}>
                  <RefreshCw className="h-4 w-4" />
                  {connectState.status === "loading" ? "Connecting..." : "Connect saved target"}
                </Button>
              ) : (
                <Button onClick={scanForRobots} disabled={scanState.status === "loading"}>
                  <Search className="h-4 w-4" />
                  {scanState.status === "loading" ? "Scanning..." : "Scan for robots"}
                </Button>
              )}

              <Button variant="outline" onClick={() => navigate("/setup/new-robot")}>
                <Bot className="h-4 w-4" />
                {setupAnotherRobotIntent ? "Back to guided setup" : "Guided setup"}
              </Button>
            </div>
          </div>

          {setupAnotherRobotIntent ? (
            <div className="rounded-3xl border border-primary/20 bg-primary/[0.06] p-4">
              <div className="eyebrow">New robot mode</div>
              <div className="mt-2 text-lg font-semibold">Saved reconnect is paused for this screen.</div>
              <p className="mt-2 text-sm text-muted-foreground">
                If you just came back from the pairing portal, scan and save the new robot below. The old saved target will stay ignored until you choose it again.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => navigate("/setup/new-robot")}>
                  Guided new robot setup
                </Button>
                {(savedProfile || savedSerial) ? (
                  <Button variant="ghost" onClick={() => navigate("/pairing")}>
                    Use saved robot instead
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <ConnectionDoctorCard guide={doctorGuide} onAction={handleDoctorAction} compact className="md:hidden" />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-muted-foreground">Detected endpoint</div>
              <div className="mt-2 text-lg font-semibold">{integration.wirePodBaseUrl}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {integration.wirePodReachable
                  ? "The local bridge is reachable from the app backend."
                  : "The app cannot reach the local bridge right now."}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-muted-foreground">Selected serial</div>
              <div className="mt-2 text-lg font-semibold">{effectiveSavedSerial || form.serial || "Not set"}</div>
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
            <Button variant="outline" onClick={() => navigate("/setup/new-robot")}>
              Guided new robot setup
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
              "Once the local bridge is reachable, discovery and saved-target reconnects will stay on this screen."}
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
                      onClick={() => void handleSaveAndConnectCandidate(candidate)}
                      disabled={!candidate.serial || workingCandidateId === candidate.id}
                    >
                      <ArrowRight className="h-4 w-4" />
                      {workingCandidateId === candidate.id ? "Saving..." : "Save and connect"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
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
                    <Button size="sm" variant="ghost" onClick={() => void updateSettings({ robotSerial: candidate.serial || "" })}>
                      Save serial
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                No discovered robots yet. Run a scan and any authenticated local-bridge robots will appear here.
              </div>
            )}
          </div>

          <div className="grid gap-3 md:hidden">
            <PairingMobileSection
              title="Saved robots"
              description={
                savedProfiles.length
                  ? setupAnotherRobotIntent
                    ? "Choose one only if you want to leave new-robot mode."
                    : "Tap one to reuse it quickly."
                  : "No saved robots yet."
              }
            >
              <div className="space-y-3">
                {savedProfiles.length ? (
                  savedProfiles.map((profile) => (
                    <div key={profile.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">{profile.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{profile.ipAddress}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Serial {profile.serial || "Not saved"} - Last paired {formatRelativeTime(profile.lastPairedAt)}
                          </div>
                        </div>
                        <Badge>{profile.autoReconnect ? "Reconnect on" : "Manual only"}</Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigate("/pairing");
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
                          {setupAnotherRobotIntent ? "Use profile instead" : "Use profile"}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                    No saved robot profiles yet. Save one after a scan or enter the details manually.
                  </div>
                )}
              </div>
            </PairingMobileSection>

            <PairingMobileSection
              title="Manual robot profile"
              description="Keep the advanced override fields available without making them the default path."
            >
              <div className="space-y-4">
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
              </div>
            </PairingMobileSection>

            <PairingMobileSection
              title="Reliability defaults"
              description="These are the guardrails that make the mobile companion feel automatic."
            >
              <div className="space-y-3 text-sm text-muted-foreground">
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
                Clear error copy helps users tell the difference between the local bridge being offline and the robot being offline.
                </div>
              </div>
            </PairingMobileSection>
          </div>
        </CardContent>
      </Card>

      <div className="hidden gap-4 md:grid">
        <ConnectionDoctorCard guide={doctorGuide} onAction={handleDoctorAction} />

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
            <CardDescription>
              {setupAnotherRobotIntent
                ? "These stay available, but they will not be reused unless you choose one and leave new-robot mode."
                : "Keep serial-aware profiles here so adding a second Vector later stays clean."}
            </CardDescription>
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
                        Serial {profile.serial || "Not saved"} - Last paired {formatRelativeTime(profile.lastPairedAt)}
                      </div>
                    </div>
                    <Badge>{profile.autoReconnect ? "Reconnect on" : "Manual only"}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigate("/pairing");
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
                      {setupAnotherRobotIntent ? "Use profile instead" : "Use profile"}
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
                Clear error copy helps users tell the difference between the local bridge being offline and the robot being offline.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PairingMobileSection({
  title,
  description,
  children,
  defaultOpen = false
}: {
  title: string;
  description: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-3xl border border-white/10 bg-white/[0.03]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        </div>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-white/10 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
