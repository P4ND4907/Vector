import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export type LicenseTier = "free" | "pro";

export interface LicenseRecord {
  key: string;
  tier: LicenseTier;
  activatedAt: string;
  expiresAt?: string;
  email?: string;
}

export interface LicenseStore {
  read: () => LicenseRecord | null;
  write: (record: LicenseRecord) => void;
  clear: () => void;
}

const resolveLicenseFilePath = (): string => {
  const configured = process.env.VECTOR_LICENSE_FILE?.trim();
  if (configured) return configured;
  return path.resolve(serverRoot, "data/vector-license.local.json");
};

export const createLicenseStore = (filePath?: string): LicenseStore => {
  const resolvedPath = filePath ?? resolveLicenseFilePath();

  const ensureDir = () => {
    const dir = path.dirname(resolvedPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  };

  const read = (): LicenseRecord | null => {
    if (!existsSync(resolvedPath)) return null;
    try {
      const raw = readFileSync(resolvedPath, "utf8");
      return JSON.parse(raw) as LicenseRecord;
    } catch {
      return null;
    }
  };

  const write = (record: LicenseRecord): void => {
    ensureDir();
    writeFileSync(resolvedPath, JSON.stringify(record, null, 2), "utf8");
  };

  const clear = (): void => {
    if (existsSync(resolvedPath)) {
      writeFileSync(resolvedPath, JSON.stringify({}), "utf8");
    }
  };

  return { read, write, clear };
};
