import type { ReactNode } from "react";

interface StartupOverviewCardProps {
  title: string;
  icon: ReactNode;
  value: string;
  description: string;
}

export function StartupOverviewCard({ title, icon, value, description }: StartupOverviewCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
