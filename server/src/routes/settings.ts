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

  return router;
};
