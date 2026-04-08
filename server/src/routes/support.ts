import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { RobotController } from "../robot/types.js";
import { buildDiagnosticsSnapshot } from "../services/diagnosticsService.js";

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: (error?: unknown) => void) => {
    void handler(request, response).catch(next);
  };

const reportSchema = z.object({
  summary: z.string().trim().min(4).max(140),
  details: z.string().trim().min(8).max(4000),
  contactEmail: z.string().trim().email().max(200).optional().or(z.literal(""))
});

export const createSupportRouter = (controller: RobotController) => {
  const router = Router();

  router.get(["", "/"], asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      reports: await controller.getSupportReports()
    });
  }));

  router.get("/bundle", asyncRoute(async (_request: Request, response: Response) => {
    const [diagnosticsSnapshot, voiceDiagnostics, supportReports, commandGaps, settings, bridgeWatchdog] =
      await Promise.all([
        buildDiagnosticsSnapshot(controller),
        controller.getVoiceDiagnostics(),
        controller.getSupportReports(),
        controller.getCommandGaps(),
        controller.getSettings(),
        controller.getBridgeWatchdogStatus()
      ]);

    response.json({
      generatedAt: new Date().toISOString(),
      diagnosticsSnapshot,
      voiceDiagnostics,
      supportReports,
      commandGaps,
      settings,
      bridgeWatchdog
    });
  }));

  router.post("/repair", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      repair: await controller.quickRepair(),
      snapshot: await buildDiagnosticsSnapshot(controller)
    });
  }));

  router.post("/report", asyncRoute(async (request: Request, response: Response) => {
    const payload = reportSchema.parse(request.body ?? {});

    response.json({
      report: await controller.reportProblem(payload),
      reports: await controller.getSupportReports(),
      snapshot: await buildDiagnosticsSnapshot(controller)
    });
  }));

  return router;
};
