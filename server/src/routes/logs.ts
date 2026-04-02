import { Router, type Request, type Response } from "express";
import type { RobotController } from "../robot/types.js";

export const createLogRouter = (controller: RobotController) => {
  const router = Router();

  router.get("/", async (_request: Request, response: Response) => {
    response.json({
      logs: await controller.getLogs()
    });
  });

  return router;
};
