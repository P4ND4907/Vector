import type { AiMemoryRecord, RobotController } from "../robot/types.js";
import { previewAiCommand } from "./aiCommandService.js";
import { personality } from "./personalityService.js";

interface AiBrainEnv {
  openaiApiKey: string;
  openaiModel: string;
}

const extractOutputText = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI returned an empty response.");
  }

  const candidate = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof candidate.output_text === "string" && candidate.output_text.trim()) {
    return candidate.output_text.trim();
  }

  const textItem = candidate.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && typeof item.text === "string");

  if (textItem?.text) {
    return textItem.text.trim();
  }

  throw new Error("OpenAI did not return chat text.");
};

const buildMemoryContext = (memory: AiMemoryRecord[]) =>
  memory.length
    ? memory.map((item) => `${item.key}: ${item.value}`).join("\n")
    : "No saved memory yet.";

const buildFallbackReply = async (
  controller: RobotController,
  message: string,
  memory: AiMemoryRecord[]
) => {
  const normalized = message.toLowerCase().trim();
  const settings = await controller.getSettings();

  if (/\b(what is my name|whats my name|who am i)\b/i.test(normalized)) {
    return personality.recallUserName(settings.userName);
  }

  if (/\b(what is your name|whats your name)\b/i.test(normalized)) {
    const status = await controller.getStatus();
    return personality.robotNameReply(status.nickname ?? status.name);
  }

  const parsed = await previewAiCommand(message, controller);
  if (parsed.canExecute) {
    return personality.commandRecognized(parsed.summary);
  }

  if (memory.length) {
    return personality.memoryFallback(memory.length);
  }

  return personality.baseFallback();
};

export const saveAiMemory = (
  memory: AiMemoryRecord[],
  key: string,
  value: string
) => {
  const now = new Date().toISOString();
  const normalizedKey = key.trim().toLowerCase();
  const existing = memory.find((item) => item.key.toLowerCase() === normalizedKey);

  if (existing) {
    return memory.map((item) =>
      item.key.toLowerCase() === normalizedKey
        ? {
            ...item,
            key: key.trim(),
            value: value.trim(),
            updatedAt: now
          }
        : item
    );
  }

  return [
    {
      key: key.trim(),
      value: value.trim(),
      createdAt: now,
      updatedAt: now
    },
    ...memory
  ];
};

export const getAiMemory = (memory: AiMemoryRecord[], key?: string) => {
  if (!key?.trim()) {
    return memory;
  }

  const normalizedKey = key.trim().toLowerCase();
  return memory.filter((item) => item.key.toLowerCase() === normalizedKey);
};

export const buildAiBrainChat = async ({
  controller,
  env,
  message,
  memory
}: {
  controller: RobotController;
  env: AiBrainEnv;
  message: string;
  memory: AiMemoryRecord[];
}) => {
  if (!env.openaiApiKey) {
    return {
      reply: await buildFallbackReply(controller, message, memory),
      mode: "fallback" as const
    };
  }

  try {
    const status = await controller.getStatus();
    const integration = await controller.getIntegrationInfo();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.openaiModel,
        instructions:
          "You are Vector Control Hub's AI brain. Reply briefly, warmly, and clearly with a playful, curious robot personality. Be kind, lightly expressive, and never overly theatrical. Use saved memory when helpful. If the user appears to be asking for a robot action, keep the answer short and actionable rather than roleplaying.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  `Robot: ${status.nickname ?? status.name}`,
                  `Battery: ${status.batteryPercent}%`,
                  `Connected: ${status.isConnected ? "yes" : "no"}`,
                  `WirePod reachable: ${integration.wirePodReachable ? "yes" : "no"}`,
                  `Saved memory:\n${buildMemoryContext(memory)}`,
                  `User message: ${message}`
                ].join("\n")
              }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as unknown;
    return {
      reply: extractOutputText(payload),
      mode: "openai" as const
    };
  } catch {
    return {
      reply: await buildFallbackReply(controller, message, memory),
      mode: "fallback" as const
    };
  }
};
