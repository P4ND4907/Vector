import { useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLicense } from "@/hooks/useLicense";

const PRO_FEATURES = [
  "Unlimited AI command history",
  "Advanced routine automation",
  "Priority voice processing",
  "Full camera stream access",
  "Custom personality scripting",
  "Early access to new features"
];

interface PremiumModalProps {
  onClose: () => void;
}

export function PremiumModal({ onClose }: PremiumModalProps) {
  const { tier, activate, loading } = useLicense();
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setResult(null);
    const res = await activate(licenseKey.trim());
    setResult(res);
    setActivating(false);
    if (res.success) {
      setLicenseKey("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-muted-foreground hover:bg-[var(--surface-strong)]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Upgrade to Pro</h2>
          {tier === "pro" && (
            <span className="ml-auto rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-200">
              Active
            </span>
          )}
        </div>

        <ul className="mb-5 space-y-2">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-foreground/90">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" />
              {feature}
            </li>
          ))}
        </ul>

        {tier !== "pro" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium">License key</label>
            <Input
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              disabled={activating || loading}
            />

            {result && (
              <div
                className={`rounded-2xl border px-4 py-2 text-sm ${
                  result.success
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-red-400/30 bg-red-400/10 text-red-200"
                }`}
              >
                {result.message}
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => void handleActivate()}
              disabled={activating || loading || !licenseKey.trim()}
            >
              {activating ? "Activating…" : "Activate license"}
            </Button>
          </div>
        )}

        {tier === "pro" && (
          <p className="text-sm text-emerald-300">Your Pro license is active. Enjoy all features!</p>
        )}
      </div>
    </div>
  );
}
