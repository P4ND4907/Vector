import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { patchJson, postJson } from "@/services/apiClient";

export function EngineSettingsPanel() {
  const [provider, setProvider] = useState<"embedded" | "wirepod" | "mock">("embedded");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const switchProvider = async () => {
    setBusy(true);
    setMessage("");
    try {
      await postJson("/api/engine/provider", { provider }, "Provider switch failed.");
      await patchJson("/api/engine/settings", { mockMode: provider === "mock" }, "Engine settings update failed.");
      setMessage(`Switched to ${provider} provider.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider switch failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engine settings</CardTitle>
        <CardDescription>Switch provider modes and keep compatibility controls in-app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="engine-provider" className="text-sm font-medium">
            Provider
          </label>
          <select
            id="engine-provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value as "embedded" | "wirepod" | "mock")}
            className="w-full rounded-md border border-[var(--surface-border)] bg-background px-3 py-2 text-sm"
          >
            <option value="embedded">Embedded (default)</option>
            <option value="wirepod">WirePod (legacy)</option>
            <option value="mock">Mock (demo/testing)</option>
          </select>
        </div>
        <Button onClick={() => void switchProvider()} disabled={busy}>
          {busy ? "Saving..." : "Switch provider"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
