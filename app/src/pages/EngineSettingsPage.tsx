import { useState } from "react";
import { Radio, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EngineStatusCard } from "@/components/engine/EngineStatusCard";
import { useAppStore } from "@/store/useAppStore";

type EngineProvider = "embedded" | "wirepod" | "mock";

const providerOptions: { id: EngineProvider; label: string; note?: string; disabled?: boolean }[] =
  [
    { id: "embedded", label: "Embedded (local)", note: "Not yet implemented.", disabled: true },
    { id: "wirepod", label: "WirePod", note: "Recommended. Requires a running WirePod server." },
    { id: "mock", label: "Mock (demo)", note: "No robot required. Good for testing the UI." }
  ];

export function EngineSettingsPage() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const [selectedProvider, setSelectedProvider] = useState<EngineProvider>("wirepod");
  const [wirepodUrl, setWirepodUrl] = useState(
    settings?.customWirePodEndpoint ?? "http://localhost:8080"
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateSettings({ customWirePodEndpoint: wirepodUrl });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">Engine settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure how Vector Control Hub communicates with your robot.
        </p>
      </div>

      <EngineStatusCard />

      <Card>
        <CardHeader>
          <div className="eyebrow">Provider</div>
          <CardTitle>Engine provider</CardTitle>
          <CardDescription>
            Select which backend handles robot communication. Switching providers requires a restart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {providerOptions.map((opt) => (
            <button
              key={opt.id}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && setSelectedProvider(opt.id)}
              className={`w-full rounded-2xl border p-4 text-left transition-all ${
                opt.disabled
                  ? "cursor-not-allowed opacity-40"
                  : selectedProvider === opt.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-[var(--surface-border)] bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)]"
              }`}
            >
              <div className="text-sm font-semibold">{opt.label}</div>
              {opt.note && <div className="mt-0.5 text-xs text-muted-foreground">{opt.note}</div>}
            </button>
          ))}
        </CardContent>
      </Card>

      {selectedProvider === "wirepod" && (
        <Card>
          <CardHeader>
            <div className="eyebrow">WirePod</div>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              WirePod URL
            </CardTitle>
            <CardDescription>
              Enter the address of your WirePod server (e.g. http://192.168.1.x:8080).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="http://localhost:8080"
              value={wirepodUrl}
              onChange={(e) => setWirepodUrl(e.target.value)}
            />
            <Button onClick={handleSave} disabled={saved}>
              <Save className="h-4 w-4" />
              {saved ? "Saved!" : "Save URL"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
