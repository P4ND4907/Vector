import { Router, type Request, type Response } from "express";
import type { RobotController } from "../robot/types.js";
import { buildDiagnosticsSnapshot, runDiagnostics } from "../services/diagnosticsService.js";

export const createDiagnosticsRouter = (controller: RobotController) => {
  const router = Router();

  router.get("/", async (_request: Request, response: Response) => {
    response.json(await buildDiagnosticsSnapshot(controller));
  });

  router.post("/run", async (_request: Request, response: Response) => {
    response.json(await runDiagnostics(controller));
  });

  return router;
};
