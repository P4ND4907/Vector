import { mockRobotService } from "@/services/mockRobotService";
import type {
  AiCommandAction,
  AiCommandPreview,
  IntegrationStatus,
  Robot,
  VectorCommandCatalogItem
} from "@/types";

const normalizePrompt = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");

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

  if (/^(?:roll a die|roll die|roll dice)$/.test(normalized)) {
    return buildAssistant("Roll a die", "roll-die");
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

const createPreviewFromPrompt = (prompt: string): AiCommandPreview => {
  const actions = splitPrompt(prompt).map(parseSegment).filter(Boolean) as AiCommandAction[];
  const warnings = actions.length ? [] : ["Mock mode could not map that command yet."];

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
    case "weather": {
      const location = typeof action.params.location === "string" && action.params.location
        ? action.params.location
        : "your saved weather location";
      return `Mock forecast for ${location}: cool, clear, and ready for robot testing.`;
    }
    case "roll-die":
      return `I rolled a ${1 + Math.floor(Math.random() * 6)}.`;
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
