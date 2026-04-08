import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatFeatureFlagName } from "@/lib/optional-features";
import type { FeatureFlags, OptionalFeatureListItem } from "@/types";

interface FeatureAvailabilityCardProps {
  optionalFeatureList: OptionalFeatureListItem[];
  featureFlags: FeatureFlags;
}

export function FeatureAvailabilityCard({
  optionalFeatureList,
  featureFlags
}: FeatureAvailabilityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature availability</CardTitle>
        <CardDescription>
          A plain-English view of what is ready now, what is layered on top of the local bridge, and what still depends on the current stack.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {optionalFeatureList.map((feature) => (
            <div
              key={feature.name}
              className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{feature.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{feature.value}</div>
                </div>
                <div className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {feature.enabled ? "Ready" : "Stack-dependent"}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
          <div className="text-sm font-semibold">Feature flags</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(featureFlags).map(([flag, enabled]) => (
              <span
                key={flag}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs tracking-[0.08em]",
                  enabled
                    ? "border-primary/30 bg-primary/12 text-foreground"
                    : "border-[var(--surface-border)] bg-[var(--surface-black)] text-muted-foreground"
                )}
              >
                {formatFeatureFlagName(flag)}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
