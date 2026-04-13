import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BridgeWatchdogCard } from "@/components/connection/BridgeWatchdogCard";
import { robotService } from "@/services/robotService";
import { useAppStore } from "@/store/useAppStore";
import type { BridgeWatchdogStatus, RepairResult } from "@/types";

const repairStatusTone: Record<RepairResult["overallStatus"], string> = {
  repaired: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  partial: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  failed: "border-red-400/30 bg-red-400/10 text-red-100"
};

const stepTone: Record<"success" | "warn" | "fail", string> = {
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  fail: "border-red-400/30 bg-red-400/10 text-red-100"
};

export function RepairToolsPage() {
  const quickRepair = useAppStore((state) => state.quickRepair);
  const supportReports = useAppStore((state) => state.supportReports);
  const supportState = useAppStore((state) => state.actionStates.support);
  const snapshot = useAppStore((state) => state);

  const [watchdog, setWatchdog] = useState<BridgeWatchdogStatus | undefined>(undefined);
  const [watchdogLoading, setWatchdogLoading] = useState(false);
  const [watchdogError, setWatchdogError] = useState<string | null>(null);

  const repairRunning = supportState.status === "loading";
  const latestRepair = supportReports[0]?.repairResult;

  const loadWatchdog = async () => {
    setWatchdogLoading(true);
    setWatchdogError(null);
    try {
      const status = await robotService.getBridgeWatchdog(snapshot);
      setWatchdog(status);
    } catch (err) {
      setWatchdogError(err instanceof Error ? err.message : "Failed to load watchdog status");
    } finally {
      setWatchdogLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">Repair tools</h1>
        <p className="text-sm text-muted-foreground">
          Diagnose and recover from common Vector connectivity issues.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="eyebrow">Quick repair</div>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            Run quick repair
          </CardTitle>
          <CardDescription>
            Runs a guided recovery sequence to reset the bridge session and re-establish the robot
            connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => void quickRepair()} disabled={repairRunning}>
            <Activity className={`h-4 w-4 ${repairRunning ? "animate-pulse" : ""}`} />
            {repairRunning ? "Repairing…" : "Start quick repair"}
          </Button>

          {supportState.status === "error" && supportState.message && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {supportState.message}
            </div>
          )}

          {latestRepair && (
            <div className="space-y-3">
              <div className={`rounded-2xl border p-4 ${repairStatusTone[latestRepair.overallStatus]}`}>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {latestRepair.overallStatus}
                </div>
                <p className="mt-2 text-sm">{latestRepair.summary}</p>
              </div>

              {latestRepair.steps.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Steps
                  </div>
                  {latestRepair.steps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm ${stepTone[step.status]}`}
                    >
                      {step.status === "success" ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div>
                        <div className="font-medium">{step.label}</div>
                        {step.details && (
                          <div className="mt-0.5 text-xs opacity-80">{step.details}</div>
                        )}
                      </div>
                      <Badge className={`ml-auto ${stepTone[step.status]}`}>{step.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="eyebrow">Bridge watchdog</div>
          <CardTitle>Connection health</CardTitle>
          <CardDescription>
            Check the bridge watchdog to see live connection stability metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            onClick={() => void loadWatchdog()}
            disabled={watchdogLoading}
          >
            <RefreshCw className={`h-4 w-4 ${watchdogLoading ? "animate-spin" : ""}`} />
            {watchdogLoading ? "Loading…" : "Check bridge status"}
          </Button>

          {watchdogError && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {watchdogError}
            </div>
          )}

          {(watchdog ?? watchdogLoading) && (
            <BridgeWatchdogCard
              watchdog={watchdog}
              loading={watchdogLoading}
              onRecover={() => void quickRepair()}
              onRetry={() => void loadWatchdog()}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="eyebrow">History</div>
          <CardTitle>Recent repair reports</CardTitle>
          <CardDescription>
            Repair results saved after each run. Check the Diagnostics page for full details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {supportReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No repair reports yet. Run a quick repair to generate one.
            </p>
          ) : (
            <div className="space-y-2">
              {supportReports.slice(0, 3).map((report) => (
                <div
                  key={report.id}
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    repairStatusTone[report.repairResult.overallStatus]
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{report.repairResult.overallStatus}</span>
                    <span className="text-xs opacity-70">
                      {new Date(report.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 opacity-90">{report.repairResult.summary}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
