import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WirePodSetupStatus } from "@/types";

interface StartupSetupCardProps {
  setup?: WirePodSetupStatus | null;
  wirePodReachable: boolean;
  mockMode: boolean;
  mobileRuntimeNeedsBackend?: boolean;
  loading: boolean;
  onFinishSetup: () => void;
  onOpenPairingPortal: () => void;
}

export function StartupSetupCard({
  setup,
  wirePodReachable,
  mockMode,
  mobileRuntimeNeedsBackend = false,
  loading,
  onFinishSetup,
  onOpenPairingPortal
}: StartupSetupCardProps) {
  const title = setup?.initialSetupComplete ? "Local setup is ready" : "Local setup still needs one pass";
  const description = setup
    ? setup.initialSetupComplete
      ? `WirePod is set to ${setup.connectionMode === "escape-pod" ? "Escape Pod" : "IP"} mode with ${setup.sttLanguage}.`
      : "The app can apply the default WirePod setup for you: English (US) plus Escape Pod mode."
    : "Once WirePod answers, the app can check whether the one-time local setup is already done.";
  const pairingHint = setup?.needsRobotPairing
    ? "Vector still needs the one-time Bluetooth and Wi-Fi handshake. That part still happens through the local pairing portal, but the rest of the setup can stay here."
    : "If no robot shows up after local setup finishes, open the pairing portal once to complete the first-time robot handshake.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup inside the app</CardTitle>
        <CardDescription>
          The dashboard can now handle the easy local WirePod defaults for you and only hands you off for the one robot-side pairing step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm font-semibold">{title}</div>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={onFinishSetup}
            disabled={!wirePodReachable || loading || mockMode}
          >
            <RefreshCw className="h-4 w-4" />
            {loading
              ? "Finishing local setup..."
              : setup?.initialSetupComplete
                ? "Re-apply local setup defaults"
                : "Finish local setup automatically"}
          </Button>
          <Button
            variant="ghost"
            onClick={onOpenPairingPortal}
            disabled={!wirePodReachable || mockMode}
          >
            <ExternalLink className="h-4 w-4" />
            Open robot pairing portal
          </Button>
        </div>

        <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
          {pairingHint}
        </div>
        {mobileRuntimeNeedsBackend ? (
          <div className="rounded-2xl border border-dashed border-sky-400/20 bg-sky-400/6 p-4 text-sm text-muted-foreground">
            On phones, save the desktop backend URL first in Settings. The pairing portal and local setup buttons only start working after the mobile shell can reach your LAN backend.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
