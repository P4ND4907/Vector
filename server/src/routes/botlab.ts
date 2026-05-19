import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { RobotController } from "../robot/types.js";
import {
  getBotLabManifest,
  getBotLabSessions,
  importBotLabPayload,
  recordBotLabRun,
  resolveBotLabMarker
} from "../services/botlabTileService.js";

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: (error?: unknown) => void) => {
    void handler(request, response).catch(next);
  };

const markerSchema = z.object({
  markerId: z.number().int().positive()
});

const runSchema = z.object({
  missionId: z.string().trim().min(1),
  result: z.enum(["success", "partial", "failed"]),
  sessionId: z.string().trim().optional(),
  note: z.string().trim().optional()
});

export const createBotLabRouter = (controller: RobotController) => {
  const router = Router();

  router.get(
    "/manifest",
    asyncRoute(async (_request, response) => {
      response.json(getBotLabManifest());
    })
  );

  router.get(
    "/sessions",
    asyncRoute(async (_request, response) => {
      response.json(await getBotLabSessions(controller));
    })
  );

  router.post(
    "/import",
    asyncRoute(async (request, response) => {
      response.json(await importBotLabPayload(controller, request.body));
    })
  );

  router.post(
    "/marker",
    asyncRoute(async (request, response) => {
      const payload = markerSchema.parse(request.body ?? {});
      response.json(resolveBotLabMarker(payload.markerId));
    })
  );

  router.post(
    "/runs",
    asyncRoute(async (request, response) => {
      const payload = runSchema.parse(request.body ?? {});
      response.json(await recordBotLabRun(controller, payload));
    })
  );

  return router;
};
