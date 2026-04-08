import os from "node:os";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { RobotController } from "../robot/types.js";

const DEFAULT_BACKEND_PORT = 8787;

const getBackendPort = (request: Request) => {
  const forwardedPort = request.header("x-forwarded-port");
  if (forwardedPort && /^\d+$/.test(forwardedPort)) {
    return Number(forwardedPort);
  }

  const host = request.header("host");
  const hostPort = host?.match(/:(\d+)$/)?.[1];
  if (hostPort) {
    return Number(hostPort);
  }

  return DEFAULT_BACKEND_PORT;
};

const collectMobileBackendTargets = (request: Request) => {
  const port = getBackendPort(request);
  const targets = new Map<string, { label: string; url: string; kind: "localhost" | "lan" }>();

  const addTarget = (url: string, label: string, kind: "localhost" | "lan") => {
    if (!targets.has(url)) {
      targets.set(url, { label, url, kind });
    }
  };

  addTarget(`http://127.0.0.1:${port}`, "Same-device default", "localhost");
  addTarget(`http://localhost:${port}`, "Localhost", "localhost");

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) {
        continue;
      }

      addTarget(`http://${address.address}:${port}`, `LAN backend (${address.address})`, "lan");
    }
  }

  return Array.from(targets.values());
};

const settingsPatchSchema = z.object({
  theme: z.enum(["dark", "light"]).optional(),
  colorTheme: z.enum(["vector", "midnight", "ice"]).optional(),
  autoDetectWirePod: z.boolean().optional(),
  customWirePodEndpoint: z.string().optional(),
  mockMode: z.boolean().optional(),
  reconnectOnStartup: z.boolean().optional(),
  protectChargingUntilFull: z.boolean().optional(),
  pollingIntervalMs: z.number().int().min(1000).max(30000).optional(),
  liveUpdateMode: z.enum(["polling"]).optional(),
  serial: z.string().optional()
});

const wirePodWeatherSchema = z.object({
  provider: z.string().default(""),
  key: z.string().default(""),
  unit: z.string().optional()
});

const wirePodSetupSchema = z.object({
  language: z.string().optional(),
  connectionMode: z.enum(["escape-pod", "ip"]).optional(),
  port: z.string().optional()
});

export const createSettingsRouter = (controller: RobotController) => {
  const router = Router();

  router.get("/", async (_request: Request, response: Response) => {
    response.json({
      settings: await controller.getSettings(),
      integration: await controller.getIntegrationInfo()
    });
  });

  router.get("/mobile-targets", (request: Request, response: Response) => {
    response.json({
      targets: collectMobileBackendTargets(request)
    });
  });

  router.patch("/", async (request: Request, response: Response) => {
    const patch = settingsPatchSchema.parse(request.body ?? {});
    response.json({
      settings: await controller.updateSettings(patch),
      integration: await controller.getIntegrationInfo()
    });
  });

  router.get("/wirepod/weather", async (_request: Request, response: Response) => {
    response.json({
      weather: await controller.getWirePodWeatherConfig()
    });
  });

  router.get("/bridge/weather", async (_request: Request, response: Response) => {
    response.json({
      weather: await controller.getWirePodWeatherConfig()
    });
  });

  router.post("/wirepod/weather", async (request: Request, response: Response) => {
    const payload = wirePodWeatherSchema.parse(request.body ?? {});
    response.json({
      weather: await controller.setWirePodWeatherConfig(payload)
    });
  });

  router.post("/bridge/weather", async (request: Request, response: Response) => {
    const payload = wirePodWeatherSchema.parse(request.body ?? {});
    response.json({
      weather: await controller.setWirePodWeatherConfig(payload)
    });
  });

  router.get("/wirepod/setup", async (_request: Request, response: Response) => {
    response.json({
      setup: await controller.getWirePodSetupStatus()
    });
  });

  router.get("/bridge/setup", async (_request: Request, response: Response) => {
    response.json({
      setup: await controller.getWirePodSetupStatus()
    });
  });

  router.post("/wirepod/setup", async (request: Request, response: Response) => {
    const payload = wirePodSetupSchema.parse(request.body ?? {});
    response.json({
      setup: await controller.finishWirePodSetup(payload)
    });
  });

  router.post("/bridge/setup", async (request: Request, response: Response) => {
    const payload = wirePodSetupSchema.parse(request.body ?? {});
    response.json({
      setup: await controller.finishWirePodSetup(payload)
    });
  });

  return router;
};
