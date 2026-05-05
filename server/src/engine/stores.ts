import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type BridgeProviderName = "embedded" | "wirepod" | "mock";

export interface EngineSettingsRecord {
  provider: BridgeProviderName;
  updatedAt: string;
}

export interface PairingRecord {
  serial: string;
  ipAddress: string;
  name?: string;
  token?: string;
  pairedAt: string;
}

const ensureJsonFile = <T>(filePath: string, defaults: T) => {
  const resolvedPath = path.resolve(filePath);
  const directory = path.dirname(resolvedPath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  if (!existsSync(resolvedPath)) {
    writeFileSync(resolvedPath, JSON.stringify(defaults, null, 2), "utf8");
  }
  return resolvedPath;
};

const readJsonSafe = <T>(filePath: string, defaults: T): T => {
  try {
    return {
      ...defaults,
      ...(JSON.parse(readFileSync(filePath, "utf8")) as Partial<T>)
    };
  } catch {
    return defaults;
  }
};

export const createEngineSettingsStore = (filePath: string) => {
  const defaults: EngineSettingsRecord = {
    provider: "embedded",
    updatedAt: new Date().toISOString()
  };
  const resolvedPath = ensureJsonFile(filePath, defaults);
  let current = readJsonSafe(resolvedPath, defaults);
  if (!["embedded", "wirepod", "mock"].includes(current.provider)) {
    current.provider = "embedded";
  }

  return {
    get: () => current,
    set: (provider: BridgeProviderName) => {
      current = {
        provider,
        updatedAt: new Date().toISOString()
      };
      writeFileSync(resolvedPath, JSON.stringify(current, null, 2), "utf8");
      return current;
    }
  };
};

export const createPairingStore = (filePath: string) => {
  const defaults: { pairings: PairingRecord[] } = { pairings: [] };
  const resolvedPath = ensureJsonFile(filePath, defaults);
  let current = readJsonSafe(resolvedPath, defaults);

  return {
    list: () => current.pairings,
    upsert: (pairing: PairingRecord) => {
      current = {
        pairings: [
          pairing,
          ...current.pairings.filter(
            (item) => item.serial !== pairing.serial && item.ipAddress !== pairing.ipAddress
          )
        ].slice(0, 40)
      };
      writeFileSync(resolvedPath, JSON.stringify(current, null, 2), "utf8");
      return current.pairings;
    },
    clear: () => {
      current = defaults;
      writeFileSync(resolvedPath, JSON.stringify(current, null, 2), "utf8");
      return current;
    }
  };
};
