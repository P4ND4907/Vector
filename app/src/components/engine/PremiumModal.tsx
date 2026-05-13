import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getJson, postJson } from "@/services/apiClient";

interface LicensePayload {
  license: {
    key: string;
    activated: boolean;
    createdAt: string;
    expiresAt?: string;
    tier: "free" | "pro";
  };
}

interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivated?: () => void;
}

export function PremiumModal({ open, onOpenChange, onActivated }: PremiumModalProps) {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    setMessage("");
    try {
      await postJson<LicensePayload>("/api/engine/license/activate", { key }, "License activation failed.");
      const status = await getJson<LicensePayload>("/api/engine/license/status", "License status could not be loaded.");
      if (status.license.tier === "pro" && status.license.activated) {
        setMessage("Pro is active on this device.");
        onActivated?.();
      } else {
        setMessage("License activated, but this key enables the free tier only.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "License activation failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Upgrade to Pro</CardTitle>
          <CardDescription>
            Pro unlocks advanced controls, automation, priority diagnostics, and upcoming remote access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Simple pricing: Pro starts at $4.99/month. You can activate with a local license key now.</p>
          <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="VEC-PRO-XXXXXXXX" />
          {message ? <p className="text-muted-foreground">{message}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Later
            </Button>
            <Button onClick={() => void activate()} disabled={busy}>
              {busy ? "Activating..." : "Activate"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
