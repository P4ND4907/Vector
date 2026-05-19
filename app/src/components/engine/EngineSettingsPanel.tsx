import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { patchJson, postJson } from "@/services/apiClient";

export function EngineSettingsPanel() {
  const [provider, setProvider] = useState<"embedded" | "direct" | "wirepod" | "mock">("embedded");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const switchProvider = async () => {
    setBusy(true);
    setMessage("");
    try {
      await postJson("/api/engine/provider", { provider }, "Provider switch failed.");
      await patchJson(
        "/api/engine/settings",
        {
          bridgeProviderPreference: provider === "mock" ? "embedded" : provider,
          mockMode: provider === "mock"
        },
        "Engine settings update failed."
      );
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
        <CardTitle>Advanced engine settings</CardTitle>
        <CardDescription>Most users should leave this on Automatic.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label htmlFor="engine-provider" className="text-sm font-medium">
            Mode
          </label>
          <select
            id="engine-provider"
            value={provider}
            onChange={(event) => setProvider(event.target.value as "embedded" | "direct" | "wirepod" | "mock")}
            className="w-full rounded-md border border-[var(--surface-border)] bg-background px-3 py-2 text-sm"
          >
            <option value="embedded">Automatic (default)</option>
            <option value="direct">Direct phone mode</option>
            <option value="wirepod">Legacy compatibility</option>
            <option value="mock">Demo mode</option>
          </select>
        </div>
        <Button onClick={() => void switchProvider()} disabled={busy}>
          {busy ? "Saving..." : "Save mode"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
