import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { buildEnv } from "../utils/env.js";

export type EngineProvider = "embedded" | "wirepod" | "external";

export interface EngineProviderInfo {
  id: EngineProvider;
  label: string;
  description: string;
  available: boolean;
}

const ALL_PROVIDERS: EngineProviderInfo[] = [
  {
    id: "embedded",
    label: "Embedded (default)",
    description:
      "The built-in local engine ships inside Vector Control Hub. No extra installation needed.",
    available: true
  },
  {
    id: "wirepod",
    label: "WirePod",
    description:
      "WirePod is an open-source local bridge. Select this if you run WirePod separately on your network.",
    available: true
  },
  {
    id: "external",
    label: "External endpoint",
    description:
      "Point the app at any custom HTTP endpoint that speaks the Vector bridge protocol.",
    available: true
  }
];

/** In-process mutable state so the provider survives across requests in one session. */
let runtimeProvider: EngineProvider | null = null;

const getActiveProvider = (): EngineProvider => {
  if (runtimeProvider) return runtimeProvider;
  const env = buildEnv();
  return (env.engineProvider as EngineProvider | undefined) ?? "embedded";
};

const switchSchema = z.object({
  provider: z.enum(["embedded", "wirepod", "external"])
});

export const createEngineRouter = () => {
  const router = Router();

  /**
   * GET /api/engine/providers
   * Lists all supported engine providers.
   */
  router.get("/providers", (_request: Request, response: Response) => {
    response.json({
      providers: ALL_PROVIDERS,
      active: getActiveProvider()
    });
  });

  /**
   * GET /api/engine/active
   * Returns just the currently active provider.
   */
  router.get("/active", (_request: Request, response: Response) => {
    const active = getActiveProvider();
    const info = ALL_PROVIDERS.find((p) => p.id === active) ?? ALL_PROVIDERS[0];
    response.json({ active, info });
  });

  /**
   * POST /api/engine/switch
   * Body: { provider: "embedded" | "wirepod" | "external" }
   * Switches the active provider for this session.
   */
  router.post("/switch", (request: Request, response: Response) => {
    const { provider } = switchSchema.parse(request.body ?? {});
    runtimeProvider = provider;
    const info = ALL_PROVIDERS.find((p) => p.id === provider) ?? ALL_PROVIDERS[0];
    response.json({
      active: provider,
      info,
      note: `Engine provider switched to "${info.label}".`
    });
  });

  /**
   * GET /api/engine/health
   * Quick health probe for the active engine.
   */
  router.get("/health", (_request: Request, response: Response) => {
    const active = getActiveProvider();
    response.json({
      provider: active,
      ok: true,
      checkedAt: new Date().toISOString()
    });
  });

  return router;
};
