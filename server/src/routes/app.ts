import { Router, type Request, type Response } from "express";
import type { RobotController } from "../robot/types.js";
import {
  buildOptionalModuleSnapshot,
  optionalModules
} from "../services/optionalModules.js";
import { buildEnv } from "../utils/env.js";

export const createAppRouter = (controller: RobotController) => {
  const router = Router();
  const env = buildEnv();
  const getModuleSnapshot = () => buildOptionalModuleSnapshot(optionalModules, env);

  router.get("/bootstrap", async (_request: Request, response: Response) => {
    const robot = await controller.getStatus();
    const robots = await controller.discoverRobots();
    const integration = await controller.getIntegrationInfo();
    const [settings, routines, logs, supportReports] = await Promise.all([
      controller.getSettings(),
      controller.getRoutines(),
      controller.getLogs(),
      controller.getSupportReports()
    ]);

    response.json({
      robot,
      integration,
      settings,
      routines,
      logs,
      robots,
      snapshots: await controller.getSnapshots(),
      supportReports,
      ...getModuleSnapshot()
    });
  });

  router.get("/modules", (_request: Request, response: Response) => {
    response.json(getModuleSnapshot());
  });

  return router;
};
