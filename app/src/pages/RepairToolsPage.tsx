import { useState } from "react";
import { EngineSettingsPanel } from "@/components/engine/EngineSettingsPanel";
import { EngineStatusCard } from "@/components/engine/EngineStatusCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { postJson } from "@/services/apiClient";

const actions = [
  { key: "refresh-health", label: "Refresh health" },
  { key: "scan-again", label: "Scan again" },
  { key: "reconnect", label: "Reconnect" },
  { key: "disconnect", label: "Disconnect" },
  { key: "clear-robot", label: "Clear robot" },
  { key: "reset-settings", label: "Reset settings" }
] as const;

export function RepairToolsPage() {
  const [diagnostics, setDiagnostics] = useState<string>("");
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string>("");

  const runAction = async (key: (typeof actions)[number]["key"]) => {
    setBusyAction(key);
    setMessage("");
    try {
      await postJson(`/api/engine/repair/${key}`, {}, "Repair action failed.");
      setMessage(`${actions.find((item) => item.key === key)?.label} completed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Repair action failed.");
    } finally {
      setBusyAction("");
    }
  };

  const refreshDiagnostics = async () => {
    setBusyAction("diagnostics");
    setMessage("");
    try {
      const payload = await postJson<{ report: { summary: string; overallStatus: string } }>(
        "/api/engine/diagnostics/run",
        {},
        "Diagnostics could not run."
      );
      setDiagnostics(`${payload.report.overallStatus}: ${payload.report.summary}`);
    } catch (error) {
      setDiagnostics(error instanceof Error ? error.message : "Diagnostics could not run.");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="space-y-4">
      <EngineStatusCard />
      <EngineSettingsPanel />

      <Card>
        <CardHeader>
          <CardTitle>Repair tools</CardTitle>
          <CardDescription>Run in-app recovery actions and view diagnostics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.key}
                variant="outline"
                onClick={() => void runAction(action.key)}
                disabled={busyAction === action.key}
              >
                {busyAction === action.key ? "Working..." : action.label}
              </Button>
            ))}
            <Button onClick={() => void refreshDiagnostics()} disabled={busyAction === "diagnostics"}>
              {busyAction === "diagnostics" ? "Running..." : "Diagnostics display"}
            </Button>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          {diagnostics ? <p className="text-sm text-muted-foreground">{diagnostics}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
