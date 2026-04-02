import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { createAppRouter } from "./routes/app.js";
import { createAiRouter } from "./routes/ai.js";
import { createDiagnosticsRouter } from "./routes/diagnostics.js";
import { createLogRouter } from "./routes/logs.js";
import { createRobotRouter } from "./routes/robot.js";
import { createRoutineRouter } from "./routes/routines.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createHybridRobotController } from "./robot/hybridRobotController.js";
import { buildEnv } from "./utils/env.js";

const env = buildEnv();
const app = express();
const controller = createHybridRobotController({
  wirePodBaseUrl: env.wirePodBaseUrl,
  wirePodTimeoutMs: env.wirePodTimeoutMs,
  dataFilePath: env.dataFilePath
});

app.use(cors());
app.use(express.json());

app.get("/health", (_request: Request, response: Response) => {
  response.json({
    ok: true,
    service: "vector-control-hub-server",
    mode: env.mode
  });
});

app.use("/api/app", createAppRouter(controller));
app.use("/api/robot", createRobotRouter(controller));
app.use("/api/routines", createRoutineRouter(controller));
app.use("/api/logs", createLogRouter(controller));
app.use("/api/ai", createAiRouter(controller, env));
app.use("/api/diagnostics", createDiagnosticsRouter(controller));
app.use("/api/settings", createSettingsRouter(controller));

app.get("/vector/status", async (_request: Request, response: Response, next: NextFunction) => {
  try {
    const robot = await controller.getStatus();
    response.json({
      online: robot.isConnected,
      battery: robot.batteryPercent,
      docked: robot.isDocked,
      charging: robot.isCharging,
      lastSeen: robot.lastSeen,
      endpoint: (await controller.getIntegrationInfo()).wirePodBaseUrl,
      robot,
      integration: await controller.getIntegrationInfo()
    });
  } catch (error) {
    next(error);
  }
});

app.post("/vector/speak", async (request: Request, response: Response, next: NextFunction) => {
  try {
    const text = String(request.body?.text ?? "");
    response.json({
      log: await controller.speak({ text }),
      robot: await controller.getStatus()
    });
  } catch (error) {
    next(error);
  }
});

app.post("/vector/move", async (request: Request, response: Response, next: NextFunction) => {
  try {
    response.json({
      log: await controller.drive({
        direction: String(request.body?.direction ?? "forward"),
        speed: Number(request.body?.speed ?? 60),
        durationMs:
          request.body?.durationMs === undefined ? undefined : Number(request.body.durationMs)
      }),
      robot: await controller.getStatus()
    });
  } catch (error) {
    next(error);
  }
});

app.post("/vector/dock", async (_request: Request, response: Response, next: NextFunction) => {
  try {
    response.json({
      log: await controller.dock(),
      robot: await controller.getStatus()
    });
  } catch (error) {
    next(error);
  }
});

app.post("/vector/stop", async (_request: Request, response: Response, next: NextFunction) => {
  try {
    response.json({
      log: await controller.drive({ direction: "stop", speed: 0 }),
      robot: await controller.getStatus()
    });
  } catch (error) {
    next(error);
  }
});

app.use((_request: Request, response: Response) => {
  response.status(404).json({
    message: "That route is not part of Vector Control Hub yet."
  });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      message: error.issues[0]?.message || "Invalid request."
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected local server error.";
  response.status(500).json({
    message
  });
});

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Vector Control Hub server listening on http://0.0.0.0:${env.port}`);
});
