/**
 * server/src/index.improvements.ts
 *
 * EXAMPLE FILE – for maintainer review only.
 *
 * This file is NOT imported anywhere. It shows suggested improvements to
 * server/src/index.ts without overwriting the stable original. Maintainers
 * can review the diffs and cherry-pick the changes they want to adopt.
 *
 * Improvements demonstrated here:
 *   1. Request logging middleware (method, path, status, duration)
 *   2. Input length validation on /vector/speak
 *   3. Richer /health response (uptime, timestamp, version)
 *   4. Graceful SIGTERM/SIGINT shutdown
 *
 * To adopt: copy the relevant sections into server/src/index.ts.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { createAppRouter } from "./routes/app.js";
import { createAiRouter } from "./routes/ai.js";
import { createDiagnosticsRouter } from "./routes/diagnostics.js";
import { createLogRouter } from "./routes/logs.js";
import { createMonetizationRouter } from "./routes/monetization.js";
import { createRobotRouter } from "./routes/robot.js";
import { createRoutineRouter } from "./routes/routines.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createSupportRouter } from "./routes/support.js";
import { createHybridRobotController } from "./robot/hybridRobotController.js";
import { buildEnv } from "./utils/env.js";

// ── Improvement 1: typed request logger ──────────────────────────────────────

function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const start = Date.now();
  response.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${request.method} ${request.path} → ${response.statusCode} (+${duration}ms)`
    );
  });
  next();
}

// ── App factory ───────────────────────────────────────────────────────────────

export const createServerApp = (env = buildEnv()) => {
  const app = express();
  const controller = createHybridRobotController({
    wirePodBaseUrl: env.wirePodBaseUrl,
    wirePodTimeoutMs: env.wirePodTimeoutMs,
    dataFilePath: env.dataFilePath,
  });

  app.use(cors());
  app.use(express.json());

  // Improvement 1: attach request logger
  app.use(requestLogger);

  // Improvement 3: richer health endpoint
  app.get("/health", (_request: Request, response: Response) => {
    response.json({
      ok: true,
      service: "vector-control-hub-server",
      mode: env.mode,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/app", createAppRouter(controller));
  app.use("/api/robot", createRobotRouter(controller));
  app.use("/api/routines", createRoutineRouter(controller));
  app.use("/api/logs", createLogRouter(controller));
  app.use("/api/ai", createAiRouter(controller, env));
  app.use("/api/diagnostics", createDiagnosticsRouter(controller));
  app.use("/api/settings", createSettingsRouter(controller));
  app.use("/api/support", createSupportRouter(controller));
  app.use("/api/monetization", createMonetizationRouter(env));

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
        integration: await controller.getIntegrationInfo(),
      });
    } catch (error) {
      next(error);
    }
  });

  // Improvement 2: input validation on /vector/speak
  app.post("/vector/speak", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const text = String(request.body?.text ?? "").trim();

      if (!text) {
        response.status(400).json({ message: "text is required." });
        return;
      }
      if (text.length > 1_000) {
        response.status(400).json({ message: "text must be 1,000 characters or fewer." });
        return;
      }

      response.json({
        log: await controller.speak({ text }),
        robot: await controller.getStatus(),
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
            request.body?.durationMs === undefined
              ? undefined
              : Number(request.body.durationMs),
        }),
        robot: await controller.getStatus(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/vector/dock", async (_request: Request, response: Response, next: NextFunction) => {
    try {
      response.json({
        log: await controller.dock(),
        robot: await controller.getStatus(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/vector/stop", async (_request: Request, response: Response, next: NextFunction) => {
    try {
      response.json({
        log: await controller.drive({ direction: "stop", speed: 0 }),
        robot: await controller.getStatus(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((_request: Request, response: Response) => {
    response.status(404).json({
      message: "That route is not part of Vector Control Hub yet.",
    });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        message: error.issues[0]?.message || "Invalid request.",
      });
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unexpected local server error.";
    console.error("[server] Unhandled error:", error);
    response.status(500).json({ message });
  });

  return app;
};

// ── Server start with graceful shutdown ───────────────────────────────────────

export const startServer = (env = buildEnv(), host = "0.0.0.0") =>
  new Promise<import("node:http").Server>((resolve) => {
    const app = createServerApp(env);
    const server = app.listen(env.port, host, () => {
      console.log(
        `Vector Control Hub server listening on http://${host}:${env.port}`
      );
      resolve(server);
    });

    // Improvement 4: graceful shutdown
    function shutdown(signal: string): void {
      console.log(`[server] ${signal} received – shutting down gracefully...`);
      server.close(() => {
        console.log("[server] HTTP server closed.");
        process.exit(0);
      });
      // Force-exit after 10 seconds if connections do not drain
      setTimeout(() => {
        console.error("[server] Forced exit after timeout.");
        process.exit(1);
      }, 10_000).unref();
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
  });

const directRunPath = process.argv[1]
  ? path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
  : false;

if (directRunPath) {
  void startServer();
}
