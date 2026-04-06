import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  buildAiBrainChat,
  getAiMemory
} from "../services/aiBrainService.js";
import { executeAiCommand, previewAiCommand } from "../services/aiCommandService.js";
import type { RobotController } from "../robot/types.js";
import { buildOptionalModuleSnapshot, optionalModules } from "../services/optionalModules.js";

const envSchema = z.object({
  openaiApiKey: z.string(),
  openaiModel: z.string()
});

const routineRequestSchema = z.object({
  prompt: z.string().min(8).max(1200)
});

const commandRequestSchema = z.object({
  prompt: z.string().min(2).max(600)
});

const chatRequestSchema = z.object({
  message: z.string().min(1).max(1200)
});

const memorySaveSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.string().min(1).max(400)
});

const routineDraftSchema = z.object({
  name: z.string().min(1).max(80),
  triggerType: z.enum(["schedule", "interval", "battery-low", "disconnect", "manual"]),
  triggerValue: z.string().min(1).max(120),
  conditions: z.array(z.string().min(1).max(120)).max(6),
  actions: z
    .array(
      z.object({
        type: z.enum(["speak", "animation", "dock", "mute", "notify", "stop"]),
        value: z.string().max(160)
      })
    )
    .min(1)
    .max(4),
  delayMs: z.number().int().min(0).max(86_400_000),
  repeat: z.enum(["once", "hourly", "daily", "custom"]),
  explanation: z.string().min(1).max(240)
});

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

  throw new Error("OpenAI did not return routine draft text.");
};

const generateRoutineDraft = async (
  prompt: string,
  controller: RobotController,
  env: z.infer<typeof envSchema>
) => {
  const robot = await controller.getStatus();
  const existingRoutineNames = (await controller.getRoutines())
    .map((routine) => routine.name)
    .slice(0, 8);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.openaiModel,
      instructions:
        "You design safe, beginner-friendly robot routines for Vector Control Hub. Return only JSON that matches the provided schema. Prefer simple, realistic routines.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Robot name: ${robot.name}`,
                `Battery percent: ${robot.batteryPercent}`,
                `Connected: ${robot.isConnected ? "yes" : "no"}`,
                `Existing routines: ${existingRoutineNames.join(", ") || "none"}`,
                `User request: ${prompt}`
              ].join("\n")
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "vector_routine_draft",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              triggerType: {
                type: "string",
                enum: ["schedule", "interval", "battery-low", "disconnect", "manual"]
              },
              triggerValue: { type: "string" },
              conditions: {
                type: "array",
                items: { type: "string" }
              },
              actions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    type: {
                      type: "string",
                      enum: ["speak", "animation", "dock", "mute", "notify", "stop"]
                    },
                    value: { type: "string" }
                  },
                  required: ["type", "value"]
                }
              },
              delayMs: { type: "integer" },
              repeat: {
                type: "string",
                enum: ["once", "hourly", "daily", "custom"]
              },
              explanation: { type: "string" }
            },
            required: [
              "name",
              "triggerType",
              "triggerValue",
              "conditions",
              "actions",
              "delayMs",
              "repeat",
              "explanation"
            ]
          }
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${errorText.slice(0, 220)}`);
  }

  const payload = (await response.json()) as unknown;
  const outputText = extractOutputText(payload);
  const parsed = JSON.parse(outputText) as unknown;
  return routineDraftSchema.parse(parsed);
};

export const createAiRouter = (controller: RobotController, rawEnv: unknown) => {
  const env = envSchema.parse(rawEnv);
  const router = Router();

  const handleRouteError = (error: unknown, response: Response) => {
    const message = error instanceof Error ? error.message : "The AI command failed.";
    response.status(500).json({ message });
  };

  router.get("/status", async (_request: Request, response: Response) => {
    response.json({
      enabled: Boolean(env.openaiApiKey),
      model: env.openaiModel,
      modules: buildOptionalModuleSnapshot(optionalModules, env).optionalModules
    });
  });

  router.post("/chat", async (request: Request, response: Response) => {
    try {
      const body = chatRequestSchema.parse(request.body ?? {});
      const memory = await controller.getAiMemory();
      const result = await buildAiBrainChat({
        controller,
        env,
        message: body.message,
        memory
      });

      response.json({
        reply: result.reply,
        mode: result.mode,
        memoryCount: memory.length
      });
    } catch (error) {
      handleRouteError(error, response);
    }
  });

  router.post("/memory/save", async (request: Request, response: Response) => {
    try {
      const body = memorySaveSchema.parse(request.body ?? {});
      const memory = await controller.saveAiMemory(body);
      response.json({
        ok: true,
        saved: memory.find((item) => item.key.toLowerCase() === body.key.trim().toLowerCase()),
        items: memory
      });
    } catch (error) {
      handleRouteError(error, response);
    }
  });

  const handleMemoryGet = async (key: string | undefined, response: Response) => {
    const memory = getAiMemory(await controller.getAiMemory(), key);
    response.json({
      items: memory
    });
  };

  router.get("/memory/get", async (request: Request, response: Response) => {
    try {
      const key = typeof request.query.key === "string" ? request.query.key : undefined;
      await handleMemoryGet(key, response);
    } catch (error) {
      handleRouteError(error, response);
    }
  });

  router.post("/memory/get", async (request: Request, response: Response) => {
    try {
      const body = z.object({ key: z.string().min(1).max(80).optional() }).parse(request.body ?? {});
      await handleMemoryGet(body.key, response);
    } catch (error) {
      handleRouteError(error, response);
    }
  });

  router.post("/routine-draft", async (request: Request, response: Response) => {
    try {
      if (!env.openaiApiKey) {
        response.status(503).json({
          message:
            "OpenAI is not configured on the local server yet. Add OPENAI_API_KEY to server/.env.local."
        });
        return;
      }

      const body = routineRequestSchema.parse(request.body ?? {});
      response.json({
        routine: await generateRoutineDraft(body.prompt, controller, env)
      });
    } catch (error) {
      handleRouteError(error, response);
    }
  });

  router.post("/commands/preview", async (request: Request, response: Response) => {
    try {
      const body = commandRequestSchema.parse(request.body ?? {});
      const parsed = await previewAiCommand(body.prompt);

      if (!parsed.canExecute) {
        await controller.recordCommandGap({
          source: "ai",
          prompt: body.prompt,
          category: "unsupported",
          note: parsed.warnings[0] || "The shared command registry could not match this request yet."
        });
      }

      response.json({ parsed });
    } catch (error) {
      handleRouteError(error, response);
    }
  });

  router.post("/commands/execute", async (request: Request, response: Response) => {
    try {
      const body = commandRequestSchema.parse(request.body ?? {});
      const parsed = await previewAiCommand(body.prompt);
      if (!parsed.canExecute) {
        await controller.recordCommandGap({
          source: "ai",
          prompt: body.prompt,
          category: "unsupported",
          note: parsed.warnings[0] || "The shared command registry could not match this request yet."
        });
        response.status(400).json({
          message: parsed.warnings[0] || "I could not convert that into a supported Vector command yet.",
          parsed
        });
        return;
      }

      response.json(await executeAiCommand(controller, parsed));
    } catch (error) {
      handleRouteError(error, response);
    }
  });

  return router;
};
