import { useMemo, useState } from "react";
import { Dice5, Heart, ListOrdered, LockKeyhole, Play, Sparkles } from "lucide-react";
import { FeatureGateCard } from "@/components/monetization/FeatureGateCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { animationCategories } from "@/lib/animation-catalog";
import { formatTimestamp } from "@/lib/format";
import { isProAccessActive, premiumAnimationCategories } from "@/lib/monetization-access";
import { useAppStore } from "@/store/useAppStore";

export function AnimationsPage() {
  const animations = useAppStore((state) => state.animations);
  const queuedAnimations = useAppStore((state) => state.queuedAnimations);
  const settings = useAppStore((state) => state.settings);
  const playAnimation = useAppStore((state) => state.playAnimation);
  const queueAnimation = useAppStore((state) => state.queueAnimation);
  const playQueuedAnimations = useAppStore((state) => state.playQueuedAnimations);
  const playRandomAnimation = useAppStore((state) => state.playRandomAnimation);
  const [category, setCategory] = useState("happy");
  const proAccess = isProAccessActive(settings);
  const categoryLocked = premiumAnimationCategories.has(category);

  const filteredAnimations = useMemo(
    () => animations.filter((item) => item.category === category),
    [animations, category]
  );
  const accessibleFavorites = useMemo(
    () =>
      animations.filter(
        (item) => item.favorite && (proAccess || !premiumAnimationCategories.has(item.category))
      ),
    [animations, proAccess]
  );
  const hiddenPremiumFavorites = useMemo(
    () =>
      animations.filter(
        (item) => item.favorite && !proAccess && premiumAnimationCategories.has(item.category)
      ).length,
    [animations, proAccess]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.92fr]">
      <Card>
        <CardHeader>
          <div className="eyebrow">Animations and reactions</div>
          <CardTitle>Preview categories, favorite moments, and a simple queue.</CardTitle>
          <CardDescription>
            Play one animation immediately or stage a short sequence without burying the user in low-value controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Starter pack</div>
                <Badge>Free</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Everyday greetings, curious reactions, happy moments, and idle behavior.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Afterglow pack</div>
                <Badge>Pro</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Silly and celebration cues that make the robot feel brighter and more playful.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Night Owl pack</div>
                <Badge>Pro</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Sleepy, wind-down, and softer dock-time reactions for calmer ambient moments.
              </p>
            </div>
          </div>

          <Tabs
            value={category}
            onValueChange={setCategory}
            items={animationCategories.map(({ value, label }) => ({ value, label }))}
          />
          {!proAccess && categoryLocked ? (
            <FeatureGateCard feature="premium-animations" />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredAnimations.map((animation) => {
                const locked = !proAccess && premiumAnimationCategories.has(animation.category);

                return (
                  <div key={animation.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 font-semibold">
                          <span>{animation.name}</span>
                          {locked ? <Badge>Pro</Badge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{animation.durationMs} ms</div>
                      </div>
                      {animation.favorite ? (
                        <Heart className="h-4 w-4 fill-primary text-primary" />
                      ) : null}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" onClick={() => playAnimation(animation.id)} disabled={locked}>
                        <Play className="h-4 w-4" />
                        Play
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => queueAnimation(animation.id)}
                        disabled={locked || !proAccess}
                      >
                        Queue
                      </Button>
                    </div>
                    {locked ? (
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <LockKeyhole className="h-3.5 w-3.5" />
                        Companion Pro unlocks this pack.
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Queue and favorites</CardTitle>
            <CardDescription>Keep favorite reactions handy and make short queues feel obvious.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={playQueuedAnimations} disabled={!proAccess}>
                <ListOrdered className="h-4 w-4" />
                Play queue
              </Button>
              <Button variant="outline" onClick={playRandomAnimation} disabled={!proAccess}>
                <Dice5 className="h-4 w-4" />
                Random mode
              </Button>
              <Badge className="border-primary/20 bg-primary/[0.08] text-primary">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Ambient moments land better when queues stay short
              </Badge>
            </div>

            {!proAccess ? (
              <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/[0.05] p-4 text-sm text-muted-foreground">
                Queue mode and random mode are part of Companion Pro. Free keeps the everyday reactions quick and simple.
              </div>
            ) : null}

            <div className="space-y-3">
              {queuedAnimations.length ? (
                queuedAnimations.map((animationId, index) => {
                  const animation = animations.find((item) => item.id === animationId);
                  return (
                    <div key={`${animationId}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="text-sm font-semibold">{animation?.name ?? animationId}</div>
                      <div className="text-xs text-muted-foreground">Queued position {index + 1}</div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                  Queue a few reactions to stage a mini routine.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Favorite highlights</CardTitle>
            <CardDescription>Favorites help the robot feel more alive without scrolling through long menus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accessibleFavorites
              .map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.category}</div>
                    </div>
                    <Badge>{formatTimestamp(new Date().toISOString())}</Badge>
                  </div>
                </div>
              ))}
            {!accessibleFavorites.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                No free favorites are visible in this tier yet.
              </div>
            ) : null}
            {!proAccess && hiddenPremiumFavorites ? (
              <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/[0.05] p-4 text-sm text-muted-foreground">
                {hiddenPremiumFavorites} premium favorite{hiddenPremiumFavorites === 1 ? "" : "s"} unlock with Companion Pro.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
