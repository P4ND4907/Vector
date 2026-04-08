import { useMemo, useState } from "react";
import { History, Mic, Volume2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Range } from "@/components/ui/range";
import { Textarea } from "@/components/ui/textarea";
import { formatTimestamp } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const TEST_PHRASE = "Hello, this is a voice test.";

export function SpeechPage() {
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const savedPhrases = useAppStore((state) => state.savedPhrases);
  const logs = useAppStore((state) => state.logs);
  const speakText = useAppStore((state) => state.speakText);
  const setRobotVolume = useAppStore((state) => state.setRobotVolume);
  const wakeRobot = useAppStore((state) => state.wakeRobot);
  const [text, setText] = useState(TEST_PHRASE);

  const speechLogs = useMemo(() => logs.filter((log) => log.type === "speak" || log.type === "ai-command"), [logs]);

  const runWakeThenSpeak = async () => {
    await wakeRobot();
    await speakText(TEST_PHRASE);
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.06fr)_360px]">
      <Card>
        <CardHeader>
          <div className="eyebrow">Speech and audio</div>
          <CardTitle>Send voice lines without extra clutter.</CardTitle>
          <CardDescription>Use the quick tests first, then send custom text once the robot is awake.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{integration.mockMode ? "Mock mode" : "Local bridge live path"}</Badge>
            <Badge>{robot.isConnected ? "Robot online" : "Local bridge offline"}</Badge>
            <Badge>{robot.volume}/5 volume</Badge>
          </div>

          <div className="rounded-3xl border border-amber-300/18 bg-amber-300/8 p-4 text-sm text-amber-50/90">
            If Vector reacts but stays silent, run the wake test once and keep the volume between 3 and 5 while we tune the speech path.
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button onClick={() => speakText(TEST_PHRASE)}>
              <Mic className="h-4 w-4" />
              Voice test
            </Button>
            <Button variant="outline" onClick={runWakeThenSpeak}>
              <Zap className="h-4 w-4" />
              Wake + test
            </Button>
            <Button variant="outline" onClick={() => setText("Returning to the charger now.")}>
              Use dock phrase
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Custom speech</label>
            <Textarea value={text} onChange={(event) => setText(event.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => speakText(text)}>
              <Mic className="h-4 w-4" />
              Send to robot
            </Button>
            <Button variant="outline" onClick={() => setText(TEST_PHRASE)}>
              Reset test line
            </Button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Volume</div>
                <div className="text-xs text-muted-foreground">Stored locally and sent through the local bridge when it changes.</div>
              </div>
              <div className="text-xl font-semibold">{robot.volume}/5</div>
            </div>
            <Range
              className="mt-4"
              min={0}
              max={5}
              step={1}
              value={robot.volume}
              onChange={(event) => void setRobotVolume(Number(event.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Saved phrases</CardTitle>
            <CardDescription>Keep the most-used voice lines one tap away.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {savedPhrases.map((phrase) => (
              <button
                key={phrase.id}
                type="button"
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-primary/40"
                onClick={() => setText(phrase.text)}
              >
                <div className="text-sm font-semibold">{phrase.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{phrase.text}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice history</CardTitle>
            <CardDescription>Recent speech results stay readable while we tune the live path.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {speechLogs.length ? (
              speechLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge>{log.status}</Badge>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(log.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm">{String(log.payload.text ?? log.payload.prompt ?? log.resultMessage)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                Send a phrase to populate history.
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <History className="h-4 w-4 text-primary" />
              Voice actions and AI-spoken commands share the same readable log.
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Volume2 className="h-4 w-4 text-primary" />
              Robot sounds working without voice usually points to a speech-path issue, not a dead speaker.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
