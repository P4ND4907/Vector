import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Dock, ShieldAlert, Volume2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Range } from "@/components/ui/range";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store/useAppStore";

export function DrivePage() {
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const driveState = useAppStore((state) => state.driveState);
  const driveRobot = useAppStore((state) => state.driveRobot);
  const moveHead = useAppStore((state) => state.moveHead);
  const moveLift = useAppStore((state) => state.moveLift);
  const setSpeed = useAppStore((state) => state.setSpeed);
  const togglePrecisionMode = useAppStore((state) => state.togglePrecisionMode);
  const speakText = useAppStore((state) => state.speakText);
  const wakeRobot = useAppStore((state) => state.wakeRobot);
  const returnToDock = useAppStore((state) => state.returnToDock);
  const setRobotVolume = useAppStore((state) => state.setRobotVolume);
  const [text, setText] = useState("Hello there.");
  const dockWarning = robot.isDocked
    ? "Vector is on the charger. Take it off the dock before expecting wheel movement."
    : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
      <Card>
        <CardHeader>
          <div className="eyebrow">Controls</div>
          <CardTitle>Main live controls for movement, wake, speech, dock, and audio.</CardTitle>
          <CardDescription>
            This is the practical control surface for everyday use, with WirePod staying hidden behind the backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge>{integration.mockMode ? "Mock mode" : "WirePod live path"}</Badge>
            <Badge>{robot.isConnected ? "Robot online" : "Vector brain offline"}</Badge>
            <Badge>{robot.systemStatus}</Badge>
          </div>

          {dockWarning ? (
            <div className="rounded-3xl border border-amber-300/18 bg-amber-300/8 p-4 text-sm text-amber-50/90">
              {dockWarning}
            </div>
          ) : null}

          <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
            <div />
            <Button size="lg" onClick={() => driveRobot("forward")}>
              <ArrowUp className="h-5 w-5" />
            </Button>
            <div />
            <Button size="lg" variant="outline" onClick={() => driveRobot("left")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="destructive" onClick={() => driveRobot("stop")}>
              <ShieldAlert className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => driveRobot("right")}>
              <ArrowRight className="h-5 w-5" />
            </Button>
            <div />
            <Button size="lg" onClick={() => driveRobot("reverse")}>
              <ArrowDown className="h-5 w-5" />
            </Button>
            <div />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button variant="secondary" onClick={wakeRobot}>
              <Zap className="h-4 w-4" />
              Wake
            </Button>
            <Button variant="secondary" onClick={returnToDock} disabled={robot.isDocked}>
              <Dock className="h-4 w-4" />
              {robot.isDocked ? "Docked" : "Dock"}
            </Button>
            <Button variant="outline" onClick={() => driveRobot("stop")}>
              Emergency stop
            </Button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Speed</div>
                <div className="text-xs text-muted-foreground">Clamp motion so desk driving stays manageable.</div>
              </div>
              <div className="text-xl font-semibold">{driveState.speed}%</div>
            </div>
            <Range
              className="mt-4"
              min={10}
              max={100}
              value={driveState.speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </div>

          <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <div className="text-sm font-semibold">Precision mode</div>
              <div className="text-xs text-muted-foreground">Reduce speed automatically for careful alignment near the dock.</div>
            </div>
            <Switch checked={driveState.precisionMode} onCheckedChange={togglePrecisionMode} />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Quick speech</label>
            <Textarea value={text} onChange={(event) => setText(event.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => speakText(text)}>Speak text</Button>
              <Button variant="outline" onClick={() => setText("Returning to the charger now.")}>
                Use dock phrase
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Head control</CardTitle>
            <CardDescription>Fine adjustments stay available without opening a separate mode.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Head angle</span>
              <span className="text-lg font-semibold">{driveState.headAngle} deg</span>
            </div>
            <Range
              min={-25}
              max={44}
              value={driveState.headAngle}
              onChange={(event) => moveHead(Number(event.target.value))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lift control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Lift height</span>
              <span className="text-lg font-semibold">{driveState.liftHeight}%</span>
            </div>
            <Range
              min={0}
              max={100}
              value={driveState.liftHeight}
              onChange={(event) => moveLift(Number(event.target.value))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volume</CardTitle>
            <CardDescription>WirePod volume is a simple 0-5 scale so it stays predictable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Volume2 className="h-4 w-4 text-primary" />
                Voice volume
              </div>
              <span className="text-lg font-semibold">{robot.volume}/5</span>
            </div>
            <Range
              min={0}
              max={5}
              step={1}
              value={robot.volume}
              onChange={(event) => void setRobotVolume(Number(event.target.value))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
