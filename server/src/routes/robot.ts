import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { RobotController } from "../robot/types.js";

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: (error?: unknown) => void) => {
    void handler(request, response).catch(next);
  };

const connectSchema = z.object({
  serial: z.string().optional(),
  name: z.string().optional(),
  nickname: z.string().optional(),
  ipAddress: z.string().optional(),
  token: z.string().optional()
});

export const createRobotRouter = (controller: RobotController) => {
  const router = Router();

  router.get("/status", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      robot: await controller.getStatus(),
      integration: await controller.getIntegrationInfo()
    });
  }));

  router.get("/discover", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      robots: await controller.discoverRobots(),
      integration: await controller.getIntegrationInfo()
    });
  }));

  router.post("/connect", asyncRoute(async (request: Request, response: Response) => {
    const payload = connectSchema.parse(request.body ?? {});
    response.json({
      robot: await controller.connect(payload),
      integration: await controller.getIntegrationInfo()
    });
  }));

  router.post("/disconnect", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      robot: await controller.disconnect(),
      integration: await controller.getIntegrationInfo()
    });
  }));

  router.post("/drive", asyncRoute(async (request: Request, response: Response) => {
    const body = z
      .object({
        direction: z.string(),
        speed: z.number().min(0).max(100),
        durationMs: z.number().int().min(0).max(30_000).optional()
      })
      .parse(request.body);
    response.json({
      log: await controller.drive(body),
      robot: await controller.getStatus()
    });
  }));

  router.post("/head", asyncRoute(async (request: Request, response: Response) => {
    const body = z.object({ angle: z.number().min(-25).max(44) }).parse(request.body);
    response.json({
      log: await controller.head(body),
      robot: await controller.getStatus()
    });
  }));

  router.post("/lift", asyncRoute(async (request: Request, response: Response) => {
    const body = z.object({ height: z.number().min(0).max(100) }).parse(request.body);
    response.json({
      log: await controller.lift(body),
      robot: await controller.getStatus()
    });
  }));

  router.post("/speak", asyncRoute(async (request: Request, response: Response) => {
    const body = z.object({ text: z.string().min(1) }).parse(request.body);
    response.json({
      log: await controller.speak(body),
      robot: await controller.getStatus()
    });
  }));

  router.post("/animation", asyncRoute(async (request: Request, response: Response) => {
    const body = z.object({ animationId: z.string().min(1) }).parse(request.body);
    response.json({
      log: await controller.animation(body),
      robot: await controller.getStatus()
    });
  }));

  router.post("/dock", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      log: await controller.dock(),
      robot: await controller.getStatus()
    });
  }));

  router.post("/wake", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      log: await controller.wake(),
      robot: await controller.getStatus()
    });
  }));

  router.post("/sleep", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      log: await controller.drive({ direction: "stop", speed: 0 }),
      robot: await controller.getStatus()
    });
  }));

  router.post("/mute", asyncRoute(async (request: Request, response: Response) => {
    const body = z.object({ isMuted: z.boolean() }).parse(request.body);
    response.json({
      log: await controller.toggleMute(body),
      robot: await controller.getStatus()
    });
  }));

  router.post("/volume", asyncRoute(async (request: Request, response: Response) => {
    const body = z.object({ volume: z.number().min(0).max(5) }).parse(request.body);
    response.json({
      log: await controller.setVolume(body),
      robot: await controller.getStatus()
    });
  }));

  router.get("/camera", asyncRoute(async (_request: Request, response: Response) => {
    response.json({
      snapshots: await controller.getSnapshots(),
      streamUrl: await controller.getCameraStreamUrl(),
      integration: await controller.getIntegrationInfo()
    });
  }));

  router.post("/camera/sync", asyncRoute(async (_request: Request, response: Response) => {
    const result = await controller.syncPhotos();
    response.json({
      snapshots: result.snapshots,
      latestSnapshot: result.latestSnapshot,
      syncedCount: result.syncedCount,
      note: result.note,
      streamUrl: await controller.getCameraStreamUrl()
    });
  }));

  router.post("/camera/capture", asyncRoute(async (_request: Request, response: Response) => {
    const result = await controller.capturePhoto();
    response.json({
      snapshots: result.snapshots,
      latestSnapshot: result.latestSnapshot,
      syncedCount: result.syncedCount,
      note: result.note,
      streamUrl: await controller.getCameraStreamUrl()
    });
  }));

  router.get("/camera/photo/:photoId", asyncRoute(async (request: Request, response: Response) => {
    const photoId = Array.isArray(request.params.photoId) ? request.params.photoId[0] : request.params.photoId;
    const asset = await controller.getPhotoImage(photoId, "full");
    response.setHeader("Content-Type", asset.contentType);
    response.setHeader("Cache-Control", "no-store");
    response.send(Buffer.from(asset.buffer));
  }));

  router.delete("/camera/photo/:photoId", asyncRoute(async (request: Request, response: Response) => {
    const photoId = Array.isArray(request.params.photoId) ? request.params.photoId[0] : request.params.photoId;
    const result = await controller.deletePhoto(photoId);
    response.json({
      snapshots: result.snapshots,
      latestSnapshot: result.latestSnapshot,
      syncedCount: result.syncedCount,
      note: result.note,
      streamUrl: await controller.getCameraStreamUrl()
    });
  }));

  router.get("/camera/stream", asyncRoute(async (_request: Request, response: Response) => {
    const streamUrl = await controller.getCameraStreamUrl();
    if (!streamUrl) {
      response.status(503).json({
        message: "Live camera stream is unavailable right now."
      });
      return;
    }

    response.redirect(307, streamUrl);
  }));

  return router;
};
