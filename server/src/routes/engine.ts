import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { RobotController } from "../robot/types.js";
import type { EngineManager } from "../engine/engineManager.js";

type BuildEnvResult = ReturnType<typeof import("../utils/env.js").buildEnv>;

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: (error?: unknown) => void) => {
    void handler(request, response).catch(next);
  };

const providerSchema = z.object({
  provider: z.enum(["embedded", "wirepod", "mock"])
});

const settingsSchema = z.object({
  activeProvider: z.enum(["embedded", "wirepod", "mock"]).optional(),
  wirepodBaseUrl: z.string().url().optional(),
  wirepodTimeoutMs: z.number().int().min(100).max(30_000).optional(),
  autoFallback: z.boolean().optional()
});

export const createEngineRouter = (
  _controller: RobotController,
  _env: BuildEnvResult,
  engineManager: EngineManager
) => {
  const router = Router();

  router.get(
    "/status",
    asyncRoute(async (_request, response) => {
      response.json(await engineManager.getActiveProviderStatus());
    })
  );

  router.get(
    "/providers",
    asyncRoute(async (_request, response) => {
      response.json({ providers: await engineManager.getAllProviderStatuses() });
    })
  );

  router.post(
    "/provider",
    asyncRoute(async (request, response) => {
      const { provider } = providerSchema.parse(request.body ?? {});
      engineManager.switchProvider(provider);
      response.json({
        activeProvider: engineManager.getActiveProviderName(),
        status: await engineManager.getActiveProviderStatus()
      });
    })
  );

  router.get("/settings", (_request, response) => {
    response.json(engineManager.getSettings());
  });

  router.post(
    "/settings",
    asyncRoute(async (request, response) => {
      const patch = settingsSchema.parse(request.body ?? {});
      response.json(engineManager.updateSettings(patch));
    })
  );

  return router;
};
