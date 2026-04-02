import { useEffect, useState, type ChangeEvent } from "react";
import { Bot, Download, MoonStar, RotateCcw, SunMedium, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Range } from "@/components/ui/range";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { themePresets } from "@/lib/themes";
import { useAppStore } from "@/store/useAppStore";

const downloadText = (filename: string, text: string) => {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings);
  const integration = useAppStore((state) => state.integration);
  const logs = useAppStore((state) => state.logs);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const exportState = useAppStore((state) => state.exportState);
  const importState = useAppStore((state) => state.importState);
  const clearLogs = useAppStore((state) => state.clearLogs);

  const [customEndpoint, setCustomEndpoint] = useState(settings.customWirePodEndpoint);
  const [robotSerial, setRobotSerial] = useState(settings.robotSerial);

  useEffect(() => {
    setCustomEndpoint(settings.customWirePodEndpoint);
    setRobotSerial(settings.robotSerial);
  }, [settings.customWirePodEndpoint, settings.robotSerial]);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    importState(JSON.parse(text));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <div className="eyebrow">Settings</div>
          <CardTitle>Make WirePod invisible while keeping control in one place.</CardTitle>
          <CardDescription>
            Endpoint detection, serial targeting, mock mode, reconnect behavior, and UI preferences all live here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
              <div className="text-sm text-muted-foreground">Current endpoint</div>
              <div className="mt-2 text-lg font-semibold">{integration.wirePodBaseUrl}</div>
              <p className="mt-2 text-sm text-muted-foreground">{integration.note || "No endpoint note yet."}</p>
            </div>
            <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
              <div className="text-sm text-muted-foreground">Selected serial</div>
              <div className="mt-2 text-lg font-semibold">{integration.selectedSerial || settings.robotSerial || "Not set"}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {integration.robotReachable ? "Robot responds on local Wi-Fi." : "Save a serial so reconnect stays targeted."}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Robot nickname</label>
            <Input
              value={settings.robotNickname}
              onChange={(event) => void updateSettings({ robotNickname: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Custom WirePod endpoint override</label>
            <Input
              value={customEndpoint}
              placeholder="http://192.168.x.x:8080"
              onChange={(event) => setCustomEndpoint(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void updateSettings({ customWirePodEndpoint: customEndpoint })}
              >
                Save endpoint override
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCustomEndpoint("");
                  void updateSettings({ customWirePodEndpoint: "" });
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Clear override
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Robot serial</label>
            <Input
              value={robotSerial}
              placeholder="00305a8c"
              onChange={(event) => setRobotSerial(event.target.value)}
            />
            <Button onClick={() => void updateSettings({ robotSerial })}>Save serial</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Auto-detect WirePod</div>
                  <div className="text-xs text-muted-foreground">Try the default local endpoints automatically.</div>
                </div>
                <Switch
                  checked={settings.autoDetectWirePod}
                  onCheckedChange={(checked) => void updateSettings({ autoDetectWirePod: checked })}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Reconnect on startup</div>
                  <div className="text-xs text-muted-foreground">Restore the last robot target automatically.</div>
                </div>
                <Switch
                  checked={settings.reconnectOnStartup}
                  onCheckedChange={(checked) => void updateSettings({ reconnectOnStartup: checked, autoReconnect: checked })}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Mock mode</div>
                  <div className="text-xs text-muted-foreground">Keep the app testable without WirePod or the robot.</div>
                </div>
                <Switch
                  checked={settings.mockMode}
                  onCheckedChange={(checked) => void updateSettings({ mockMode: checked })}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
              <div className="text-sm font-semibold">Interface mode</div>
              <div className="mt-1 text-xs text-muted-foreground">Pick a dark or light base, then layer a palette on top.</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition",
                    settings.theme === "dark"
                      ? "border-primary/50 bg-primary/12"
                      : "border-[var(--surface-border)] bg-[var(--surface-black)] hover:border-primary/30"
                  )}
                  onClick={() => void updateSettings({ theme: "dark" })}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <MoonStar className="h-4 w-4 text-primary" />
                    Dark
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Best for the current control-room layout.</div>
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left transition",
                    settings.theme === "light"
                      ? "border-primary/50 bg-primary/12"
                      : "border-[var(--surface-border)] bg-[var(--surface-black)] hover:border-primary/30"
                  )}
                  onClick={() => void updateSettings({ theme: "light" })}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <SunMedium className="h-4 w-4 text-primary" />
                    Light
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Cleaner contrast if you want a brighter dashboard.</div>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
            <div className="text-sm font-semibold">Color palette</div>
            <div className="mt-1 text-xs text-muted-foreground">Vector is now the default, but you can switch the whole accent system here.</div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {themePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    settings.colorTheme === preset.id
                      ? "border-primary/50 bg-primary/12"
                      : "border-[var(--surface-border)] bg-[var(--surface-black)] hover:border-primary/30"
                  )}
                  onClick={() => void updateSettings({ colorTheme: preset.id })}
                >
                  <div className="flex gap-2">
                    {preset.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="h-4 w-4 rounded-full border border-[var(--surface-border)]"
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 font-semibold">{preset.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Polling interval</div>
                <div className="text-xs text-muted-foreground">How often the frontend refreshes live robot status.</div>
              </div>
              <div className="text-lg font-semibold">{settings.pollingIntervalMs} ms</div>
            </div>
            <Range
              className="mt-4"
              min={2000}
              max={12000}
              step={500}
              value={settings.pollingIntervalMs}
              onChange={(event) => void updateSettings({ pollingIntervalMs: Number(event.target.value) })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => downloadText("vector-control-hub-settings.json", exportState())}>
              <Download className="h-4 w-4" />
              Export settings
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-semibold">
              <Upload className="h-4 w-4" />
              Import backup
              <input className="hidden" type="file" accept="application/json" onChange={handleImport} />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Startup screen</CardTitle>
            <CardDescription>The app now opens on a dedicated connection screen first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Bot className="h-4 w-4 text-primary" />
                Connect before dashboard
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                On launch, Vector Control Hub now starts on a simple connect screen whose only job is linking to your robot.
              </p>
            </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <MoonStar className="h-4 w-4 text-primary" />
              Theme, palette, reconnect, endpoint, and serial preferences still persist locally.
              </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Log viewer</CardTitle>
            <CardDescription>Backend success and failure messages stay readable in one place.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold capitalize">{log.type}</span>
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{log.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{log.resultMessage}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={clearLogs}>
              Clear logs
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
