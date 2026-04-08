import { LockKeyhole, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  getAccessTierLabel,
  getPremiumFeatureCopy,
  isProAccessActive,
  type PremiumFeatureArea
} from "@/lib/monetization-access";
import { useAppStore } from "@/store/useAppStore";

export function FeatureGateCard({
  feature,
  className
}: {
  feature: PremiumFeatureArea;
  className?: string;
}) {
  const navigate = useNavigate();
  const settings = useAppStore((state) => state.settings);
  const copy = getPremiumFeatureCopy(feature);
  const currentTier = getAccessTierLabel(settings.planAccess);

  return (
    <Card className={cn("border-primary/20 bg-primary/[0.06]", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="eyebrow">{copy.eyebrow}</div>
          <Badge>{currentTier}</Badge>
          {isProAccessActive(settings) ? <Badge>Unlocked</Badge> : <Badge>Upgrade to unlock</Badge>}
        </div>
        <CardTitle className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4 text-primary" />
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm font-semibold">Free keeps</div>
            <div className="mt-3 space-y-2">
              {copy.freeHighlights.map((item) => (
                <div key={item} className="text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.08] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Companion Pro adds
            </div>
            <div className="mt-3 space-y-2">
              {copy.proHighlights.map((item) => (
                <div key={item} className="text-sm text-foreground/85">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate("/upgrade")}>Open Upgrade</Button>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
