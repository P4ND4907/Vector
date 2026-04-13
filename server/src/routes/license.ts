import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

type BuildEnvResult = ReturnType<typeof import("../utils/env.js").buildEnv>;

type LicenseTier = "free" | "pro";

interface LicenseData {
  tier: LicenseTier;
  key?: string;
  activatedAt?: string;
}

const PRO_FEATURES = [
  "advanced_automation",
  "premium_personality_packs",
  "repair_tools_advanced",
  "priority_support",
  "no_ads"
];

const FREE_FEATURES = [
  "basic_controls",
  "diagnostics",
  "voice_commands",
  "routines",
  "camera"
];

const getLicenseFilePath = (dataFilePath: string): string => {
  const dir = path.dirname(dataFilePath);
  return path.join(dir, "vector-license.local.json");
};

const readLicense = (filePath: string): LicenseData => {
  if (!existsSync(filePath)) {
    return { tier: "free" };
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as LicenseData;
  } catch {
    return { tier: "free" };
  }
};

const writeLicense = (filePath: string, data: LicenseData): void => {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
};

const asyncRoute =
  (handler: (request: Request, response: Response) => Promise<void>) =>
  (request: Request, response: Response, next: (error?: unknown) => void) => {
    void handler(request, response).catch(next);
  };

const activateSchema = z.object({
  key: z.string().min(1)
});

export const createLicenseRouter = (env: BuildEnvResult) => {
  const router = Router();
  const licenseFilePath = getLicenseFilePath(env.dataFilePath);

  router.get("/status", (_request, response) => {
    const license = readLicense(licenseFilePath);
    response.json({
      tier: license.tier,
      activatedAt: license.activatedAt,
      features: license.tier === "pro" ? PRO_FEATURES : FREE_FEATURES
    });
  });

  router.post(
    "/activate",
    asyncRoute(async (request, response) => {
      const { key } = activateSchema.parse(request.body ?? {});
      const tier: LicenseTier = key.startsWith("PRO-") ? "pro" : "free";
      const activatedAt = new Date().toISOString();
      const data: LicenseData = { tier, key, activatedAt };
      const maskedKey = key.length > 4 ? `${key.slice(0, 4)}-****` : "****";
      writeLicense(licenseFilePath, data);
      response.json({ tier, activatedAt, key: maskedKey });
    })
  );

  return router;
};
