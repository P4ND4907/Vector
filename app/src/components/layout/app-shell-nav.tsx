import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  Bot,
  BrainCircuit,
  Camera,
  Cog,
  Gamepad2,
  Home,
  KeyRound,
  Menu,
  Mic,
  Radar,
  Sparkles,
  Stethoscope,
  WandSparkles
} from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  mobileLabel?: string;
  description?: string;
}

const primaryNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", mobileLabel: "Home", icon: Home, description: "Main status and fastest controls." },
  { to: "/pairing", label: "Connect", icon: Bot, description: "Pair, switch, or reconnect a robot." },
  { to: "/drive", label: "Controls", icon: Gamepad2, description: "Drive, dock, and move Vector." },
  { to: "/ai", label: "AI", icon: BrainCircuit, description: "Typed commands, previews, and teaching." },
  { to: "/camera", label: "Photos", icon: Camera, description: "Photos and camera tools." },
  { to: "/routines", label: "Routines", icon: WandSparkles, description: "Saved routines and quick actions." },
  { to: "/diagnostics", label: "Health", icon: Stethoscope, description: "Diagnostics and repair tools." },
  { to: "/settings", label: "Settings", icon: Cog, description: "Backend, theme, and app setup." }
];

const secondaryNavItems: NavItem[] = [
  { to: "/upgrade", label: "Upgrade", icon: BadgeDollarSign, description: "Plans, checkout hooks, and revenue setup." },
  { to: "/license", label: "License", icon: KeyRound, description: "Activate a Pro license key." },
  { to: "/speech", label: "Speech", icon: Mic, description: "Speech and voice tools." },
  { to: "/animations", label: "Animate", icon: Sparkles, description: "Animations and face cues." },
  { to: "/automation", label: "Roam", icon: Radar, description: "Autonomous behavior controls." }
];

const mobilePrimaryNavItems: NavItem[] = [
  primaryNavItems[0],
  primaryNavItems[1],
  primaryNavItems[2],
  primaryNavItems[3]
];

const mobileMoreNavItems: NavItem[] = [
  primaryNavItems[4],
  primaryNavItems[5],
  primaryNavItems[6],
  primaryNavItems[7],
  ...secondaryNavItems
];

const allNavItems = [...primaryNavItems, ...secondaryNavItems];

export function getRouteMeta(pathname: string) {
  return allNavItems.find((item) => item.to === pathname) ?? null;
}

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
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const activeRoute = useMemo(() => getRouteMeta(location.pathname), [location.pathname]);
  const moreActive = useMemo(
    () => mobileMoreNavItems.some((item) => item.to === location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          aria-label="Close mobile menu"
          className="fixed inset-0 z-20 bg-black/45 xl:hidden"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      {moreOpen ? (
        <div className="fixed inset-x-4 bottom-24 z-30 rounded-[28px] border border-white/10 bg-card/96 p-4 shadow-[0_24px_80px_rgba(1,8,20,0.55)] backdrop-blur-xl xl:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow">More tools</div>
              <div className="mt-2 text-lg font-semibold">
                {activeRoute?.label ? `${activeRoute.label} is open` : "Jump where you need"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep the dashboard and core controls on the main bar. Everything else lives here.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setMoreOpen(false)}>
              Close
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {mobileMoreNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-3xl border px-4 py-3",
                      isActive
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-[var(--surface-border)] bg-[var(--surface-soft)] text-muted-foreground"
                    )
                  }
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.description}</div>
                </NavLink>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav className="fixed bottom-3 left-1/2 z-20 w-[min(96vw,920px)] -translate-x-1/2 rounded-[28px] border border-white/10 bg-card/92 px-2 py-2 backdrop-blur-xl xl:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.mobileLabel ?? item.label}
              </NavLink>
            );
          })}

          <button
            type="button"
            className={cn(
              "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors",
              moreActive || moreOpen ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <Menu className="h-4 w-4" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}

export function MobilePageHeader() {
  const location = useLocation();
  const route = getRouteMeta(location.pathname);
  const isDashboard = location.pathname === "/dashboard";
  const isPairing = location.pathname === "/pairing";

  return (
    <div className="xl:hidden">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-4 py-3">
        <div className="min-w-0">
          <div className="eyebrow">Mobile view</div>
          <div className="mt-1 truncate text-lg font-semibold">
            {route?.label ?? "Vector Companion"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {route?.description ?? "Keep the main dashboard one tap away while you move around the app."}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isDashboard ? (
            <>
              <Link to="/pairing">
                <Button variant="outline" size="sm">
                  Connect
                </Button>
              </Link>
              <Link to="/settings">
                <Button variant="outline" size="sm">
                  Settings
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
              {!isPairing ? (
                <Link to="/pairing">
                  <Button variant="outline" size="sm">
                    Connect
                  </Button>
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
