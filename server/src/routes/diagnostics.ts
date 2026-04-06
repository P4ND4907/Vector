import { Router, type Request, type Response } from "express";
import type { RobotController } from "../robot/types.js";
import { buildDiagnosticsSnapshot, runDiagnostics } from "../services/diagnosticsService.js";

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: (error?: unknown) => void) => {
    void handler(request, response).catch(next);
  };

export const createDiagnosticsRouter = (controller: RobotController) => {
  const router = Router();

  router.get("/", asyncRoute(async (_request: Request, response: Response) => {
    response.json(await buildDiagnosticsSnapshot(controller));
  }));

  router.get("/voice", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      voice: await controller.getVoiceDiagnostics(),
      integration: await controller.getIntegrationInfo(),
      robot: await controller.getStatus()
    });
  }));

  router.post("/voice/repair", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      log: await controller.repairVoiceSetup(),
      voice: await controller.getVoiceDiagnostics(),
      integration: await controller.getIntegrationInfo(),
      robot: await controller.getStatus()
    });
  }));

  router.post("/run", asyncRoute(async (_request: Request, response: Response) => {
    response.json(await runDiagnostics(controller));
  }));

  return router;
};
