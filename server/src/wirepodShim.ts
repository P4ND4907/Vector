/**
 * server/src/wirepodShim.ts
 *
 * WirePod Shim – makes WirePod optional.
 *
 * Reads WIREPOD_MODE from the environment (default: "mock") and exposes an
 * Express router that handles the /wirepod/* API surface used by the
 * frontend.
 *
 * Modes
 * ─────
 *   mock   (default) – returns canned responses; no robot or WirePod needed.
 *   proxy             – forwards requests to the WirePod service at
 *                       WIREPOD_BASE_URL (default: http://127.0.0.1:8080).
 *                       Use this mode when Docker Compose includes the
 *                       embedded wirepod service.
 *   direct            – reserved for a future native-SDK integration;
 *                       currently behaves like mock with a warning.
 *
 * Usage (in server/src/index.ts):
 *   import { createWirepodShimRouter } from "./wirepodShim.js";
 *   app.use("/api/wirepod", createWirepodShimRouter());
 */

import { Router, type Request, type Response } from "express";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WirepodMode = "mock" | "proxy" | "direct";

export interface WirepodShimOptions {
  /** Overrides WIREPOD_MODE env var. */
  mode?: WirepodMode;
  /** Base URL of the upstream WirePod service (proxy mode only). */
  baseUrl?: string;
  /** Request timeout in milliseconds for proxy calls. */
  timeoutMs?: number;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_STATUS = {
  online: false,
  mock: true,
  battery: 85,
  docked: true,
  charging: true,
  firmware: "mock-1.0.0",
  serialNumber: "MOCK-VECTOR-0001",
  lastSeen: new Date().toISOString(),
};

function makeMockLog(action: string, detail?: Record<string, unknown>) {
  return {
    ok: true,
    mock: true,
    action,
    detail: detail ?? {},
    timestamp: new Date().toISOString(),
  };
}

// ── Proxy helper ──────────────────────────────────────────────────────────────

async function proxyRequest(
  baseUrl: string,
  timeoutMs: number,
  req: Request,
  res: Response
): Promise<void> {
  const target = `${baseUrl.replace(/\/$/, "")}${req.path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...(req.headers["authorization"]
          ? { authorization: String(req.headers["authorization"]) }
          : {}),
      },
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : undefined,
      signal: controller.signal,
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data: unknown = await upstream.json();
      res.status(upstream.status).json(data);
    } else {
      const text = await upstream.text();
      res.status(upstream.status).type("text").send(text);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      res.status(504).json({
        ok: false,
        message: `WirePod proxy timed out after ${timeoutMs} ms`,
      });
    } else {
      res.status(502).json({
        ok: false,
        message: "WirePod proxy unreachable. Is the wirepod service running?",
      });
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Router factory ────────────────────────────────────────────────────────────

/**
 * Creates an Express router that implements the WirePod shim.
 * Mount it at a path such as `/api/wirepod`.
 */
export function createWirepodShimRouter(opts: WirepodShimOptions = {}): Router {
  const rawMode = (opts.mode ?? process.env.WIREPOD_MODE ?? "mock")
    .toLowerCase()
    .trim() as WirepodMode;

  const mode: WirepodMode =
    rawMode === "proxy" || rawMode === "direct" ? rawMode : "mock";

  const baseUrl =
    opts.baseUrl ??
    process.env.WIREPOD_BASE_URL ??
    "http://127.0.0.1:8080";

  const rawTimeoutMs = Number(process.env.WIREPOD_TIMEOUT_MS);
  const timeoutMs =
    opts.timeoutMs ??
    (Number.isFinite(rawTimeoutMs) ? rawTimeoutMs : 4_000);

  const modeLabel = mode === "proxy" ? `mode=proxy → ${baseUrl}` : `mode=${mode}`;
  if (mode === "direct") {
    console.warn(
      "[wirepodShim] WIREPOD_MODE=direct is not yet implemented. " +
        "Falling back to mock responses."
    );
  } else {
    console.log(`[wirepodShim] ${modeLabel}`);
  }

  const router = Router();

  // ── /status ────────────────────────────────────────────────────────────────

  router.get("/status", async (req: Request, res: Response) => {
    if (mode === "proxy") {
      await proxyRequest(baseUrl, timeoutMs, req, res);
      return;
    }
    res.json(MOCK_STATUS);
  });

  // ── /speak ─────────────────────────────────────────────────────────────────

  router.post("/speak", async (req: Request, res: Response) => {
    if (mode === "proxy") {
      await proxyRequest(baseUrl, timeoutMs, req, res);
      return;
    }
    const text = String(req.body?.text ?? "").trim();
    res.json(makeMockLog("speak", { text }));
  });

  // ── /move ──────────────────────────────────────────────────────────────────

  router.post("/move", async (req: Request, res: Response) => {
    if (mode === "proxy") {
      await proxyRequest(baseUrl, timeoutMs, req, res);
      return;
    }
    res.json(
      makeMockLog("move", {
        direction: req.body?.direction ?? "forward",
        speed: req.body?.speed ?? 60,
        durationMs: req.body?.durationMs,
      })
    );
  });

  // ── /dock ──────────────────────────────────────────────────────────────────

  router.post("/dock", async (req: Request, res: Response) => {
    if (mode === "proxy") {
      await proxyRequest(baseUrl, timeoutMs, req, res);
      return;
    }
    res.json(makeMockLog("dock"));
  });

  // ── /stop ──────────────────────────────────────────────────────────────────

  router.post("/stop", async (req: Request, res: Response) => {
    if (mode === "proxy") {
      await proxyRequest(baseUrl, timeoutMs, req, res);
      return;
    }
    res.json(makeMockLog("stop"));
  });

  // ── /ping ──────────────────────────────────────────────────────────────────

  router.get("/ping", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      mode,
      wirepodAvailable: mode === "proxy",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
