import { useEffect, useState, type ChangeEvent } from "react";
import { BatteryCharging, Bot, Download, Globe, MessageSquareWarning, MoonStar, RotateCcw, Smartphone, SunMedium, Upload, Wrench } from "lucide-react";
import { FeatureAvailabilityCard } from "@/components/settings/FeatureAvailabilityCard";
import { OptionalModulesCard } from "@/components/settings/OptionalModulesCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Range } from "@/components/ui/range";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { getApiBaseUrl } from "@/services/apiClient";
import { getDefaultAppBackendUrl, isMobileShellLikeRuntime } from "@/lib/runtime-target";
import { robotService } from "@/services/robotService";
import { themePresets } from "@/lib/themes";
import { useAppStore } from "@/store/useAppStore";
import type { WirePodWeatherConfig } from "@/types";

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
  const optionalModules = useAppStore((state) => state.optionalModules);
  const optionalFeatureList = useAppStore((state) => state.optionalFeatureList);
  const featureFlags = useAppStore((state) => state.featureFlags);
  const logs = useAppStore((state) => state.logs);
  const supportReports = useAppStore((state) => state.supportReports);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const exportState = useAppStore((state) => state.exportState);
  const importState = useAppStore((state) => state.importState);
  const clearLogs = useAppStore((state) => state.clearLogs);
  const quickRepair = useAppStore((state) => state.quickRepair);
  const reportProblem = useAppStore((state) => state.reportProblem);
  const supportState = useAppStore((state) => state.actionStates.support);

  const [customEndpoint, setCustomEndpoint] = useState(settings.customWirePodEndpoint);
  const [appBackendUrl, setAppBackendUrl] = useState(settings.appBackendUrl);
  const [robotSerial, setRobotSerial] = useState(settings.robotSerial);
  const [problemSummary, setProblemSummary] = useState("");
  const [problemDetails, setProblemDetails] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [weatherConfig, setWeatherConfig] = useState<WirePodWeatherConfig>({
    enable: false,
    provider: "",
    key: "",
    unit: ""
  });
  const [weatherStatus, setWeatherStatus] = useState("Checking WirePod weather setup...");
  const [weatherSaving, setWeatherSaving] = useState(false);

  useEffect(() => {
    setCustomEndpoint(settings.customWirePodEndpoint);
    setAppBackendUrl(settings.appBackendUrl);
    setRobotSerial(settings.robotSerial);
  }, [settings.appBackendUrl, settings.customWirePodEndpoint, settings.robotSerial]);

  useEffect(() => {
    let cancelled = false;

    void robotService
      .getWirePodWeatherConfig()
      .then((config) => {
        if (cancelled) {
          return;
        }

        setWeatherConfig(config);
        setWeatherStatus(
          config.enable
            ? `Wake-word weather is configured through ${config.provider || "your selected provider"}.`
            : "Wake-word weather is off in WirePod, so Vector will say the weather API is not configured."
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setWeatherStatus("WirePod weather settings could not be read right now.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

          <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4 text-primary" />
              Mobile foundation
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              The current desktop app assumes the backend lives on the same machine. This setting lets a future mobile shell point at a desktop or LAN backend like <span className="font-medium text-foreground">http://192.168.x.x:8787</span>.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Current app backend</div>
                <div className="mt-2 break-all text-sm font-semibold">{getApiBaseUrl()}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {isMobileShellLikeRuntime()
                    ? "This runtime looks like a mobile shell, so a manual backend target is expected."
                    : "Desktop and browser launches can still use the automatic same-device backend target."}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Desktop default</div>
                <div className="mt-2 break-all text-sm font-semibold">{getDefaultAppBackendUrl()}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Leave the field blank to keep using the automatic desktop target.
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="text-sm text-muted-foreground">Manual app backend URL</label>
              <Input
                value={appBackendUrl}
                placeholder="http://192.168.x.x:8787"
                onChange={(event) => setAppBackendUrl(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void updateSettings({ appBackendUrl })}>
                <Globe className="h-4 w-4" />
                Save app backend
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAppBackendUrl("");
                  void updateSettings({ appBackendUrl: "" });
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Use desktop default
              </Button>
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

          <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
            <div className="text-sm font-semibold">Voice weather setup</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Typed weather in the app works without an external key. Wake-word weather on Vector still depends on WirePod having a weather provider API key.
            </div>
            <div className="mt-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] px-4 py-3 text-sm text-muted-foreground">
              {weatherStatus}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Provider</label>
                <select
                  className="flex h-11 w-full rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] px-3 text-sm outline-none transition focus:border-primary/60"
                  value={weatherConfig.provider}
                  onChange={(event) =>
                    setWeatherConfig((current) => ({
                      ...current,
                      provider: event.target.value
                    }))
                  }
                >
                  <option value="">Disabled</option>
                  <option value="openweathermap.org">OpenWeatherMap</option>
                  <option value="weatherapi.com">WeatherAPI</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">API key</label>
                <Input
                  type="password"
                  value={weatherConfig.key}
                  placeholder="Paste your weather provider key"
                  onChange={(event) =>
                    setWeatherConfig((current) => ({
                      ...current,
                      key: event.target.value
                    }))
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  setWeatherSaving(true);

                  try {
                    const nextConfig = await robotService.updateWirePodWeatherConfig({
                      provider: weatherConfig.provider,
                      key: weatherConfig.key,
                      unit: weatherConfig.unit
                    });

                    setWeatherConfig(nextConfig);
                    setWeatherStatus(
                      nextConfig.enable
                        ? `Wake-word weather is configured through ${nextConfig.provider || "your selected provider"}.`
                        : "Wake-word weather is off in WirePod, so Vector will say the weather API is not configured."
                    );
                  } catch (error) {
                    setWeatherStatus(
                      error instanceof Error
                        ? error.message
                        : "WirePod weather settings could not be saved."
                    );
                  } finally {
                    setWeatherSaving(false);
                  }
                }}
                disabled={weatherSaving}
              >
                {weatherSaving ? "Saving weather setup..." : "Save weather setup"}
              </Button>
            </div>
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
                  <div className="text-sm font-semibold">Stay connected automatically</div>
                  <div className="text-xs text-muted-foreground">Reconnect on launch and keep retrying if the live robot link drops.</div>
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
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <BatteryCharging className="h-4 w-4 text-primary" />
                    Keep charging until nearly full
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Block wake, drive, roam, and bigger movement routines while Vector is still charging.
                  </div>
                </div>
                <Switch
                  checked={settings.protectChargingUntilFull}
                  onCheckedChange={(checked) => void updateSettings({ protectChargingUntilFull: checked })}
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
                <div className="text-xs text-muted-foreground">How often the frontend refreshes live robot status. Docked and charging checks speed up automatically.</div>
              </div>
              <div className="text-lg font-semibold">{settings.pollingIntervalMs} ms</div>
            </div>
            <Range
              className="mt-4"
              min={1000}
              max={12000}
              step={250}
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
        <FeatureAvailabilityCard
          optionalFeatureList={optionalFeatureList}
          featureFlags={featureFlags}
        />

        <OptionalModulesCard optionalModules={optionalModules} />

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
            <CardTitle>Feedback and support</CardTitle>
            <CardDescription>
              Normal users can report a problem here, and the app will try safe local repairs first before saving the report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4 text-sm text-muted-foreground">
              Quick repair can safely try known local fixes like starting WirePod, refreshing the robot link, and re-applying voice defaults. It will not silently change advanced robot settings or claim a repair worked when it did not.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={quickRepair} disabled={supportState.status === "loading"}>
                <Wrench className="h-4 w-4" />
                {supportState.status === "loading" ? "Running quick repair..." : "Run quick repair"}
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Problem summary</label>
                <Input
                  value={problemSummary}
                  placeholder="Voice commands stopped working after reconnecting."
                  onChange={(event) => setProblemSummary(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">What happened</label>
                <Textarea
                  value={problemDetails}
                  placeholder="Tell the app what you tried, what Vector did, and what you expected."
                  onChange={(event) => setProblemDetails(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Contact email (optional)</label>
                <Input
                  value={contactEmail}
                  placeholder="name@example.com"
                  onChange={(event) => setContactEmail(event.target.value)}
                />
              </div>

              <Button
                onClick={async () => {
                  await reportProblem({
                    summary: problemSummary,
                    details: problemDetails,
                    contactEmail
                  });
                  setProblemSummary("");
                  setProblemDetails("");
                  setContactEmail("");
                }}
                disabled={supportState.status === "loading" || problemSummary.trim().length < 4 || problemDetails.trim().length < 8}
              >
                <MessageSquareWarning className="h-4 w-4" />
                Save problem report and try repair
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {supportState.message ||
                "The app saves reports locally with the latest repair attempt, so issues stay readable instead of disappearing into raw logs."}
            </p>

            <div className="space-y-3">
              {supportReports.length ? (
                supportReports.slice(0, 3).map((report) => (
                  <div key={report.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{report.summary}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{formatTimestamp(report.createdAt)}</div>
                      </div>
                      <div className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {report.repairResult.overallStatus}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{report.repairResult.summary}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-4 text-sm text-muted-foreground">
                  No saved support reports yet.
                </div>
              )}
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
