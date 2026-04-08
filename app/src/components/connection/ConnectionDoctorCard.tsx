import { Activity, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConnectionDoctorActionId, ConnectionDoctorGuide } from "@/lib/connection-doctor";

const toneClassName: Record<ConnectionDoctorGuide["tone"], string> = {
  healthy: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  info: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  attention: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  critical: "border-red-400/20 bg-red-400/10 text-red-100"
};

const toneIcon = {
  healthy: CheckCircle2,
  info: Sparkles,
  attention: AlertTriangle,
  critical: Activity
} as const;

export function ConnectionDoctorCard({
  guide,
  onAction,
  compact = false,
  className
}: {
  guide: ConnectionDoctorGuide;
  onAction: (actionId: ConnectionDoctorActionId) => void;
  compact?: boolean;
  className?: string;
}) {
  const ToneIcon = toneIcon[guide.tone];

  return (
    <Card className={className}>
      <CardHeader>
        <div className="eyebrow">{guide.eyebrow}</div>
        <CardTitle>{guide.title}</CardTitle>
        <CardDescription>{guide.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-3xl border p-4 ${toneClassName[guide.tone]}`}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
            <ToneIcon className="h-3.5 w-3.5" />
            Current blocker
          </div>
          <p className="mt-2 text-sm text-current/95">{guide.detail}</p>
          <p className="mt-2 text-xs text-current/80">{guide.statusLine}</p>
        </div>

        <div className="space-y-3">
          {guide.steps.map((step, index) => (
            <div key={step} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-semibold text-foreground/80">
                {index + 1}
              </div>
              <p className="text-sm text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {guide.actions.map((action, index) => (
            <Button
              key={action.id}
              variant={action.variant ?? (index === 0 ? "default" : "outline")}
              size={compact ? "sm" : "default"}
              onClick={() => onAction(action.id)}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {!compact ? (
          <div className="flex flex-wrap gap-2">
            <Badge className={toneClassName[guide.tone]}>{guide.stage.replaceAll("-", " ")}</Badge>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
