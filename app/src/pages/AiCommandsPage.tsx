import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, Bot, CheckCircle2, Play, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { aiService } from "@/services/aiService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getChargingProtectionMessage, isChargingProtectionActive } from "@/lib/charging-protection";
import { formatTimestamp } from "@/lib/format";
import { getBrainStatusLabel } from "@/lib/robot-state";
import { useAppStore } from "@/store/useAppStore";
import type {
  AiCommandAction,
  AiCommandPreview,
  CommandGap,
  CommandLog,
  LearnedCommand,
  ToastItem,
  VectorCommandCatalogItem
} from "@/types";

const EXAMPLE_PROMPTS = [
  "say hello",
  "drive forward for 2 seconds",
  "go dock",
  "turn left then say hi",
  "wake up and check battery",
  "what's the weather",
  "roll a die",
  "flip a coin",
  "take a photo",
  "my name is Joseph"
];

const GAME_PROMPTS = [
  {
    label: "Flip a coin",
    prompt: "flip a coin"
  },
  {
    label: "Roll a die",
    prompt: "roll a die"
  },
  {
    label: "Rock paper scissors",
    prompt: "rock paper scissors"
  },
  {
    label: "Tell me a joke",
    prompt: "tell me a joke"
  }
] as const;

const MOBILE_EXAMPLE_PROMPTS = EXAMPLE_PROMPTS.slice(0, 4);
const MORE_EXAMPLE_PROMPTS = EXAMPLE_PROMPTS.slice(4);

const TEACHING_PROMPTS = [
  {
    label: "Teach coin toss",
    prompt: 'learn that coin toss means flip a coin'
  },
  {
    label: "Teach movie time",
    prompt: 'learn that movie time means play blackjack'
  },
  {
    label: "Show learned phrases",
    prompt: "list learned commands"
  }
] as const;

const DEFAULT_MESSAGE = "Preview a plain-English instruction before you send it to Vector.";

const CATEGORY_LABELS = {
  classic: "Classic Vector",
  community: "Community extras",
  control: "Core controls",
  assistant: "Assistant tools"
} as const;

const CATEGORY_ORDER = ["classic", "community", "control", "assistant"] as const;
const TEACH_TARGET_FALLBACKS = ["go dock", "what's the weather", "check battery", "flip a coin", "say hello"] as const;

const SURFACE_LABELS = {
  face: "Face",
  voice: "Voice",
  motion: "Motion",
  camera: "Camera",
  app: "App",
  memory: "Memory"
} as const;

const normalizePrompt = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

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

const addUniqueSuggestion = (items: string[], value?: string) => {
  const cleaned = value?.trim();
  if (!cleaned || items.includes(cleaned)) {
    return items;
  }

  items.push(cleaned);
  return items;
};

const buildGapSuggestions = (gap: CommandGap, commandCatalog: VectorCommandCatalogItem[]) => {
  const suggestions: string[] = [];
  const addCatalogSample = (matcher: (item: VectorCommandCatalogItem) => boolean) => {
    const item = commandCatalog.find(matcher);
    if (item) {
      addUniqueSuggestion(suggestions, item.samplePrompt);
    }
  };

  if (gap.matchedIntent) {
    addCatalogSample((item) => item.key === gap.matchedIntent);
  }

  if (/dock|charger|home|base/i.test(gap.prompt)) {
    addUniqueSuggestion(suggestions, "go dock");
  }

  if (/weather|forecast|temperature/i.test(gap.prompt)) {
    addCatalogSample((item) => item.key === "weather");
  }

  if (/battery|charge|power/i.test(gap.prompt)) {
    addUniqueSuggestion(suggestions, "check battery");
  }

  if (/coin|heads|tails/i.test(gap.prompt)) {
    addCatalogSample((item) => item.key === "flip_coin");
  }

  if (/dice|die|roll/i.test(gap.prompt)) {
    addCatalogSample((item) => item.key === "roll_die");
  }

  if (/hello|hi|hey/i.test(gap.prompt)) {
    addUniqueSuggestion(suggestions, "say hello");
  }

  if (gap.suggestedArea === "weather") {
    addCatalogSample((item) => item.key === "weather");
  }

  if (gap.suggestedArea === "automation") {
    addUniqueSuggestion(suggestions, "automation status");
  }

  TEACH_TARGET_FALLBACKS.forEach((item) => addUniqueSuggestion(suggestions, item));
  return suggestions.slice(0, 4);
};

const buildTeachSuggestionsFromPhrase = (
  phrase: string,
  commandCatalog: VectorCommandCatalogItem[]
) => {
  const normalized = normalizePrompt(phrase);
  const suggestions: string[] = [];

  if (!normalized) {
    return [...TEACH_TARGET_FALLBACKS];
  }

  commandCatalog.forEach((item) => {
    const matchesAlias = item.aliases.some((alias) => normalizePrompt(alias).includes(normalized) || normalized.includes(normalizePrompt(alias)));
    const matchesTitle = normalizePrompt(item.title).includes(normalized);
    const matchesPrompt = normalizePrompt(item.samplePrompt).includes(normalized) || normalized.includes(normalizePrompt(item.samplePrompt));

    if (matchesAlias || matchesTitle || matchesPrompt) {
      addUniqueSuggestion(suggestions, item.samplePrompt);
    }
  });

  buildGapSuggestions(
    {
      id: "teach-preview",
      createdAt: new Date(0).toISOString(),
      source: "ai",
      prompt: phrase,
      normalizedPrompt: normalized,
      category: "unsupported",
      note: "",
      suggestedArea: undefined
    },
    commandCatalog
  ).forEach((item) => addUniqueSuggestion(suggestions, item));

  TEACH_TARGET_FALLBACKS.forEach((item) => addUniqueSuggestion(suggestions, item));
  return suggestions.slice(0, 6);
};

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
    case "photo":
      return "Vector will capture a photo, then sync the latest saved image into the local gallery.";
    case "assistant": {
      const kind = String(action.params.kind ?? "");

      switch (kind) {
        case "set-user-name":
          return action.params.name
            ? `The app will remember your name as ${String(action.params.name)}.`
            : "The app will save your name locally.";
        case "get-user-name":
          return "The app will read the saved user identity.";
        case "weather":
          return action.params.location
            ? `The backend will look up the current weather in ${String(action.params.location)}, show a quick on-robot visual cue, and then speak the forecast.`
            : "The backend will look up the current weather, show a quick on-robot visual cue, and then speak the forecast.";
        case "weather-tomorrow":
          return action.params.location
            ? `The backend will look up tomorrow's forecast in ${String(action.params.location)}, show a quick on-robot visual cue, and then speak the result.`
            : "The backend will look up tomorrow's forecast, show a quick on-robot visual cue, and then speak the result.";
        case "set-timer":
          return action.params.durationLabel
            ? `The app will start a timer for ${String(action.params.durationLabel)}.`
            : "The app will start a timer if a duration is present.";
        case "check-timer":
          return "The app will report the current timer state.";
        case "cancel-timer":
          return "The app will cancel the active timer.";
        case "time-lookup":
          return "The backend will read the current local time.";
        case "battery-status":
          return "The backend will read Vector's live battery and charging state.";
        case "connect":
          return "The app will try to reconnect to the selected robot.";
        case "disconnect":
          return "The app will disconnect the current robot session cleanly.";
        case "diagnostics":
          return "The backend will run the full diagnostics snapshot and speak the summary.";
        case "set-robot-name":
          return action.params.name
            ? `The app will save ${String(action.params.name)} as Vector's local display name.`
            : "The app will update Vector's local display name.";
        case "get-robot-name":
          return "The backend will read Vector's current local display name.";
        case "switch-language":
          return action.params.language
            ? `The app will remember ${String(action.params.language)} as the preferred language for command features.`
            : "The app will update the preferred language setting.";
        case "translate-phrase":
          return "This translation request is recognized and logged, but live translation is still a future integration.";
        case "roll-die":
          return "The app will roll a virtual die, trigger a quick on-robot game cue, and read the result aloud.";
        case "flip-coin":
          return "The app will flip a virtual coin, trigger a quick on-robot cue, and read heads or tails aloud.";
        case "rock-paper-scissors":
          return "The app will trigger a quick game cue and have Vector choose rock, paper, or scissors aloud.";
        case "chat-with-user":
          return action.params.target
            ? `The app will save ${String(action.params.target)} as the active chat target.`
            : "The app will update the active chat target.";
        case "get-chat-target":
          return "The app will read the saved chat target.";
        case "send-chat-message":
          return "The app will relay the saved chat message through the shared command engine.";
        case "volume-down":
          return "The app will lower Vector's speaker volume by one step.";
        case "mute-audio":
          return "The app will mute Vector's speaker output.";
        case "stop-exploring":
          return "The app will stop any active roam or exploration session.";
        case "show-help":
          return "The app will speak a short list of supported commands.";
        case "stock-intent":
          return action.params.intent
            ? `Vector will run the stock robot routine for ${String(action.params.intent)}.`
            : "Vector will run a stock robot routine.";
        default:
          return "This legacy or community command is recognized and routed through the shared assistant handler.";
      }
    }
    default:
      return "This step will run through the local Vector backend.";
  }
};

export function AiCommandsPage() {
  const location = useLocation();
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const settings = useAppStore((state) => state.settings);
  const aiCommandHistory = useAppStore((state) => state.aiCommandHistory);
  const recordAiCommandHistory = useAppStore((state) => state.recordAiCommandHistory);

  const [prompt, setPrompt] = useState("say hello");
  const [preview, setPreview] = useState<AiCommandPreview | null>(null);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ enabled: boolean; model: string } | null>(null);
  const [aiStatusNote, setAiStatusNote] = useState("Checking which command parser is available...");
  const [commandCatalog, setCommandCatalog] = useState<VectorCommandCatalogItem[]>([]);
  const [catalogCounts, setCatalogCounts] = useState({ total: 0, live: 0, partial: 0 });
  const [catalogNote, setCatalogNote] = useState("Loading the shared command library...");
  const [learnedCommands, setLearnedCommands] = useState<LearnedCommand[]>([]);
  const [commandGaps, setCommandGaps] = useState<CommandGap[]>([]);
  const [learningNote, setLearningNote] = useState("Loading missed phrases and learned shortcuts...");
  const [learningRefreshBusy, setLearningRefreshBusy] = useState(false);
  const [teachPhrase, setTeachPhrase] = useState("");
  const [teachTargetPrompt, setTeachTargetPrompt] = useState("");
  const [teaching, setTeaching] = useState(false);
  const [forgettingPhrase, setForgettingPhrase] = useState<string | null>(null);

  const latestAiLogs = useMemo(() => aiCommandHistory.slice(0, 5), [aiCommandHistory]);
  const recentCommandGaps = useMemo(() => commandGaps.slice(0, 5), [commandGaps]);
  const recentLearnedCommands = useMemo(() => learnedCommands.slice(0, 6), [learnedCommands]);
  const brainStatus = getBrainStatusLabel(integration);
  const starterPrompt =
    typeof (location.state as { starterPrompt?: unknown } | null)?.starterPrompt === "string"
      ? ((location.state as { starterPrompt?: string }).starterPrompt ?? "").trim()
      : "";

  useEffect(() => {
    if (!starterPrompt || starterPrompt === prompt) {
      return;
    }

    setPrompt(starterPrompt);
  }, [prompt, starterPrompt]);
  const aiModeLabel = aiStatus?.enabled ? aiStatus.model : "Rules parser";
  const previewIsFresh = preview ? normalizePrompt(preview.prompt) === normalizePrompt(prompt) : false;
  const showMessageAsError = !preview && message !== DEFAULT_MESSAGE && !previewing && !executing;
  const chargingProtectionActive = isChargingProtectionActive(settings, robot);
  const mockAiNote = settings.mockMode || integration.mockMode
    ? "Mock mode is active, so AI previews and demo commands stay local until you save a real backend target."
    : null;
  const dockNote = chargingProtectionActive
    ? getChargingProtectionMessage()
    : robot.isDocked
      ? "Vector is on the charger. Take it off the dock before asking for wheel movement."
      : null;
  const catalogFilter = normalizePrompt(prompt);

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

  useEffect(() => {
    void refreshLearningData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    void aiService
      .getCommandCatalog()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setCommandCatalog(response.items);
        setCatalogCounts(response.counts);
        setCatalogNote(
          `Built from the shared command engine: ${response.counts.live} live, ${response.counts.partial} still being tuned.`
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setCatalogNote("The command library could not be loaded right now, but typed and voice commands still use the same backend parser.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCatalog = useMemo(() => {
    if (!catalogFilter) {
      return commandCatalog;
    }

    return commandCatalog.filter((item) => {
      const haystack = normalizePrompt(
        [item.title, item.summary, item.samplePrompt, item.note ?? "", ...item.aliases].join(" ")
      );
      return haystack.includes(catalogFilter);
    });
  }, [catalogFilter, commandCatalog]);

  const groupedCatalog = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        items: filteredCatalog
          .filter((item) => item.category === category)
          .sort((left, right) => {
            if (left.status === right.status) {
              return left.title.localeCompare(right.title);
            }

            return left.status === "live" ? -1 : 1;
          })
      })).filter((group) => group.items.length > 0),
    [filteredCatalog]
  );
  const teachSuggestions = useMemo(
    () => buildTeachSuggestionsFromPhrase(teachPhrase, commandCatalog),
    [commandCatalog, teachPhrase]
  );

  const refreshLearningData = async (showBusy = false) => {
    if (showBusy) {
      setLearningRefreshBusy(true);
    }

    try {
      const [learnedResponse, gapsResponse] = await Promise.all([
        aiService.getLearnedCommands(),
        aiService.getCommandGaps()
      ]);

      setLearnedCommands(learnedResponse.items);
      setCommandGaps(gapsResponse.items);
      setLearningNote(
        learnedResponse.items.length || gapsResponse.items.length
          ? `${learnedResponse.items.length} learned phrase${learnedResponse.items.length === 1 ? "" : "s"} and ${gapsResponse.items.length} recent missed command${gapsResponse.items.length === 1 ? "" : "s"}.`
          : "No missed phrases yet. When something fails, it will show up here so you can teach it."
      );
    } catch {
      setLearningNote("Missed phrases are not available right now, but you can still teach commands manually.");
    } finally {
      if (showBusy) {
        setLearningRefreshBusy(false);
      }
    }
  };

  const requestPreview = async (nextPrompt: string) => {
    const nextPreview = await aiService.previewCommand(nextPrompt);
    setPreview(nextPreview);
    setMessage(
      nextPreview.canExecute
        ? nextPreview.summary
        : nextPreview.warnings[0] || "That command needs a small rewrite before it can run."
    );

    if (!nextPreview.canExecute) {
      setTeachPhrase(nextPrompt.trim());
      void refreshLearningData();
    }

    return nextPreview;
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setMessage("Parsing your instruction...");

    try {
      await requestPreview(prompt);
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "The AI command preview failed.");
      if (prompt.trim()) {
        setTeachPhrase(prompt.trim());
      }
      void refreshLearningData();
    } finally {
      setPreviewing(false);
    }
  };

  const handleExecute = async () => {
    setExecuting(true);

    try {
      let activePreview = preview;

      if (!activePreview || !previewIsFresh) {
        setPreviewing(true);
        setMessage("Checking the latest action plan...");
        activePreview = await requestPreview(prompt);
      }

      if (!activePreview.canExecute) {
        setMessage(
          activePreview.warnings[0] || "That command needs a small rewrite before it can run."
        );
        return;
      }

      setMessage("Sending command through the local Vector backend...");
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
      if (teachPhrase && normalizePrompt(teachPhrase) === normalizePrompt(prompt)) {
        setTeachPhrase("");
      }
    } catch (error) {
      const resultMessage = error instanceof Error ? error.message : "The AI command failed.";

      recordAiCommandHistory({
        id: crypto.randomUUID(),
        prompt,
        summary: preview?.summary || "No action preview available",
        status: "error",
        createdAt: new Date().toISOString(),
        resultMessage
      });

      useAppStore.setState((state) => ({
        logs: [
          makeLog(prompt, preview?.summary || "No action preview available", "error", resultMessage),
          ...state.logs
        ].slice(0, 60),
        toasts: [makeToast("AI command failed", resultMessage, "warning"), ...state.toasts].slice(0, 5)
      }));

      setMessage(resultMessage);
      if (prompt.trim()) {
        setTeachPhrase(prompt.trim());
      }
      void refreshLearningData();
    } finally {
      setPreviewing(false);
      setExecuting(false);
    }
  };

  const persistLearnedPhrase = async ({
    phrase,
    targetPrompt,
    previewAfterSave = false
  }: {
    phrase: string;
    targetPrompt: string;
    previewAfterSave?: boolean;
  }) => {
    if (!phrase.trim() || !targetPrompt.trim()) {
      setMessage("Add both the phrase you want to teach and the command it should mean.");
      return false;
    }

    setTeaching(true);

    try {
      const trimmedPhrase = phrase.trim();
      const trimmedTargetPrompt = targetPrompt.trim();
      const response = await aiService.saveLearnedCommand(trimmedPhrase, trimmedTargetPrompt);
      setLearnedCommands(response.items);
      const gapsResponse = await aiService.getCommandGaps().catch(() => null);
      if (gapsResponse) {
        setCommandGaps(gapsResponse.items);
      }
      setLearningNote(
        response.items.length
          ? `${response.items.length} learned phrase${response.items.length === 1 ? "" : "s"} saved so far.`
          : "No learned phrases saved yet."
      );
      setMessage(`Learned "${trimmedPhrase}" as "${trimmedTargetPrompt}".`);
      setPrompt(trimmedPhrase);
      setPreview(null);
      setTeachPhrase("");
      setTeachTargetPrompt("");

      if (previewAfterSave) {
        await requestPreview(trimmedPhrase);
        setMessage(`Learned "${trimmedPhrase}" as "${trimmedTargetPrompt}". Preview refreshed and ready to test.`);
      }

      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The learned phrase could not be saved.");
      return false;
    } finally {
      setTeaching(false);
    }
  };

  const handleSaveLearnedPhrase = async () => {
    await persistLearnedPhrase({
      phrase: teachPhrase,
      targetPrompt: teachTargetPrompt
    });
  };

  const handleSaveAndTryPhrase = async () => {
    await persistLearnedPhrase({
      phrase: teachPhrase,
      targetPrompt: teachTargetPrompt,
      previewAfterSave: true
    });
  };

  const handleDeleteLearnedPhrase = async (phrase: string) => {
    setForgettingPhrase(phrase);

    try {
      const response = await aiService.deleteLearnedCommand(phrase);
      setLearnedCommands(response.items);
      setMessage(`Forgot "${phrase}".`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The learned phrase could not be removed.");
    } finally {
      setForgettingPhrase(null);
    }
  };

  const applyGapToTeachForm = (gap: CommandGap, suggestedTargetPrompt?: string) => {
    setTeachPhrase(gap.prompt);
    setTeachTargetPrompt(suggestedTargetPrompt || "");
  };

  const quickTeachFromGap = async (gap: CommandGap, suggestedTargetPrompt: string) => {
    setTeachPhrase(gap.prompt);
    setTeachTargetPrompt(suggestedTargetPrompt);
    await persistLearnedPhrase({
      phrase: gap.prompt,
      targetPrompt: suggestedTargetPrompt,
      previewAfterSave: true
    });
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.08fr)_360px]">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <div className="eyebrow">AI commands</div>
            <CardTitle>Type a command in plain English.</CardTitle>
            <CardDescription>Preview it first, then send the exact action plan through the local bridge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{aiModeLabel}</Badge>
              <Badge>{brainStatus}</Badge>
              <Badge>{integration.robotReachable ? "Robot ready" : "Robot offline"}</Badge>
            </div>

            <p className="text-sm text-muted-foreground">{aiStatusNote}</p>

            {mockAiNote ? (
              <div className="rounded-3xl border border-sky-300/18 bg-sky-300/8 p-4 text-sm text-sky-50/90">
                {mockAiNote}
              </div>
            ) : null}

            {dockNote ? (
              <div className="rounded-3xl border border-amber-300/18 bg-amber-300/8 p-4 text-sm text-amber-50/90">
                {dockNote}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">What should Vector do?</label>
              <Textarea
                className="min-h-[120px] md:min-h-[140px]"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setPreview(null);
                  setMessage(DEFAULT_MESSAGE);
                }}
                placeholder="Try: say hello, flip a coin, go dock, or turn left then say hi."
              />
            </div>

            <div className="hidden flex-wrap gap-2 md:flex">
              {EXAMPLE_PROMPTS.map((example) => (
                <Button
                  key={example}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPrompt(example);
                    setPreview(null);
                    setMessage(DEFAULT_MESSAGE);
                  }}
                >
                  {example}
                </Button>
              ))}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:hidden">
              <div className="text-sm font-semibold">Quick picks</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Keep the easy stuff one tap away, then open more examples only if you need them.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MOBILE_EXAMPLE_PROMPTS.map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPrompt(example);
                      setPreview(null);
                      setMessage(DEFAULT_MESSAGE);
                    }}
                  >
                    {example}
                  </Button>
                ))}
              </div>

              <details className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-muted-foreground">
                  More examples
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MORE_EXAMPLE_PROMPTS.map((example) => (
                    <Button
                      key={example}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPrompt(example);
                        setPreview(null);
                        setMessage(DEFAULT_MESSAGE);
                      }}
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </details>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold">Games and fun</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Quick taps for the playful stuff that should just work without extra setup.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {GAME_PROMPTS.map((item) => (
                  <Button
                    key={item.label}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPrompt(item.prompt);
                      setPreview(null);
                      setMessage(DEFAULT_MESSAGE);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">Teach and missed phrases</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void refreshLearningData(true)}
                  disabled={learningRefreshBusy}
                >
                  <RefreshCw className="h-4 w-4" />
                  {learningRefreshBusy ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Turn failed commands into reusable shortcuts. Save the phrase that missed, point it at a command that already works, and test it again right here.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{learningNote}</p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Phrase to learn</label>
                  <Input
                    value={teachPhrase}
                    onChange={(event) => setTeachPhrase(event.target.value)}
                    placeholder="coin toss please"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Make it mean</label>
                  <Input
                    value={teachTargetPrompt}
                    onChange={(event) => setTeachTargetPrompt(event.target.value)}
                    placeholder="flip a coin"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={handleSaveLearnedPhrase} disabled={teaching || !teachPhrase.trim() || !teachTargetPrompt.trim()}>
                  <Sparkles className="h-4 w-4" />
                  {teaching ? "Saving..." : "Save learned phrase"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveAndTryPhrase}
                  disabled={teaching || !teachPhrase.trim() || !teachTargetPrompt.trim()}
                >
                  <Play className="h-4 w-4" />
                  {teaching ? "Saving..." : "Save and preview phrase"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!teachTargetPrompt.trim()) {
                      setMessage("Add a target command first so you can try it.");
                      return;
                    }
                    setPrompt(teachTargetPrompt.trim());
                    setPreview(null);
                    setMessage(DEFAULT_MESSAGE);
                  }}
                  disabled={!teachTargetPrompt.trim()}
                >
                  Try target command
                </Button>
                {TEACHING_PROMPTS.map((item) => (
                  <Button
                    key={item.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPrompt(item.prompt);
                      setPreview(null);
                      setMessage(DEFAULT_MESSAGE);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Suggested targets</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {teachSuggestions.map((item) => (
                    <Button
                      key={item}
                      variant={teachTargetPrompt.trim() === item ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setTeachTargetPrompt(item)}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
                  <div className="text-sm font-semibold">Recent misses</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    These are the latest commands the parser could not turn into a live action.
                  </p>
                  <div className="mt-3 space-y-3">
                    {recentCommandGaps.length ? (
                      recentCommandGaps.map((gap) => (
                        <div key={gap.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold">{gap.prompt}</div>
                              <p className="mt-1 text-xs text-muted-foreground">{gap.note}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge>{gap.source}</Badge>
                              <Badge>{gap.category}</Badge>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => applyGapToTeachForm(gap)}
                            >
                              Use phrase
                            </Button>
                            {buildGapSuggestions(gap, commandCatalog)[0] ? (
                              <Button
                                size="sm"
                                onClick={() => void quickTeachFromGap(gap, buildGapSuggestions(gap, commandCatalog)[0]!)}
                                disabled={teaching}
                              >
                                <Sparkles className="h-4 w-4" />
                                Teach and preview
                              </Button>
                            ) : null}
                            {buildGapSuggestions(gap, commandCatalog).map((suggestion) => (
                              <Button
                                key={`${gap.id}-${suggestion}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => void quickTeachFromGap(gap, suggestion)}
                                disabled={teaching}
                              >
                                Teach as {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                        No missed phrases yet. Unsupported commands will land here automatically.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/10 p-4">
                  <div className="text-sm font-semibold">Saved learned phrases</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    These shortcuts now route through the same command engine as the built-in commands.
                  </p>
                  <div className="mt-3 space-y-3">
                    {recentLearnedCommands.length ? (
                      recentLearnedCommands.map((item) => (
                        <div key={item.normalizedPhrase} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold">{item.phrase}</div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Means: <span className="text-foreground">{item.targetPrompt}</span>
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Updated {formatTimestamp(item.updatedAt)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleDeleteLearnedPhrase(item.phrase)}
                              disabled={forgettingPhrase === item.phrase}
                              aria-label={`Forget ${item.phrase}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPrompt(item.phrase);
                                setPreview(null);
                                setMessage(DEFAULT_MESSAGE);
                              }}
                            >
                              Try phrase
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setTeachPhrase(item.phrase);
                                setTeachTargetPrompt(item.targetPrompt);
                              }}
                            >
                              Edit mapping
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                        No learned phrases saved yet. Teach one above or use a missed phrase suggestion.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handlePreview} disabled={previewing || !prompt.trim()}>
                <Sparkles className="h-4 w-4" />
                {previewing ? "Previewing..." : "Preview command"}
              </Button>
              <Button variant="outline" onClick={handleExecute} disabled={executing || previewing || !prompt.trim()}>
                <Play className="h-4 w-4" />
                {executing ? "Executing..." : previewIsFresh && preview?.canExecute ? "Execute" : "Run command"}
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
            <CardDescription>See exactly what will run before anything reaches the local bridge.</CardDescription>
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

        <div className="grid gap-3 md:hidden">
          <MobileAiSection title="Quick status" description="Only the details that matter before you hit execute.">
            <div className="grid gap-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>Parser</span>
                <span className="text-right text-foreground">{aiModeLabel}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>Local bridge</span>
                <span className="text-right text-foreground">{integration.wirePodReachable ? "Detected" : "Unavailable"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>Selected serial</span>
                <span className="text-right text-foreground">{integration.selectedSerial || robot.serial || "Not set"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>Live commands</span>
                <span className="text-right text-foreground">{catalogCounts.live || "..."}</span>
              </div>
            </div>
          </MobileAiSection>

          <MobileAiSection
            title="Command library"
            description={catalogNote}
            defaultOpen={Boolean(catalogFilter)}
          >
            <div className="flex flex-wrap gap-2">
              <Badge>{catalogCounts.total} total</Badge>
              <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                {catalogCounts.live} live
              </Badge>
              <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100">
                {catalogCounts.partial} partial
              </Badge>
              {catalogFilter ? <Badge>Filtered by current prompt</Badge> : null}
            </div>

            {groupedCatalog.length ? (
              <div className="mt-4 space-y-4">
                {groupedCatalog.map((group) => (
                  <div key={group.category} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                      {group.label}
                    </div>

                    {group.items.map((item) => (
                      <div key={item.key} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold">{item.title}</div>
                            <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                          </div>
                          <Badge
                            className={
                              item.status === "live"
                                ? "shrink-0 border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                                : "shrink-0 border-amber-300/20 bg-amber-300/10 text-amber-100"
                            }
                          >
                            {item.status === "live" ? "Live now" : "Needs tuning"}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.surfaces.map((surface) => (
                            <Badge key={`${item.key}-${surface}`}>{SURFACE_LABELS[surface]}</Badge>
                          ))}
                        </div>

                        <div className="mt-3 text-xs text-muted-foreground">
                          Try: <span className="text-foreground">{item.samplePrompt}</span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.aliases.slice(0, 3).map((alias) => (
                            <Badge key={`${item.key}-${alias}`}>{alias}</Badge>
                          ))}
                        </div>

                        {item.note ? (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-muted-foreground">
                            {item.note}
                          </div>
                        ) : null}

                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPrompt(item.samplePrompt);
                              setPreview(null);
                              setMessage(DEFAULT_MESSAGE);
                            }}
                          >
                            Use sample
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                No commands matched the current prompt yet. Try a broader phrase like weather, dice, dock, or hello.
              </div>
            )}
          </MobileAiSection>

          <MobileAiSection
            title="Recent results"
            description={latestAiLogs.length ? "Keep the last few AI actions readable." : "Executed AI commands will appear here."}
          >
            <div className="space-y-3">
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
                <div className="rounded-3xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                  Executed AI commands will appear here.
                </div>
              )}
            </div>
          </MobileAiSection>
        </div>
      </div>

      <div className="hidden gap-4 md:grid">
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
              <span>Local bridge</span>
              <span className="text-right text-foreground">{integration.wirePodReachable ? "Detected" : "Unavailable"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span>Selected serial</span>
              <span className="text-right text-foreground">{integration.selectedSerial || robot.serial || "Not set"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <span>Live commands</span>
              <span className="text-right text-foreground">{catalogCounts.live || "..."}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Command library</CardTitle>
            <CardDescription>Pulling the best of classic, community, and app-ready commands into one view.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{catalogNote}</p>

            <div className="flex flex-wrap gap-2">
              <Badge>{catalogCounts.total} total</Badge>
              <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
                {catalogCounts.live} live
              </Badge>
              <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-100">
                {catalogCounts.partial} partial
              </Badge>
              {catalogFilter ? <Badge>Filtered by current prompt</Badge> : null}
            </div>

            {groupedCatalog.length ? (
              <div className="max-h-[720px] space-y-4 overflow-y-auto pr-1">
                {groupedCatalog.map((group) => (
                  <div key={group.category} className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                      {group.label}
                    </div>

                    {group.items.map((item) => (
                      <div key={item.key} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold">{item.title}</div>
                            <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                          </div>
                          <Badge
                            className={
                              item.status === "live"
                                ? "shrink-0 border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                                : "shrink-0 border-amber-300/20 bg-amber-300/10 text-amber-100"
                            }
                          >
                            {item.status === "live" ? "Live now" : "Needs tuning"}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.surfaces.map((surface) => (
                            <Badge key={`${item.key}-${surface}`}>{SURFACE_LABELS[surface]}</Badge>
                          ))}
                        </div>

                        <div className="mt-3 text-xs text-muted-foreground">
                          Try: <span className="text-foreground">{item.samplePrompt}</span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.aliases.slice(0, 3).map((alias) => (
                            <Badge key={`${item.key}-${alias}`}>{alias}</Badge>
                          ))}
                        </div>

                        {item.note ? (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-muted-foreground">
                            {item.note}
                          </div>
                        ) : null}

                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPrompt(item.samplePrompt);
                              setPreview(null);
                              setMessage(DEFAULT_MESSAGE);
                            }}
                          >
                            Use sample
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                No commands matched the current prompt yet. Try a broader phrase like weather, dice, dock, or hello.
              </div>
            )}
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

function MobileAiSection({
  title,
  description,
  children,
  defaultOpen = false
}: {
  title: string;
  description: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-3xl border border-white/10 bg-white/[0.03]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        </div>
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-12" />
      </summary>
      <div className="border-t border-white/10 px-4 pb-4 pt-3">{children}</div>
    </details>
  );
}
