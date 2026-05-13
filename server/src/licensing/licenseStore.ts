import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface LocalLicenseRecord {
  key: string;
  activated: boolean;
  createdAt: string;
  expiresAt?: string;
  tier: "free" | "pro";
}

const defaultLicense = (): LocalLicenseRecord => ({
  key: "",
  activated: false,
  createdAt: new Date().toISOString(),
  tier: "free"
});

export const createLicenseStore = (filePath: string) => {
  const resolvedPath = path.resolve(filePath);

  const ensureFile = () => {
    const directory = path.dirname(resolvedPath);
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
    if (!existsSync(resolvedPath)) {
      writeFileSync(resolvedPath, JSON.stringify(defaultLicense(), null, 2), "utf8");
    }
  };

  const read = (): LocalLicenseRecord => {
    ensureFile();
    try {
      const parsed = JSON.parse(readFileSync(resolvedPath, "utf8")) as Partial<LocalLicenseRecord>;
      return {
        ...defaultLicense(),
        ...parsed,
        tier: parsed.tier === "pro" ? "pro" : "free",
        activated: Boolean(parsed.activated),
        key: typeof parsed.key === "string" ? parsed.key.trim() : "",
        createdAt: typeof parsed.createdAt === "string" && parsed.createdAt ? parsed.createdAt : new Date().toISOString(),
        expiresAt: typeof parsed.expiresAt === "string" && parsed.expiresAt ? parsed.expiresAt : undefined
      };
    } catch {
      return defaultLicense();
    }
  };

  let current = read();

  return {
    getLicense: () => current,
    saveLicense: (license: LocalLicenseRecord) => {
      current = license;
      ensureFile();
      writeFileSync(resolvedPath, JSON.stringify(current, null, 2), "utf8");
      return current;
    }
  };
};
