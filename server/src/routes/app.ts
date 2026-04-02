import { Router, type Request, type Response } from "express";
import type { RobotController } from "../robot/types.js";

export const createAppRouter = (controller: RobotController) => {
  const router = Router();

  router.get("/bootstrap", async (_request: Request, response: Response) => {
    const robot = await controller.getStatus();
    const robots = await controller.discoverRobots();
    const integration = await controller.getIntegrationInfo();
    const [settings, routines, logs] = await Promise.all([
      controller.getSettings(),
      controller.getRoutines(),
      controller.getLogs()
    ]);

    response.json({
      robot,
      integration,
      settings,
      routines,
      logs,
      robots,
      snapshots: await controller.getSnapshots()
    });
  });

  return router;
};
