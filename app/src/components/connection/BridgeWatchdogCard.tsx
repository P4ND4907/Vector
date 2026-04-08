import { AlertTriangle, CheckCircle2, LifeBuoy, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BridgeWatchdogStatus } from "@/types";

const toneClassName: Record<BridgeWatchdogStatus["overallStatus"], string> = {
  healthy: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  attention: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  critical: "border-red-400/20 bg-red-400/10 text-red-100"
};

const toneIcon = {
  healthy: CheckCircle2,
  attention: AlertTriangle,
  critical: LifeBuoy
} as const;

export function BridgeWatchdogCard({
  watchdog,
  loading = false,
  onRecover,
  onRetry,
  compact = false
}: {
  watchdog?: BridgeWatchdogStatus;
  loading?: boolean;
  onRecover?: () => void;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (!watchdog && !loading) {
    return null;
  }

  const ToneIcon = toneIcon[watchdog?.overallStatus ?? "attention"];

  return (
    <Card>
      <CardHeader>
        <div className="eyebrow">Bridge watchdog</div>
        <CardTitle>Catch bridge instability before it turns into guesswork.</CardTitle>
        <CardDescription>
          This watches for reconnect loops and `connTimer` drops so recovery can stay focused.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-3xl border p-4 ${toneClassName[watchdog?.overallStatus ?? "attention"]}`}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
            <ToneIcon className="h-3.5 w-3.5" />
            Current bridge health
          </div>
          <p className="mt-2 text-sm text-current/95">
            {loading && !watchdog ? "Checking the live bridge session..." : watchdog?.summary}
          </p>
          <p className="mt-2 text-xs text-current/80">
            {watchdog?.recommendedAction || "A recovery suggestion will appear here when the watchdog sees a pattern."}
          </p>
        </div>

        {watchdog ? (
          <div className="flex flex-wrap gap-2">
            <Badge className={toneClassName[watchdog.overallStatus]}>{watchdog.issueCode.replaceAll("-", " ")}</Badge>
            <Badge>{watchdog.connTimerEvents} connTimer</Badge>
            <Badge>{watchdog.reconnectEvents} reconnects</Badge>
          </div>
        ) : null}

        {watchdog?.recentEvidence?.length ? (
          <div className="space-y-3">
            {watchdog.recentEvidence.slice(0, compact ? 2 : 3).map((evidence) => (
              <div key={evidence} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
                {evidence}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {onRecover ? (
            <Button size={compact ? "sm" : "default"} onClick={onRecover} disabled={loading}>
              <LifeBuoy className="h-4 w-4" />
              {watchdog?.autoRecoveryLikelyHelpful ? "Auto-recover now" : "Try recovery"}
            </Button>
          ) : null}
          {onRetry ? (
            <Button size={compact ? "sm" : "default"} variant="outline" onClick={onRetry} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Retry connection
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
