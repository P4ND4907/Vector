import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postJson } from "@/services/apiClient";

interface EngineDiscoverResponse {
  robots: Array<{
    serial?: string;
    name: string;
    ipAddress: string;
  }>;
}

const steps = [
  "Welcome",
  "Choose engine",
  "Scan or manual input",
  "Pair",
  "Connect",
  "Done"
] as const;

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [provider, setProvider] = useState<"embedded" | "wirepod" | "mock">("embedded");
  const [robots, setRobots] = useState<EngineDiscoverResponse["robots"]>([]);
  const [selectedSerial, setSelectedSerial] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [name, setName] = useState("Vector");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const canProceed = useMemo(() => {
    if (stepIndex === 2) {
      return Boolean(selectedSerial || ipAddress.trim());
    }
    return true;
  }, [ipAddress, selectedSerial, stepIndex]);

  const runScan = async () => {
    setBusy(true);
    setNote("");
    try {
      const payload = await postJson<EngineDiscoverResponse>("/api/engine/repair/scan-again", {}, "Scan failed.");
      setRobots(payload.robots);
      if (payload.robots[0]?.serial) {
        setSelectedSerial(payload.robots[0].serial);
        setIpAddress(payload.robots[0].ipAddress);
        setName(payload.robots[0].name || "Vector");
      }
      setNote(payload.robots.length ? `Found ${payload.robots.length} robot candidate(s).` : "No robots found yet.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  };

  const continueStep = async () => {
    setBusy(true);
    setNote("");
    try {
      if (stepIndex === 1) {
        await postJson("/api/engine/provider", { provider }, "Engine provider switch failed.");
      }
      if (stepIndex === 3) {
        await postJson(
          "/api/engine/pair",
          {
            serial: selectedSerial || "manual-serial",
            ipAddress,
            name
          },
          "Pairing failed."
        );
      }
      if (stepIndex === 4) {
        await postJson(
          "/api/engine/connect",
          {
            serial: selectedSerial || undefined,
            ipAddress,
            name
          },
          "Connection failed."
        );
      }
      setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That step failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Onboarding wizard</CardTitle>
          <CardDescription>Step {stepIndex + 1} of {steps.length}: {steps[stepIndex]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stepIndex === 0 ? <p>Welcome. This app will set up your robot with the local Engine flow.</p> : null}

          {stepIndex === 1 ? (
            <div className="space-y-2">
              <label htmlFor="provider" className="text-sm font-medium">
                Engine provider
              </label>
              <select
                id="provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value as "embedded" | "wirepod" | "mock")}
                className="w-full rounded-md border border-[var(--surface-border)] bg-background px-3 py-2 text-sm"
              >
                <option value="embedded">Embedded (recommended)</option>
                <option value="wirepod">WirePod (legacy compatibility)</option>
                <option value="mock">Mock (demo/testing)</option>
              </select>
            </div>
          ) : null}

          {stepIndex === 2 ? (
            <div className="space-y-3">
              <Button variant="outline" onClick={() => void runScan()} disabled={busy}>
                {busy ? "Scanning..." : "Scan for robots"}
              </Button>
              <div className="space-y-2">
                <label htmlFor="serial" className="text-sm font-medium">
                  Serial
                </label>
                <Input id="serial" value={selectedSerial} onChange={(event) => setSelectedSerial(event.target.value)} placeholder="00e20100" />
              </div>
              <div className="space-y-2">
                <label htmlFor="ip" className="text-sm font-medium">
                  IP address
                </label>
                <Input id="ip" value={ipAddress} onChange={(event) => setIpAddress(event.target.value)} placeholder="192.168.1.42" />
              </div>
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Robot name
                </label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              {robots.length ? <p className="text-sm text-muted-foreground">Found: {robots.map((robot) => robot.name).join(", ")}</p> : null}
            </div>
          ) : null}

          {stepIndex === 3 ? <p>Pairing stores your robot details locally so reconnect is one tap.</p> : null}
          {stepIndex === 4 ? <p>Connect now to verify control and status in-app.</p> : null}
          {stepIndex === 5 ? <p>Done. Your robot is ready in the dashboard.</p> : null}

          {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}

          <div className="flex flex-wrap gap-2">
            {stepIndex > 0 ? (
              <Button variant="outline" onClick={() => setStepIndex((current) => Math.max(0, current - 1))}>
                Back
              </Button>
            ) : null}
            {stepIndex < steps.length - 1 ? (
              <Button onClick={() => void continueStep()} disabled={busy || !canProceed}>
                {busy ? "Working..." : "Continue"}
              </Button>
            ) : (
              <Button onClick={() => navigate("/dashboard")}>Open dashboard</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
