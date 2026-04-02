import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Play, Sparkles } from "lucide-react";
import { aiService } from "@/services/aiService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatTimestamp } from "@/lib/format";
import { getBrainStatusLabel } from "@/lib/robot-state";
import { useAppStore } from "@/store/useAppStore";
import type { AiCommandAction, AiCommandPreview, CommandLog, ToastItem } from "@/types";

const EXAMPLE_PROMPTS = [
  "say hello",
  "drive forward for 2 seconds",
  "go dock",
  "turn left then say hi",
  "wake up and check battery"
];

const DEFAULT_MESSAGE = "Preview a plain-English instruction before you send it to Vector.";

const makeLog = (
  prompt: string,
  summary: string,
  status: CommandLog["status"],
  resultMessage: string
): CommandLog => ({
  id: crypto.randomUUID(),
  type: "ai-command",
  payload: { prompt, summary },
  status,
  createdAt: new Date().toISOString(),
  resultMessage
});

const makeToast = (title: string, description: string, level: ToastItem["level"]): ToastItem => ({
  id: crypto.randomUUID(),
  title,
  description,
  level
});

const describeAction = (action: AiCommandAction) => {
  switch (action.type) {
    case "speak":
      return typeof action.params.text === "string"
        ? `Vector will say "${action.params.text}".`
        : "Vector will speak a short phrase.";
    case "drive":
      return [
        action.params.direction ? `Move ${String(action.params.direction)}` : "Move",
        typeof action.params.durationMs === "number"
          ? `for ${Math.round(Number(action.params.durationMs) / 1000)} seconds`
          : "",
        typeof action.params.speed === "number" ? `at ${action.params.speed}% speed` : ""
      ]
        .filter(Boolean)
        .join(" ")
        .concat(".");
    case "dock":
      return "Vector will return to the charger.";
    case "wake":
      return "A wake signal will be sent first.";
    case "stop":
      return "Any active wheel motion will stop.";
    case "volume":
      return typeof action.params.volume === "number"
        ? `Volume will be set to ${action.params.volume} out of 5.`
        : "Volume will be adjusted.";
    case "animation":
      return action.params.animationId
        ? `Vector will play ${String(action.params.animationId)}.`
        : "Vector will play an animation.";
    case "status":
      return "The backend will check Vector's live status.";
    case "roam":
      return "Vector will start an autonomous roam routine.";
    default:
      return "This step will run through the local Vector backend.";
  }
};

export function AiCommandsPage() {
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const aiCommandHistory = useAppStore((state) => state.aiCommandHistory);
  const recordAiCommandHistory = useAppStore((state) => state.recordAiCommandHistory);

  const [prompt, setPrompt] = useState("say hello");
  const [preview, setPreview] = useState<AiCommandPreview | null>(null);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; model: string } | null>(null);
  const [aiStatusNote, setAiStatusNote] = useState("Checking which command parser is available...");

  const latestAiLogs = useMemo(() => aiCommandHistory.slice(0, 5), [aiCommandHistory]);
  const brainStatus = getBrainStatusLabel(integration);
  const aiModeLabel = aiStatus?.enabled ? aiStatus.model : "Rules parser";
  const showMessageAsError = !preview && message !== DEFAULT_MESSAGE && !previewing && !executing;
  const dockNote = robot.isDocked
    ? "Vector is on the charger. Take it off the dock before asking for wheel movement."
    : null;

  useEffect(() => {
    let cancelled = false;

    void aiService
      .getStatus()
      .then((status) => {
        if (cancelled) {
          return;
        }

        setAiStatus(status);
        setAiStatusNote(
          status.enabled
            ? `OpenAI assistance is available through ${status.model}.`
            : "The local rules parser is active, so simple commands still work without OpenAI."
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setAiStatus(null);
        setAiStatusNote("AI status could not be checked, so the app will fall back to local command rules where possible.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePreview = async () => {
    setPreviewing(true);
    setMessage("Parsing your instruction...");

    try {
      const nextPreview = await aiService.previewCommand(prompt);
      setPreview(nextPreview);
      setMessage(
        nextPreview.canExecute
          ? nextPreview.summary
          : nextPreview.warnings[0] || "That command needs a small rewrite before it can run."
      );
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "The AI command preview failed.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecute = async () => {
    if (!preview?.canExecute) {
      return;
    }

    setExecuting(true);
    setMessage("Sending command through the local Vector backend...");

    try {
      const result = await aiService.executeCommand(prompt, robot, integration);
      recordAiCommandHistory({
        id: crypto.randomUUID(),
        prompt,
        summary: result.parsed.summary,
        status: "success",
        createdAt: new Date().toISOString(),
        resultMessage: result.resultMessage
      });

      useAppStore.setState((state) => ({
        robot: result.robot,
        integration: result.integration,
        logs: [makeLog(prompt, result.parsed.summary, "success", result.resultMessage), ...state.logs].slice(0, 60),
        toasts: [makeToast("AI command sent", result.resultMessage, "success"), ...state.toasts].slice(0, 5)
      }));

      setMessage(result.resultMessage);
    } catch (error) {
      const resultMessage = error instanceof Error ? error.message : "The AI command failed.";

      recordAiCommandHistory({
        id: crypto.randomUUID(),
        prompt,
        summary: preview.summary,
        status: "error",
        createdAt: new Date().toISOString(),
        resultMessage
      });

      useAppStore.setState((state) => ({
        logs: [makeLog(prompt, preview.summary, "error", resultMessage), ...state.logs].slice(0, 60),
        toasts: [makeToast("AI command failed", resultMessage, "warning"), ...state.toasts].slice(0, 5)
      }));

      setMessage(resultMessage);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.08fr)_360px]">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="eyebrow">AI commands</div>
            <CardTitle>Type a command in plain English.</CardTitle>
            <CardDescription>Preview it first, then send the exact action plan through the local Vector stack.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{aiModeLabel}</Badge>
              <Badge>{brainStatus}</Badge>
              <Badge>{integration.robotReachable ? "Robot ready" : "Robot offline"}</Badge>
            </div>

            <p className="text-sm text-muted-foreground">{aiStatusNote}</p>

            {dockNote ? (
              <div className="rounded-3xl border border-amber-300/18 bg-amber-300/8 p-4 text-sm text-amber-50/90">
                {dockNote}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">What should Vector do?</label>
              <Textarea
                className="min-h-[140px]"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Try: say hello, go dock, or turn left then say hi."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((example) => (
                <Button key={example} variant="outline" size="sm" onClick={() => setPrompt(example)}>
                  {example}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handlePreview} disabled={previewing || !prompt.trim()}>
                <Sparkles className="h-4 w-4" />
                {previewing ? "Previewing..." : "Preview command"}
              </Button>
              <Button variant="outline" onClick={handleExecute} disabled={!preview?.canExecute || executing}>
                <Play className="h-4 w-4" />
                {executing ? "Executing..." : "Execute"}
              </Button>
            </div>

            <div
              className={
                showMessageAsError
                  ? "rounded-3xl border border-amber-300/18 bg-amber-300/8 p-4 text-sm text-amber-50/90"
                  : "rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground"
              }
            >
              {message}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parsed action preview</CardTitle>
            <CardDescription>See exactly what will run before anything reaches WirePod.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {preview ? (
              <>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{preview.source}</Badge>
                    <Badge>{preview.canExecute ? "Ready to execute" : "Needs revision"}</Badge>
                  </div>
                  <p className="mt-3 text-sm">{preview.summary}</p>
                </div>

                <div className="space-y-3">
                  {preview.actions.map((action, index) => (
                    <div key={action.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{action.label}</span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{describeAction(action)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {preview.warnings.length ? (
                  <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                      <AlertTriangle className="h-4 w-4" />
                      Warnings
                    </div>
                    <div className="mt-2 space-y-2 text-sm text-amber-50/90">
                      {preview.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                Preview a command to see the step-by-step action plan here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Quick status</CardTitle>
            <CardDescription>Only the details that matter before you hit execute.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span>Parser</span>
              <span className="text-right text-foreground">{aiModeLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span>Local brain</span>
              <span className="text-right text-foreground">{integration.wirePodReachable ? "Detected" : "Unavailable"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span>Selected serial</span>
              <span className="text-right text-foreground">{integration.selectedSerial || robot.serial || "Not set"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent results</CardTitle>
            <CardDescription>Keep the last few AI actions readable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestAiLogs.length ? (
              latestAiLogs.map((item) => (
                <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{item.summary}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-200" />
                      )}
                      {formatTimestamp(item.createdAt)}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{item.prompt}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{item.resultMessage}</p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                Executed AI commands will appear here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
