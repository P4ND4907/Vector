import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { createBridgeProviderManager } from "../engine/bridgeProviderManager.js";
import type { RobotController } from "../robot/types.js";
import { createAiRouter } from "./ai.js";
import { createAppRouter } from "./app.js";
import { createDiagnosticsRouter } from "./diagnostics.js";
import { createMonetizationRouter } from "./monetization.js";
import { createRoutineRouter } from "./routines.js";
import { createSettingsRouter } from "./settings.js";
import { createSupportRouter } from "./support.js";

type BuildEnvResult = ReturnType<typeof import("../utils/env.js").buildEnv>;

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: (error?: unknown) => void) => {
    void handler(request, response).catch(next);
  };

const providerSchema = z.object({
  provider: z.enum(["embedded", "wirepod", "mock"])
});

const pairSchema = z.object({
  serial: z.string().trim().min(1, "Robot serial is required."),
  ipAddress: z.string().trim().min(1, "Robot IP address is required."),
  name: z.string().trim().optional(),
  token: z.string().trim().optional()
});

const connectSchema = z.object({
  serial: z.string().trim().optional(),
  ipAddress: z.string().trim().optional(),
  name: z.string().trim().optional(),
  token: z.string().trim().optional()
});

export const createEngineRouter = (controller: RobotController, env: BuildEnvResult) => {
  const router = Router();
  const providers = createBridgeProviderManager(controller, env.dataFilePath);

  router.get(
    "/health",
    asyncRoute(async (_request, response) => {
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        provider: providers.getProviderName(),
        health: await provider.health(),
        integration: await controller.getIntegrationInfo()
      });
    })
  );

  router.get(
    "/status",
    asyncRoute(async (_request, response) => {
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        provider: providers.getProviderName(),
        robot: await provider.getStatus(),
        integration: await controller.getIntegrationInfo(),
        pairings: providers.getPairings(),
        engineSettings: providers.getEngineSettings()
      });
    })
  );

  router.post(
    "/provider",
    asyncRoute(async (request, response) => {
      const payload = providerSchema.parse(request.body ?? {});
      providers.setProviderName(payload.provider);
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        provider: providers.getProviderName(),
        health: await provider.health()
      });
    })
  );

  router.post(
    "/pair",
    asyncRoute(async (request, response) => {
      const payload = pairSchema.parse(request.body ?? {});
      const provider = providers.getProvider();
      await provider.init();
      const pairing = {
        serial: payload.serial,
        ipAddress: payload.ipAddress,
        name: payload.name,
        token: payload.token,
        pairedAt: new Date().toISOString()
      };
      providers.savePairing(pairing);
      response.json({
        pairing: await provider.pairRobot(pairing),
        pairings: providers.getPairings()
      });
    })
  );

  router.post(
    "/connect",
    asyncRoute(async (request, response) => {
      const payload = connectSchema.parse(request.body ?? {});
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        robot: await provider.connect(payload),
        integration: await controller.getIntegrationInfo()
      });
    })
  );

  router.post(
    "/disconnect",
    asyncRoute(async (_request, response) => {
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        robot: await provider.disconnect(),
        integration: await controller.getIntegrationInfo()
      });
    })
  );

  router.get(
    "/discover",
    asyncRoute(async (_request, response) => {
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        robots: await provider.discoverRobots(),
        pairings: providers.getPairings()
      });
    })
  );

  router.post(
    "/repair/refresh-health",
    asyncRoute(async (_request, response) => {
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        health: await provider.health(),
        integration: await controller.getIntegrationInfo()
      });
    })
  );

  router.post(
    "/repair/scan-again",
    asyncRoute(async (_request, response) => {
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        robots: await provider.discoverRobots()
      });
    })
  );

  router.post(
    "/repair/reconnect",
    asyncRoute(async (_request, response) => {
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        robot: await provider.connect(),
        integration: await controller.getIntegrationInfo()
      });
    })
  );

  router.post(
    "/repair/disconnect",
    asyncRoute(async (_request, response) => {
      const provider = providers.getProvider();
      await provider.init();
      response.json({
        robot: await provider.disconnect(),
        integration: await controller.getIntegrationInfo()
      });
    })
  );

  router.post(
    "/repair/clear-robot",
    asyncRoute(async (_request, response) => {
      providers.clearPairings();
      await controller.updateSettings({ serial: "" });
      response.json({
        ok: true,
        message: "Saved robot pairing data was cleared.",
        pairings: providers.getPairings()
      });
    })
  );

  router.post(
    "/repair/reset-settings",
    asyncRoute(async (_request, response) => {
      await controller.updateSettings({
        autoDetectWirePod: true,
        customWirePodEndpoint: "",
        reconnectOnStartup: true
      });
      response.json({
        ok: true,
        message: "Engine settings were reset to defaults.",
        settings: await controller.getSettings()
      });
    })
  );

  router.use("/", createAppRouter(controller));
  router.use("/diagnostics", createDiagnosticsRouter(controller));
  router.use("/settings", createSettingsRouter(controller));
  router.use("/support", createSupportRouter(controller));
  router.use("/routines", createRoutineRouter(controller));
  router.use("/ai", createAiRouter(controller, env));
  router.use("/monetization", createMonetizationRouter(env));

  return router;
};
