import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
          <Label htmlFor="engine-provider">Provider</Label>
          <Select value={provider} onValueChange={(value: "embedded" | "wirepod" | "mock") => setProvider(value)}>
            <SelectTrigger id="engine-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="embedded">Embedded (default)</SelectItem>
              <SelectItem value="wirepod">WirePod (legacy)</SelectItem>
              <SelectItem value="mock">Mock (demo/testing)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => void switchProvider()} disabled={busy}>
          {busy ? "Saving..." : "Switch provider"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
