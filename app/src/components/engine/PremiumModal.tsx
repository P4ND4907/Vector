import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>
            Pro unlocks advanced controls, automation, priority diagnostics, and upcoming remote access.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>Simple pricing: Pro starts at $4.99/month. You can activate with a local license key now.</p>
          <Input value={key} onChange={(event) => setKey(event.target.value)} placeholder="VEC-PRO-XXXXXXXX" />
          {message ? <p className="text-muted-foreground">{message}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Later
          </Button>
          <Button onClick={() => void activate()} disabled={busy}>
            {busy ? "Activating..." : "Activate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
