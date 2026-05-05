import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createLicenseService } from "../licensing/licenseService.js";

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: (error?: unknown) => void) => {
    void handler(request, response).catch(next);
  };

export const createLicenseRouter = (service: ReturnType<typeof createLicenseService>) => {
  const router = Router();

  router.post(
    "/activate",
    asyncRoute(async (request, response) => {
      const payload = z.object({ key: z.string().trim() }).parse(request.body ?? {});
      response.json({
        license: service.activate(payload.key)
      });
    })
  );

  router.get("/status", (_request, response) => {
    response.json({
      license: service.getStatus()
    });
  });

  return router;
};
