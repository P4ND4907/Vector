import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { RobotController } from "../robot/types.js";

const routineSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  triggerType: z.string(),
  triggerValue: z.string(),
  conditions: z.array(z.string()),
  actions: z.array(
    z.object({
      type: z.string(),
      value: z.string()
    })
  ),
  delayMs: z.number(),
  repeat: z.string(),
  lastRunAt: z.string().optional()
});

export const createRoutineRouter = (controller: RobotController) => {
  const router = Router();

  router.get("/", async (_request: Request, response: Response) => {
    response.json({
      routines: await controller.getRoutines()
    });
  });

  router.post("/", async (request: Request, response: Response) => {
    const routine = routineSchema.parse(request.body);
    response.json({
      routine: await controller.saveRoutine(routine)
    });
  });

  router.patch("/:id", async (request: Request, response: Response) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const patch = routineSchema.partial().parse(request.body);
    response.json({
      routine: await controller.updateRoutine(params.id, patch)
    });
  });

  router.delete("/:id", async (request: Request, response: Response) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    response.json({
      deleted: await controller.deleteRoutine(params.id)
    });
  });

  return router;
};
