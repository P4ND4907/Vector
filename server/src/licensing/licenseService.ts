import type { LocalLicenseRecord } from "./licenseStore.js";
import { createLicenseStore } from "./licenseStore.js";

const FREE_KEY_PATTERN = /^VEC-FREE-[A-Z0-9]{8}$/;
const PRO_KEY_PATTERN = /^VEC-PRO-[A-Z0-9]{8}$/;

export const createLicenseService = (filePath: string) => {
  const store = createLicenseStore(filePath);

  const getStatus = () => store.getLicense();

  const activate = (rawKey: string): LocalLicenseRecord => {
    const key = String(rawKey ?? "").trim().toUpperCase();
    if (!key) {
      throw new Error("Enter a license key to continue.");
    }

    const tier: LocalLicenseRecord["tier"] | null = PRO_KEY_PATTERN.test(key)
      ? "pro"
      : FREE_KEY_PATTERN.test(key)
        ? "free"
        : null;

    if (!tier) {
      throw new Error("That license key format is invalid. Use VEC-FREE-XXXXXXXX or VEC-PRO-XXXXXXXX.");
    }

    const now = new Date().toISOString();
    return store.saveLicense({
      key,
      activated: true,
      createdAt: now,
      tier
    });
  };

  return {
    getStatus,
    activate
  };
};
