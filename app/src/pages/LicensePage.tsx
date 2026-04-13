import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isProAccessActive } from "@/lib/monetization-access";
import { licenseApi } from "@/services/robotService";
import { useAppStore } from "@/store/useAppStore";
import type { LicenseStatus } from "@/types";

export function LicensePage() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const isPro = isProAccessActive(settings);

  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [activating, setActivating] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [activateNote, setActivateNote] = useState("");
  const [activateError, setActivateError] = useState("");

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const status = await licenseApi.getStatus();
      setLicenseStatus(status);
    } catch (error) {
      setLicenseStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleActivate = async () => {
    if (!keyInput.trim()) {
      setActivateError("Please enter a license key.");
      return;
    }
    setActivating(true);
    setActivateNote("");
    setActivateError("");
    try {
      const result = await licenseApi.activate(keyInput.trim(), emailInput.trim() || undefined);
      setActivateNote(result.note);
      if (result.success && result.tier === "pro") {
        // Sync the frontend planAccess so Pro features unlock immediately.
        await updateSettings({ planAccess: "pro" });
      }
      await fetchStatus();
      setKeyInput("");
      setEmailInput("");
    } catch (error) {
      setActivateError(error instanceof Error ? error.message : "Activation failed. Check the key and try again.");
    } finally {
      setActivating(false);
    }
  };

  const tierBadge = licenseStatus?.tier === "pro" ? (
    <Badge className="border-primary/30 bg-primary/10 text-primary">Companion Pro</Badge>
  ) : (
    <Badge className="border-[var(--surface-border)] bg-[var(--surface-ghost)]">Free</Badge>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <div className="eyebrow">License</div>
            {licenseStatus && tierBadge}
            {isPro && <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Unlocked</Badge>}
          </div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            License &amp; Pro Access
          </CardTitle>
          <CardDescription>
            Activate a license key to unlock Companion Pro features. Keys are stored locally on this
            device and never sent to third-party servers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <p className="text-sm text-muted-foreground">Checking license status…</p>
          ) : licenseStatus ? (
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <span>{licenseStatus.active ? "Active" : "Inactive"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Tier:</span>
                <span className="capitalize">{licenseStatus.tier}</span>
              </div>
              {licenseStatus.activatedAt && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Activated:</span>
                  <span>{new Date(licenseStatus.activatedAt).toLocaleDateString()}</span>
                </div>
              )}
              {licenseStatus.email && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{licenseStatus.email}</span>
                </div>
              )}
              <p className="mt-2 text-muted-foreground">{licenseStatus.note}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Could not retrieve license status from the server.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Activation form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Activate a license key
          </CardTitle>
          <CardDescription>
            Enter your Companion Pro key below. Keys follow the format{" "}
            <code className="rounded bg-white/10 px-1 text-xs">VCH-PRO-xxxxxxxxxxxx</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">License key</label>
            <Input
              placeholder="VCH-PRO-xxxxxxxxxxxx"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
              disabled={activating}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email (optional)</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              disabled={activating}
            />
          </div>
          {activateNote && (
            <p className="text-sm text-emerald-300">{activateNote}</p>
          )}
          {activateError && (
            <p className="text-sm text-red-400">{activateError}</p>
          )}
          <Button onClick={() => void handleActivate()} disabled={activating || !keyInput.trim()}>
            {activating ? "Activating…" : "Activate key"}
          </Button>
        </CardContent>
      </Card>

      {/* Pro feature summary */}
      <Card className="border-primary/20 bg-primary/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            What Pro unlocks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold">Free keeps</div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>Manual controls, repair tools, and robot status</li>
                <li>Basic pairing and reconnect flow</li>
                <li>Diagnostics and voice basics</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.08] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Companion Pro adds
              </div>
              <ul className="mt-3 space-y-1 text-sm text-foreground/85">
                <li>Autonomous patrol and roam automation</li>
                <li>Premium face and animation packs</li>
                <li>Advanced routines and scheduling</li>
                <li>Priority support access</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
