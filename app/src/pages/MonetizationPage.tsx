import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CreditCard,
  ExternalLink,
  Gift,
  Layers3,
  Mail,
  Rocket,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { getAccessTierLabel } from "@/lib/monetization-access";
import { buildUsageLoopSnapshot } from "@/lib/usage-loop";
import { aiService } from "@/services/aiService";
import { monetizationService } from "@/services/monetizationService";
import { useAppStore } from "@/store/useAppStore";
import type { MonetizationOverview, MonetizationPlan } from "@/types";

const statusToneClasses: Record<MonetizationPlan["status"], string> = {
  live: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  "needs-config": "border-amber-300/20 bg-amber-300/10 text-amber-100",
  "coming-soon": "border-white/10 bg-white/[0.05] text-muted-foreground"
};

const statusLabels: Record<MonetizationPlan["status"], string> = {
  live: "Ready now",
  "needs-config": "Needs setup",
  "coming-soon": "Next up"
};

const fallbackOverviewMessage = "Loading the current revenue path...";

export function MonetizationPage() {
  const [overview, setOverview] = useState<MonetizationOverview | null>(null);
  const [message, setMessage] = useState(fallbackOverviewMessage);
  const [learnedCommandCount, setLearnedCommandCount] = useState(0);
  const [commandGapCount, setCommandGapCount] = useState(0);
  const settings = useAppStore((state) => state.settings);
  const logs = useAppStore((state) => state.logs);
  const aiCommandHistory = useAppStore((state) => state.aiCommandHistory);
  const updateSettings = useAppStore((state) => state.updateSettings);

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async () => {
      setMessage(fallbackOverviewMessage);

      const nextOverview = await monetizationService.getOverview();
      if (cancelled) {
        return;
      }

      setOverview(nextOverview);
      setMessage("");
    };

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUsageSignals = async () => {
      try {
        const [learnedCommands, commandGaps] = await Promise.all([
          aiService.getLearnedCommands(),
          aiService.getCommandGaps()
        ]);

        if (!cancelled) {
          setLearnedCommandCount(learnedCommands.items.length);
          setCommandGapCount(commandGaps.items.length);
        }
      } catch {
        if (!cancelled) {
          setLearnedCommandCount(0);
          setCommandGapCount(0);
        }
      }
    };

    void loadUsageSignals();
    return () => {
      cancelled = true;
    };
  }, [aiCommandHistory.length, logs.length]);

  const canSellNow = useMemo(
    () => Boolean(overview?.status.desktopCheckoutReady && !overview.status.checkoutLockedToDesktop),
    [overview]
  );
  const usageLoop = useMemo(
    () =>
      buildUsageLoopSnapshot({
        aiHistory: aiCommandHistory,
        logs,
        learnedCommandCount,
        commandGapCount,
        planAccess: settings.planAccess
      }),
    [aiCommandHistory, commandGapCount, learnedCommandCount, logs, settings.planAccess]
  );

  const openExternal = (url?: string) => {
    if (!url) {
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openEmail = (email?: string) => {
    if (!email) {
      return;
    }

    window.location.href = `mailto:${email}`;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
      <Card>
        <CardHeader className="space-y-4">
          <div className="eyebrow">Revenue foundation</div>
          <div className="space-y-3">
            <CardTitle className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
              {overview?.headline || "Build the money path into the product."}
            </CardTitle>
            <CardDescription className="max-w-3xl text-base text-muted-foreground">
              {overview?.summary ||
                "Set up desktop and hosted-web checkout first, keep Android Play-safe, and sell premium help before the market gets crowded."}
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge>{canSellNow ? "Desktop/web checkout ready" : "Desktop/web checkout not live yet"}</Badge>
            <Badge>{overview?.status.hostedAdsReady ? "Hosted-web ads ready" : "Hosted-web ads not configured"}</Badge>
            <Badge>{overview?.status.checkoutLockedToDesktop ? "Android checkout locked" : "Desktop/web selling open"}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <MonetizationStatusCard
              title="Desktop and web sales"
              icon={<CreditCard className="h-4 w-4 text-primary" />}
              value={overview?.status.desktopCheckoutReady ? "Ready" : "Waiting"}
              detail={
                overview?.status.desktopCheckoutReady
                  ? "At least one live checkout link is configured for the desktop or hosted-web app."
                  : "Add payment links in the backend env so the app can start selling from desktop and hosted web."
              }
            />

            <MonetizationStatusCard
              title="Android Play path"
              icon={<ShieldCheck className="h-4 w-4 text-primary" />}
              value={overview?.status.checkoutLockedToDesktop ? "Hold here" : "Later"}
              detail="Keep Play safe for now by not pushing external digital checkout from the Android shell until Play billing is ready."
            />

            <MonetizationStatusCard
              title="Fastest money"
              icon={<Rocket className="h-4 w-4 text-primary" />}
              value="Setup service"
              detail="A one-time setup or repair offer is the fastest thing to sell while subscriptions warm up."
            />
          </div>

          <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Device access preview</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Billing is still desktop and hosted-web first, so this device can preview how Free versus Pro behaves before real checkout is wired everywhere.
                </p>
              </div>
              <Badge>{getAccessTierLabel(settings.planAccess)}</Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant={settings.planAccess === "free" ? "default" : "outline"}
                onClick={() => void updateSettings({ planAccess: "free" })}
              >
                Use free mode
              </Button>
              <Button
                variant={settings.planAccess === "pro" ? "default" : "outline"}
                onClick={() => void updateSettings({ planAccess: "pro" })}
              >
                Preview Pro on this device
              </Button>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              Free keeps pairing, reconnect, commands, diagnostics, and basic teach mode open. Pro preview unlocks advanced automation, premium animation packs, and ad-free hosted web behavior.
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <MonetizationValueCard
              title="What stays free"
              icon={<Gift className="h-4 w-4 text-primary" />}
              items={
                overview?.freeKeepsPeople || [
                  "Pairing, reconnect, and diagnostics should stay free.",
                  "Core commands and teach mode should be usable before any upgrade."
                ]
              }
            />
            <MonetizationValueCard
              title="Why Pro is worth it"
              icon={<Sparkles className="h-4 w-4 text-primary" />}
              items={
                overview?.proReasons || [
                  "Pro should save time, remove friction, and add the premium personality layer."
                ]
              }
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className="border-primary/20 bg-primary/[0.05]">
              <CardHeader>
                <CardTitle>Daily-use loop on this device</CardTitle>
                <CardDescription>
                  This is the habit we want Free users to reach before we ever ask them to upgrade.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MonetizationStatusCard
                    title="Recent wins"
                    icon={<Rocket className="h-4 w-4 text-primary" />}
                    value={String(usageLoop.recentWins)}
                    detail="Successful commands in the recent window."
                  />
                  <MonetizationStatusCard
                    title="Current streak"
                    icon={<Sparkles className="h-4 w-4 text-primary" />}
                    value={`${usageLoop.streakDays} day${usageLoop.streakDays === 1 ? "" : "s"}`}
                    detail="Consecutive days with a successful command."
                  />
                  <MonetizationStatusCard
                    title="Taught phrases"
                    icon={<Layers3 className="h-4 w-4 text-primary" />}
                    value={String(usageLoop.taughtPhrases)}
                    detail="Personal shortcuts already learned."
                  />
                  <MonetizationStatusCard
                    title="Missed phrases"
                    icon={<Gift className="h-4 w-4 text-primary" />}
                    value={String(usageLoop.missedPhrases)}
                    detail="Good candidates for the next teach win."
                  />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-muted-foreground">
                  {usageLoop.nextMove}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Premium personality packs</CardTitle>
                <CardDescription>
                  Pro should feel like a richer version of the robot, not a paywall around basics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">Starter pack</div>
                    <Badge>Free</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Everyday greetings, repair guidance, weather, battery, and the core friendly voice.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">Afterglow pack</div>
                    <Badge>Pro</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Brighter celebration, fun-command polish, and more playful personality moments.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">Night Owl pack</div>
                    <Badge>Pro</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Softer dock-time, wind-down, sleep, and late-night cozy replies that feel intentional.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
            <div className="text-sm font-semibold">Current go-to-market rule</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {overview?.status.checkoutLockedToDesktop
                ? "This Android shell only shows the revenue plan and support path. Take actual digital checkout on desktop or hosted web first."
                : "Desktop and hosted web are the first place to charge. Once those links are live, the app can send buyers straight to checkout."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {overview?.supportEmail ? (
                <Button variant="outline" onClick={() => openEmail(overview.supportEmail)}>
                  <Mail className="h-4 w-4" />
                  Email support
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <Mail className="h-4 w-4" />
                  Add support email in env
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-3">
            {(overview?.plans || []).map((plan) => {
              const buttonDisabled =
                !plan.checkoutUrl || (plan.desktopWebOnly && Boolean(overview?.status.checkoutLockedToDesktop));

              return (
                <div key={plan.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-semibold">{plan.name}</div>
                        <Badge className={statusToneClasses[plan.status]}>{statusLabels[plan.status]}</Badge>
                      </div>
                      <div className="text-2xl font-semibold">{plan.priceLabel}</div>
                      <p className="max-w-2xl text-sm text-muted-foreground">{plan.summary}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {plan.desktopWebOnly ? <Badge>Desktop and web first</Badge> : null}
                      <Badge>{plan.cadence}</Badge>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {plan.highlights.map((item) => (
                      <div
                        key={`${plan.id}-${item}`}
                        className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-muted-foreground"
                      >
                        {item}
                      </div>
                    ))}
                  </div>

                  {plan.note ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-3 py-3 text-sm text-muted-foreground">
                      {plan.note}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => openExternal(plan.checkoutUrl)}
                      disabled={buttonDisabled}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {plan.ctaLabel || "Open checkout"}
                    </Button>
                    {plan.desktopWebOnly && overview?.status.checkoutLockedToDesktop ? (
                      <Button variant="outline" disabled>
                        Desktop or hosted web only
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Fastest money path</CardTitle>
            <CardDescription>
              Do the first things that can pay you before building complex billing systems everywhere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.nextMoves || []).map((step, index) => (
              <div key={`${index}-${step}`} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </div>
                <div className="text-sm text-muted-foreground">{step}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to keep people around</CardTitle>
            <CardDescription>
              The free plan should create habit. Pro should deepen the relationship instead of rescuing a crippled free app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.retentionHooks || []).map((item, index) => (
              <div key={`${index}-${item}`} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </div>
                <div className="text-sm text-muted-foreground">{item}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What to sell first</CardTitle>
            <CardDescription>
              Start with what is easiest to explain, easiest to deliver, and easiest to charge for.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <BadgeDollarSign className="h-4 w-4 text-primary" />
              <div>
                <div className="font-semibold text-foreground">Setup Concierge</div>
                <div>One paid setup or rescue call is the fastest real revenue while the install base is still small.</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <div className="font-semibold text-foreground">Companion Pro</div>
                <div>Sell the premium experience on desktop and hosted web first, then mirror it into Play later.</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <Layers3 className="h-4 w-4 text-primary" />
              <div>
                <div className="font-semibold text-foreground">Studio later</div>
                <div>Move upmarket once you have real users, real support patterns, and a few people asking for more.</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current status</CardTitle>
            <CardDescription>
              The app now has a dedicated revenue screen and checkout hooks, but it will stay honest about what is configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className={cn("rounded-2xl border px-3 py-3", overview?.status.desktopCheckoutReady ? "border-emerald-300/20 bg-emerald-300/8" : "border-amber-300/20 bg-amber-300/8")}>
              {overview?.status.desktopCheckoutReady
                ? "Desktop or hosted-web checkout is configured."
                : "Desktop or hosted-web checkout still needs real payment links."}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              {overview?.status.hostedAdsReady
                ? "Hosted-web ads are configured, so the free tier can already earn on the web."
                : "Hosted-web ads are not configured in this build yet."}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              {overview?.status.checkoutLockedToDesktop
                ? "This runtime is mobile-shell-like, so paid checkout stays locked to desktop or hosted web for now."
                : "This runtime can open external checkout links when they are configured."}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              {overview?.supportEmail
                ? `Support contact: ${overview.supportEmail}`
                : "Add SUPPORT_EMAIL in server/.env.local so buyers have a direct contact path."}
            </div>
            {message ? <div className="rounded-2xl border border-dashed border-white/10 px-3 py-3">{message}</div> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MonetizationStatusCard({
  title,
  icon,
  value,
  detail
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="mt-3 text-lg font-semibold">{value}</div>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function MonetizationValueCard({
  title,
  icon,
  items
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-sm text-muted-foreground">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
