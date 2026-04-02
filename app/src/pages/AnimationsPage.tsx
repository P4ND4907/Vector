import { useMemo, useState } from "react";
import { Dice5, Heart, ListOrdered, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { formatTimestamp } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const categories = [
  { value: "happy", label: "Happy" },
  { value: "curious", label: "Curious" },
  { value: "greeting", label: "Greeting" },
  { value: "idle", label: "Idle" },
  { value: "silly", label: "Silly" },
  { value: "celebration", label: "Celebration" },
  { value: "sleepy", label: "Sleepy" }
];

export function AnimationsPage() {
  const animations = useAppStore((state) => state.animations);
  const queuedAnimations = useAppStore((state) => state.queuedAnimations);
  const playAnimation = useAppStore((state) => state.playAnimation);
  const queueAnimation = useAppStore((state) => state.queueAnimation);
  const playQueuedAnimations = useAppStore((state) => state.playQueuedAnimations);
  const playRandomAnimation = useAppStore((state) => state.playRandomAnimation);
  const [category, setCategory] = useState("happy");

  const filteredAnimations = useMemo(
    () => animations.filter((item) => item.category === category),
    [animations, category]
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
          <Tabs value={category} onValueChange={setCategory} items={categories} />
          <div className="grid gap-3 md:grid-cols-2">
            {filteredAnimations.map((animation) => (
              <div key={animation.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{animation.name}</div>
                    <div className="text-xs text-muted-foreground">{animation.durationMs} ms</div>
                  </div>
                  {animation.favorite ? (
                    <Heart className="h-4 w-4 fill-primary text-primary" />
                  ) : null}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => playAnimation(animation.id)}>
                    <Play className="h-4 w-4" />
                    Play
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => queueAnimation(animation.id)}>
                    Queue
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
              <Button onClick={playQueuedAnimations}>
                <ListOrdered className="h-4 w-4" />
                Play queue
              </Button>
              <Button variant="outline" onClick={playRandomAnimation}>
                <Dice5 className="h-4 w-4" />
                Random mode
              </Button>
            </div>

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
            {animations
              .filter((item) => item.favorite)
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

