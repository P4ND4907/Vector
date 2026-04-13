import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createLicenseStore } from "../licensing/licenseStore.js";
import { createLicenseService } from "../licensing/licenseService.js";

const activateSchema = z.object({
  key: z.string().min(1, "License key is required."),
  email: z.string().email().optional().or(z.literal(""))
});

export const createLicenseRouter = (filePath?: string) => {
  const store = createLicenseStore(filePath);
  const service = createLicenseService(store);
  const router = Router();

  /**
   * GET /api/license/status
   * Returns the current license tier and activation state.
   */
  router.get("/status", (_request: Request, response: Response) => {
    response.json(service.getStatus());
  });

  /**
   * POST /api/license/activate
   * Body: { key: string, email?: string }
   * Stores the key locally and returns the resolved tier.
   */
  router.post("/activate", (request: Request, response: Response) => {
    const { key, email } = activateSchema.parse(request.body ?? {});
    const result = service.activate(key, email || undefined);
    response.status(result.success ? 200 : 400).json(result);
  });

  return router;
};
