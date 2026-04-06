import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatModuleName, sortOptionalModuleEntries } from "@/lib/optional-features";
import type { OptionalModules } from "@/types";

interface OptionalModulesCardProps {
  optionalModules: OptionalModules;
}

export function OptionalModulesCard({ optionalModules }: OptionalModulesCardProps) {
  const moduleEntries = sortOptionalModuleEntries(optionalModules);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Optional modules</CardTitle>
        <CardDescription>
          Extra backend capabilities stay centralized here so the app can grow without becoming messy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {moduleEntries.map(([moduleKey, module]) => (
          <div key={moduleKey} className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{formatModuleName(moduleKey)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{module.description}</div>
              </div>
              <div className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {module.enabled ? "Enabled" : "Disabled"}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {module.features.map((feature) => (
                <span
                  key={feature}
                  className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-black)] px-3 py-1 text-xs text-muted-foreground"
                >
                  {feature.replaceAll("_", " ")}
                </span>
              ))}
            </div>

            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {module.endpoints.map((endpoint) => (
                <div
                  key={endpoint}
                  className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] px-3 py-2 font-mono text-xs"
                >
                  {endpoint}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
