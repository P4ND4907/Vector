import { mockRobotService } from "@/services/mockRobotService";
import type {
  AiCommandAction,
  AiCommandPreview,
  CommandGap,
  IntegrationStatus,
  LearnedCommand,
  Robot,
  VectorCommandCatalogItem
} from "@/types";

const stripCommandPreamble = (value: string) => {
  let current = value.trim();

  while (current) {
    const next = current
      .replace(/^(?:hey\s+)?vector\s+/i, "")
      .replace(/^(?:can|could|would|will)\s+you\s+/i, "")
      .replace(/^(?:please\s+)+/i, "")
      .trim();

    if (next === current) {
      return current;
    }

    current = next;
  }

  return current;
};

const normalizePrompt = (value: string) =>
  stripCommandPreamble(
    value
      .trim()
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
  );

let mockLearnedCommands: LearnedCommand[] = [];
let mockCommandGaps: CommandGap[] = [];

const clone = <T,>(value: T) => JSON.parse(JSON.stringify(value)) as T;

const createLearnedCommandRecord = (phrase: string, targetPrompt: string, existing?: LearnedCommand): LearnedCommand => {
  const normalizedPhrase = normalizePrompt(phrase);
  const normalizedTargetPrompt = normalizePrompt(targetPrompt);
  const now = new Date().toISOString();

  return {
    phrase: phrase.trim(),
    normalizedPhrase,
    targetPrompt: targetPrompt.trim(),
    normalizedTargetPrompt,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
};

const pushMockCommandGap = (prompt: string, note: string): CommandGap => {
  const normalizedPrompt = normalizePrompt(prompt);
  const latest = mockCommandGaps[0];

  if (latest && latest.normalizedPrompt === normalizedPrompt && latest.note === note) {
    return latest;
  }

  const gap: CommandGap = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    source: "ai",
    prompt: prompt.trim(),
    normalizedPrompt,
    category: "unsupported",
    note
  };

  mockCommandGaps = [gap, ...mockCommandGaps].slice(0, 40);
  return gap;
};

const saveMockLearnedPhrase = (phrase: string, targetPrompt: string): LearnedCommand => {
  const normalizedPhrase = normalizePrompt(phrase);
  const existing = mockLearnedCommands.find((item) => item.normalizedPhrase === normalizedPhrase);
  const record = createLearnedCommandRecord(phrase, targetPrompt, existing);

  mockLearnedCommands = [record, ...mockLearnedCommands.filter((item) => item.normalizedPhrase !== normalizedPhrase)].slice(0, 40);
  mockCommandGaps = mockCommandGaps.filter((item) => item.normalizedPrompt !== normalizedPhrase);
  return record;
};

const removeMockLearnedPhrase = (phrase: string): LearnedCommand | undefined => {
  const normalizedPhrase = normalizePrompt(phrase);
  const existing = mockLearnedCommands.find((item) => item.normalizedPhrase === normalizedPhrase);
  mockLearnedCommands = mockLearnedCommands.filter((item) => item.normalizedPhrase !== normalizedPhrase);
  return existing;
};

const buildAction = (
  type: AiCommandAction["type"],
  label: string,
  params: Record<string, unknown>
): AiCommandAction => ({
  id: crypto.randomUUID(),
  type,
  label,
  params
});

const splitPrompt = (prompt: string) =>
  prompt
    .split(/\bthen\b|\band\b|,|;/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

const buildAssistant = (
  label: string,
  kind: string,
  params: Record<string, unknown> = {}
): AiCommandAction => buildAction("assistant", label, { kind, ...params });

const parseSegment = (segment: string): AiCommandAction | null => {
  const normalized = normalizePrompt(segment);

  if (!normalized) {
    return null;
  }

  const teachMatch = normalized.match(/^(?:learn|remember|teach(?: vector)?)\s+(?:that\s+)?(.+?)\s+(?:means?|should mean|as)\s+(.+)$/i);
  if (teachMatch) {
    return buildAssistant(`Learn "${teachMatch[1]}"`, "teach-command", {
      phrase: teachMatch[1],
      targetPrompt: teachMatch[2]
    });
  }

  const forgetMatch = normalized.match(/^(?:forget|unlearn|remove)\s+(?:the phrase\s+)?(.+)$/i);
  if (forgetMatch) {
    return buildAssistant(`Forget "${forgetMatch[1]}"`, "forget-command", {
      phrase: forgetMatch[1]
    });
  }

  if (/^(?:what have you learned|what did you learn|show learned commands|list learned commands|show custom phrases|list custom phrases)$/.test(normalized)) {
    return buildAssistant("List learned phrases", "list-learned-commands");
  }

  const speakMatch = normalized.match(/^(say|speak)\s+(.+)$/i);
  if (speakMatch) {
    return buildAction("speak", `Speak "${speakMatch[2]}"`, { text: speakMatch[2] });
  }

  const driveMatch = normalized.match(
    /^(drive|move|go|turn)\s+(forward|backward|reverse|left|right)(?:\s+for\s+(\d+(?:\.\d+)?)\s*(second|seconds|sec|secs|s))?/i
  );
  if (driveMatch) {
    const direction = driveMatch[2] === "backward" ? "reverse" : driveMatch[2];
    const durationMs = driveMatch[3] ? Math.round(Number(driveMatch[3]) * 1000) : 1200;
    return buildAction("drive", `Drive ${direction}`, {
      direction,
      speed: 60,
      durationMs
    });
  }

  if (
    /^(?:go\s+)?dock$|^return(?:\s+to)?\s+(?:the\s+)?dock$|^(?:go|return|head)\s+(?:to\s+)?(?:your\s+)?charger$|^(?:go|return|head)\s+home$|^back\s+to\s+(?:the\s+)?(?:dock|charger)$/.test(
      normalized
    )
  ) {
    return buildAction("dock", "Return to dock", {});
  }

  if (/^wake( up)?/.test(normalized)) {
    return buildAction("wake", "Wake Vector", {});
  }

  if (
    /^(?:battery|battery level|power level|charge level|check battery|check status|status)$/.test(
      normalized
    )
  ) {
    return buildAction("status", "Check battery and robot status", {});
  }

  if (
    /^(?:(?:whats|what is)\s+the weather(?: report)?|weather(?: report)?)(?:\s+in\s+(.+))?$/.test(
      normalized
    )
  ) {
    const locationMatch = normalized.match(/\sin\s+(.+)$/i);
    return buildAssistant(
      locationMatch?.[1] ? `Check weather in ${locationMatch[1]}` : "Check current weather",
      "weather",
      { location: locationMatch?.[1] }
    );
  }

  if (/^(?:roll a die|roll the die|roll die|roll dice|roll the dice)$/.test(normalized)) {
    return buildAssistant("Roll a die", "roll-die");
  }

  if (/^(?:flip a coin|flip coin|toss a coin|toss coin|coin flip|heads or tails)$/.test(normalized)) {
    return buildAssistant("Flip a coin", "flip-coin");
  }

  if (/^(?:rock paper scissors|play rock paper scissors|lets play rock paper scissors|rps)$/.test(normalized)) {
    return buildAssistant("Play rock paper scissors", "rock-paper-scissors");
  }

  if (
    /^(?:take a picture|take a photo|take a selfie|take a snapshot|take a picture of me|take a photo of me)$/.test(
      normalized
    )
  ) {
    return buildAction("photo", "Take a photo and sync the latest image", {});
  }

  const setNameMatch = normalized.match(/^my name is\s+(.+)$/i);
  if (setNameMatch) {
    return buildAssistant(`Remember your name as ${setNameMatch[1]}`, "set-user-name", {
      name: setNameMatch[1]
    });
  }

  if (/^(?:what time is it|current time|tell me the time)$/.test(normalized)) {
    return buildAssistant("Check the current time", "time-lookup");
  }

  if (/^(?:hello|hi|hey|good morning|good evening)$/.test(normalized)) {
    return buildAction("speak", 'Speak "Hello human. Systems online."', {
      text: "Hello human. Systems online."
    });
  }

  if (/^(?:help|show commands|what can you do|list commands)$/.test(normalized)) {
    return buildAssistant("Show available commands", "show-help");
  }

  return null;
};

const createPreviewFromPrompt = (prompt: string, depth = 0): AiCommandPreview => {
  const normalizedPrompt = normalizePrompt(prompt);

  if (depth < 4) {
    const learnedCommand = mockLearnedCommands.find((item) => item.normalizedPhrase === normalizedPrompt);
    if (learnedCommand) {
      const resolvedPreview = createPreviewFromPrompt(learnedCommand.targetPrompt, depth + 1);
      return {
        ...resolvedPreview,
        id: crypto.randomUUID(),
        prompt
      };
    }
  }

  const actions = splitPrompt(prompt).map(parseSegment).filter(Boolean) as AiCommandAction[];
  const warnings = actions.length ? [] : ["Mock mode could not map that command yet."];

  if (!actions.length) {
    pushMockCommandGap(prompt, warnings[0]);
  }

  return {
    id: crypto.randomUUID(),
    prompt,
    summary: actions.length
      ? actions.map((action) => action.label).join(" then ")
      : "No executable action detected.",
    source: "rules",
    warnings,
    canExecute: actions.length > 0,
    actions
  };
};

const runAssistantAction = async (action: AiCommandAction, robot: Robot) => {
  const kind = String(action.params.kind ?? "");

  switch (kind) {
    case "teach-command": {
      const phrase = String(action.params.phrase ?? "").trim();
      const targetPrompt = String(action.params.targetPrompt ?? "").trim();
      if (!phrase || !targetPrompt) {
        return "I still need both the new phrase and the command it should mean.";
      }
      saveMockLearnedPhrase(phrase, targetPrompt);
      return `Got it. I'll remember that ${phrase} means ${targetPrompt}.`;
    }
    case "forget-command": {
      const phrase = String(action.params.phrase ?? "").trim();
      const removed = phrase ? removeMockLearnedPhrase(phrase) : undefined;
      return removed
        ? `Okay. I forgot ${removed.phrase}.`
        : "I could not find that learned phrase.";
    }
    case "list-learned-commands":
      return mockLearnedCommands.length
        ? `I know ${mockLearnedCommands
            .slice(0, 4)
            .map((item) => `${item.phrase} means ${item.targetPrompt}`)
            .join(". ")}.`
        : "I have not learned any custom phrases yet.";
    case "weather": {
      const location = typeof action.params.location === "string" && action.params.location
        ? action.params.location
        : "your saved weather location";
      return `Mock forecast for ${location}: cool, clear, and ready for robot testing.`;
    }
    case "roll-die":
      return `I rolled a ${1 + Math.floor(Math.random() * 6)}.`;
    case "flip-coin":
      return Math.random() >= 0.5 ? "Heads." : "Tails.";
    case "rock-paper-scissors": {
      const choices = ["rock", "paper", "scissors"];
      return `Rock, paper, scissors. I choose ${choices[Math.floor(Math.random() * choices.length)]}.`;
    }
    case "set-user-name":
      return `Got it. I'll remember that your name is ${String(action.params.name ?? "friend")}.`;
    case "time-lookup": {
      const now = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
      });
      return `It is ${now}.`;
    }
    case "show-help":
      return "Try hello, what's the weather, roll a die, take a photo, go dock, or say hello.";
    default:
      return `${robot.nickname ?? robot.name} recognized that demo command.`;
  }
};

export const getMockAiStatus = () => ({
  enabled: false,
  model: "Mock rules parser"
});

export const getMockLearnedCommands = () => clone(mockLearnedCommands);

export const getMockCommandGaps = () => clone(mockCommandGaps);

export const saveMockLearnedCommand = (phrase: string, targetPrompt: string) => ({
  item: clone(saveMockLearnedPhrase(phrase, targetPrompt)),
  items: clone(mockLearnedCommands)
});

export const deleteMockLearnedCommand = (phrase: string) => clone(removeMockLearnedPhrase(phrase));

export const getMockCommandCatalog = (): {
  items: VectorCommandCatalogItem[];
  counts: { total: number; live: number; partial: number };
} => {
  const items: VectorCommandCatalogItem[] = [
    {
      key: "hello",
      title: "Hello",
      category: "classic",
      status: "live",
      summary: "Simple greeting and speech test.",
      aliases: ["hello", "hi", "hey"],
      samplePrompt: "say hello",
      surfaces: ["voice", "app"]
    },
    {
      key: "dock",
      title: "Dock",
      category: "control",
      status: "live",
      summary: "Send Vector back to the charger.",
      aliases: ["go dock", "go home", "return home"],
      samplePrompt: "go dock",
      surfaces: ["motion", "app"]
    },
    {
      key: "weather",
      title: "Weather",
      category: "classic",
      status: "live",
      summary: "Read a demo weather result in mock mode.",
      aliases: ["what's the weather", "weather"],
      samplePrompt: "what's the weather",
      surfaces: ["voice", "app"]
    },
    {
      key: "dice",
      title: "Roll A Die",
      category: "community",
      status: "live",
      summary: "Run a quick game-style dice roll.",
      aliases: ["roll a die", "roll dice"],
      samplePrompt: "roll a die",
      surfaces: ["voice", "app"]
    },
    {
      key: "coin",
      title: "Flip A Coin",
      category: "community",
      status: "live",
      summary: "Flip a quick mock coin and hear heads or tails.",
      aliases: ["flip a coin", "coin flip", "toss a coin"],
      samplePrompt: "flip a coin",
      surfaces: ["voice", "app"]
    },
    {
      key: "rps",
      title: "Rock Paper Scissors",
      category: "community",
      status: "live",
      summary: "Play a quick mock round of rock paper scissors.",
      aliases: ["rock paper scissors", "play rock paper scissors", "rps"],
      samplePrompt: "rock paper scissors",
      surfaces: ["voice", "app"]
    },
    {
      key: "photo",
      title: "Take A Photo",
      category: "control",
      status: "live",
      summary: "Capture a mock photo and sync it into the gallery.",
      aliases: ["take a photo", "take a selfie"],
      samplePrompt: "take a photo",
      surfaces: ["camera", "app"]
    }
  ];

  return {
    items,
    counts: {
      total: items.length,
      live: items.length,
      partial: 0
    }
  };
};

export const previewMockCommand = async (prompt: string) => createPreviewFromPrompt(prompt);

export const executeMockCommand = async (
  prompt: string,
  fallbackRobot: Robot,
  fallbackIntegration: IntegrationStatus
) => {
  const parsed = createPreviewFromPrompt(prompt);

  if (!parsed.canExecute) {
    throw new Error(parsed.warnings[0] || "Mock mode could not map that command yet.");
  }

  const results: string[] = [];

  for (const action of parsed.actions) {
    if (action.type === "speak") {
      const result = await mockRobotService.speak(String(action.params.text ?? ""));
      results.push(result.message);
      continue;
    }

    if (action.type === "drive") {
      const result = await mockRobotService.sendDriveCommand(
        String(action.params.direction ?? "forward"),
        Number(action.params.speed ?? 60),
        false
      );
      results.push(result.message);
      continue;
    }

    if (action.type === "dock") {
      const result = await mockRobotService.dock();
      results.push(result.message);
      continue;
    }

    if (action.type === "wake") {
      const result = await mockRobotService.wake();
      results.push(result.message);
      continue;
    }

    if (action.type === "status") {
      results.push(
        `${fallbackRobot.nickname ?? fallbackRobot.name} is at ${fallbackRobot.batteryPercent}% battery in mock mode.`
      );
      continue;
    }

    if (action.type === "photo") {
      const result = await mockRobotService.takePhoto(0);
      results.push(result.message);
      continue;
    }

    if (action.type === "assistant") {
      results.push(await runAssistantAction(action, fallbackRobot));
    }
  }

  return {
    parsed,
    resultMessage: results.join(" "),
    robot: {
      ...fallbackRobot,
      isConnected: true,
      connectionState: "connected" as const,
      connectionSource: "mock" as const,
      currentActivity: "Mock mode handled the latest AI command.",
      lastSeen: new Date().toISOString()
    },
    integration: {
      ...fallbackIntegration,
      source: "mock" as const,
      mockMode: true,
      robotReachable: true,
      note: "Mock mode is active."
    }
  };
};
