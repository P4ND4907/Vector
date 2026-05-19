import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEngineStatus } from "@/hooks/useEngineStatus";

export function EngineStatusCard() {
  const { status, loading, error, refresh } = useEngineStatus();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engine status</CardTitle>
        <CardDescription>Quick check for the app connection layer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          Mode: <span className="font-semibold capitalize">{status?.provider ?? "unknown"}</span>
        </div>
        <div>
          Status: <span className="font-semibold">{status?.health.ok ? "Ready" : "Needs attention"}</span>
        </div>
        <p className="text-muted-foreground">{status?.health.note ?? status?.integration.note ?? "Checking engine..."}</p>
        {error ? <p className="text-destructive">{error}</p> : null}
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh health"}
        </Button>
      </CardContent>
    </Card>
  );
}
