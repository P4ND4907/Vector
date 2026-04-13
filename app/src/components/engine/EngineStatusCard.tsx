import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEngineStatus } from "@/hooks/useEngineStatus";

const providerLabel: Record<"embedded" | "wirepod" | "mock", string> = {
  embedded: "Embedded (local)",
  wirepod: "WirePod",
  mock: "Mock (demo)"
};

export function EngineStatusCard() {
  const { provider, available, connected, note, protocolGaps, loading, error, refresh } =
    useEngineStatus();

  return (
    <Card>
      <CardHeader>
        <div className="eyebrow">Engine</div>
        <CardTitle>Engine status</CardTitle>
        <CardDescription>Current robot communication backend</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !error && (
          <p className="text-sm text-muted-foreground">Checking engine status…</p>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{providerLabel[provider]}</Badge>
              <Badge
                className={
                  connected
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                    : "border-red-400/30 bg-red-400/10 text-red-200"
                }
              >
                {connected ? (
                  <CheckCircle2 className="mr-1 inline h-3 w-3" />
                ) : (
                  <XCircle className="mr-1 inline h-3 w-3" />
                )}
                {connected ? "Connected" : "Disconnected"}
              </Badge>
              <Badge
                className={
                  available
                    ? "border-teal-400/30 bg-teal-400/10 text-teal-200"
                    : "border-amber-300/30 bg-amber-300/10 text-amber-100"
                }
              >
                {available ? "Available" : "Unavailable"}
              </Badge>
            </div>

            {note && <p className="text-sm text-muted-foreground">{note}</p>}

            {protocolGaps.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Protocol gaps
                </div>
                <ul className="space-y-1">
                  {protocolGaps.map((gap) => (
                    <li
                      key={gap}
                      className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-100"
                    >
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}
