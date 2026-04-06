import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { RobotController } from "../robot/types.js";

const settingsPatchSchema = z.object({
  theme: z.enum(["dark", "light"]).optional(),
  colorTheme: z.enum(["vector", "midnight", "ice"]).optional(),
  autoDetectWirePod: z.boolean().optional(),
  customWirePodEndpoint: z.string().optional(),
  mockMode: z.boolean().optional(),
  reconnectOnStartup: z.boolean().optional(),
  pollingIntervalMs: z.number().int().min(2000).max(30000).optional(),
  liveUpdateMode: z.enum(["polling"]).optional(),
  serial: z.string().optional()
});

const wirePodWeatherSchema = z.object({
  provider: z.string().default(""),
  key: z.string().default(""),
  unit: z.string().optional()
});

const wirePodSetupSchema = z.object({
  language: z.string().optional(),
  connectionMode: z.enum(["escape-pod", "ip"]).optional(),
  port: z.string().optional()
});

export const createSettingsRouter = (controller: RobotController) => {
  const router = Router();

  router.get("/", async (_request: Request, response: Response) => {
    response.json({
      settings: await controller.getSettings(),
      integration: await controller.getIntegrationInfo()
    });
  });

  router.patch("/", async (request: Request, response: Response) => {
    const patch = settingsPatchSchema.parse(request.body ?? {});
    response.json({
      settings: await controller.updateSettings(patch),
      integration: await controller.getIntegrationInfo()
    });
  });

  router.get("/wirepod/weather", async (_request: Request, response: Response) => {
    response.json({
      weather: await controller.getWirePodWeatherConfig()
    });
  });

  router.post("/wirepod/weather", async (request: Request, response: Response) => {
    const payload = wirePodWeatherSchema.parse(request.body ?? {});
    response.json({
      weather: await controller.setWirePodWeatherConfig(payload)
    });
  });

  router.get("/wirepod/setup", async (_request: Request, response: Response) => {
    response.json({
      setup: await controller.getWirePodSetupStatus()
    });
  });

  router.post("/wirepod/setup", async (request: Request, response: Response) => {
    const payload = wirePodSetupSchema.parse(request.body ?? {});
    response.json({
      setup: await controller.finishWirePodSetup(payload)
    });
  });

  return router;
};
