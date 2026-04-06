import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BrainCircuit,
  Camera,
  Cog,
  Gamepad2,
  Home,
  Mic,
  Radar,
  Sparkles,
  Stethoscope,
  WandSparkles
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const primaryNavItems: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/pairing", label: "Connect", icon: Bot },
  { to: "/drive", label: "Controls", icon: Gamepad2 },
  { to: "/ai", label: "AI", icon: BrainCircuit },
  { to: "/camera", label: "Photos", icon: Camera },
  { to: "/routines", label: "Routines", icon: WandSparkles },
  { to: "/diagnostics", label: "Health", icon: Stethoscope },
  { to: "/settings", label: "Settings", icon: Cog }
];

const secondaryNavItems: NavItem[] = [
  { to: "/speech", label: "Speech", icon: Mic },
  { to: "/animations", label: "Animate", icon: Sparkles },
  { to: "/automation", label: "Roam", icon: Radar }
];

export function DesktopNav() {
  return (
    <Card className="sticky top-4 overflow-hidden">
      <CardHeader>
        <div className="eyebrow">Vector Control Hub</div>
        <CardTitle className="mt-2 text-2xl">Main dashboard</CardTitle>
        <CardDescription>Keep the everyday controls up front and the extra tools tucked away.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                  isActive
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-[var(--surface-border)] bg-[var(--surface-soft)] text-muted-foreground hover:bg-[var(--surface-strong)] hover:text-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <details className="mt-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted-foreground">
            More tools
          </summary>
          <div className="mt-3 space-y-2">
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
                      isActive
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-[var(--surface-border)] bg-[var(--surface-black)] text-muted-foreground hover:bg-[var(--surface-strong)] hover:text-foreground"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function MobileNav() {
  return (
    <nav className="fixed bottom-3 left-1/2 z-20 flex w-[min(96vw,920px)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-card/90 px-3 py-2 backdrop-blur-xl xl:hidden">
      {primaryNavItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex min-w-[72px] shrink-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
